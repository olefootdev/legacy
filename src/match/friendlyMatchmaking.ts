import { getSupabase } from '@/supabase/client';
import { getMatchingBotTeam, type BotTeamDefinition } from './botTeams';
import type { OpponentStub, PlayerEntity } from '@/entities/types';
import type { FormationSchemeId } from '@/match-engine/types';
import { overallFromAttributes } from '@/entities/player';
import { localCrestUrl } from '@/settings/crestUrl';

/** Extrai URL do crest do time do coração armazenado em onboarding_data. */
function favoriteTeamCrestFromOnboarding(onboardingData: unknown): string | null {
  if (!onboardingData || typeof onboardingData !== 'object') return null;
  const fav = (onboardingData as { favoriteRealTeam?: { id?: number; logo?: string | null } | null })
    .favoriteRealTeam;
  if (!fav) return null;
  // Prioriza o crest local (resistente a URLs antigas com hotlink-block).
  if (typeof fav.id === 'number' && fav.id > 0) return localCrestUrl(fav.id);
  const logo = typeof fav.logo === 'string' ? fav.logo.trim() : '';
  return logo || null;
}

// ── Histórico de adversários recentes (evita repetição, escopado por user) ───
const RECENT_OPPONENTS_BASE_KEY = 'olefoot_recent_opponents';
const MAX_RECENT_OPPONENTS = 5;

function recentOpponentsKey(userId?: string): string {
  return userId ? `${RECENT_OPPONENTS_BASE_KEY}_${userId}` : RECENT_OPPONENTS_BASE_KEY;
}

function getRecentOpponents(userId?: string): string[] {
  try {
    const raw = localStorage.getItem(recentOpponentsKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function addRecentOpponent(opponentId: string, userId?: string): void {
  try {
    const key = recentOpponentsKey(userId);
    const recent = getRecentOpponents(userId).filter(id => id !== opponentId);
    recent.unshift(opponentId);
    localStorage.setItem(key, JSON.stringify(recent.slice(0, MAX_RECENT_OPPONENTS)));
  } catch { /* ignore */ }
}

/**
 * Converte qualquer `OpponentMatch` em `OpponentStub` para passar via
 * navigate state (mantém o adversário consistente entre tela de busca e
 * MatchQuick/MatchClassic — evita cair no DEFAULT_OPPONENT placeholder).
 */
/** Stub especial pra sinalizar "nenhum manager encontrado". UI deve detectar
 *  via id === NO_OPPONENT_STUB_ID e mostrar mensagem ao invés de jogar. */
export const NO_OPPONENT_STUB_ID = 'no-opponent-available';

export function opponentMatchToStub(m: OpponentMatch, myOverall: number): OpponentStub {
  if (m.type === 'real_manager') return m.stub;
  if (m.type === 'none') {
    return {
      id: NO_OPPONENT_STUB_ID,
      name: 'Nenhum manager disponível',
      shortName: '—',
      strength: myOverall,
    };
  }
  return {
    id: m.bot.id,
    name: m.bot.name,
    shortName: m.bot.shortName,
    strength: m.bot.avgOverall,
  };
}

export type MatchmakingMode = 'quick' | 'penalty';

export interface MatchmakingParams {
  myClubId: string;
  myUserId?: string;
  myOverall: number;
  preferredMode: MatchmakingMode;
  maxOvrDiff?: number;
}

export type OpponentMatch =
  | { type: 'real_manager'; stub: OpponentStub }
  | { type: 'bot'; bot: BotTeamDefinition }
  | { type: 'none' };

/**
 * Busca adversário real — QUALQUER manager com squad persistido (≥11 jogadores).
 *
 * Modelo ASSÍNCRONO: o oponente NÃO precisa estar online. Usamos o snapshot
 * do plantel dele (manager_squad), e o sistema joga "por ele" enquanto
 * estiver offline. Quando ele logar, vê o histórico.
 *
 * Fonte: manager_squad (todo manager que tem plantel) + JOIN com profiles
 * pra display_name/club_short. NÃO depende de inscrição na Liga Global.
 * Sem cap de OVR (todos contra todos enquanto a base é pequena).
 *
 * Timeout de 5s para não travar a UI.
 */
async function findRealManagerOpponent(
  myUserId: string | undefined,
  myOverall: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _maxOvrDiff: number,
): Promise<OpponentMatch | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    // RPC SECURITY DEFINER — bypassa RLS de profiles (que só permite ler self).
    // Promise.race garante <3s mesmo se a RPC enroscar (rede ruim / Supabase lento).
    const rpcCall = sb.rpc('find_friendly_opponents', {
      p_exclude_user_id: myUserId ?? null,
      p_min_players: 11,
      p_limit: 50,
    });
    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
      setTimeout(() => resolve({ data: null, error: { message: 'rpc timeout 3s' } }), 3000);
    });

    const result = await Promise.race([rpcCall, timeoutPromise]);
    const rows = (result as { data: unknown }).data;
    const error = (result as { error: { message: string } | null }).error;

    if (error || !Array.isArray(rows) || rows.length === 0) {
      if (error) console.warn('[friendlyMatchmaking] RPC find_friendly_opponents:', error.message);
      return null;
    }

    const recentOpponents = new Set(getRecentOpponents(myUserId));

    type SquadRow = {
      user_id: string;
      players: unknown;
      lineup: unknown;
      formation_scheme: FormationSchemeId | null;
      display_name: string | null;
      club_name: string | null;
      club_short: string | null;
      onboarding_data: unknown;
      player_count: number;
    };

    const candidates: Array<{
      userId: string;
      clubName: string;
      clubShort: string;
      players: PlayerEntity[];
      lineup: Record<string, string>;
      formationScheme: FormationSchemeId | null;
      avgOvr: number;
      supporterCrestUrl: string | null;
    }> = [];

    for (const row of rows as unknown as SquadRow[]) {
      if (recentOpponents.has(row.user_id)) continue;

      const players = Array.isArray(row.players) ? (row.players as PlayerEntity[]) : [];
      if (players.length < 11) continue;

      const lineup = (row.lineup && typeof row.lineup === 'object' ? row.lineup : {}) as Record<string, string>;
      const clubName = row.club_name ?? row.display_name ?? 'Manager';
      const clubShort = row.club_short ?? 'MNG';
      const supporterCrestUrl = favoriteTeamCrestFromOnboarding(row.onboarding_data);

      // OVR médio dos 11 titulares (lineup) ou top 11 fallback
      let starters = Object.values(lineup)
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is PlayerEntity => !!p);
      if (starters.length < 11) {
        starters = [...players]
          .sort((a, b) => overallFromAttributes(b.attrs, b.pos) - overallFromAttributes(a.attrs, a.pos))
          .slice(0, 11);
      }
      const avgOvr = Math.round(
        starters.reduce((s, p) => s + overallFromAttributes(p.attrs, p.pos), 0) / starters.length,
      );

      candidates.push({
        userId: row.user_id,
        clubName,
        clubShort,
        players,
        lineup,
        formationScheme: row.formation_scheme,
        avgOvr,
        supporterCrestUrl,
      });
    }

    if (candidates.length === 0) return null;

    // Aleatório puro — sem filtro de OVR (todos contra todos).
    // myOverall fica disponível pra usar em versão futura com matchmaking por skill.
    void myOverall;
    const pick = candidates[Math.floor(Math.random() * candidates.length)]!;

    // Lineup do oponente (top 11 do squad real)
    let realLineupPlayers = Object.values(pick.lineup)
      .map((id) => pick.players.find((p) => p.id === id))
      .filter((p): p is PlayerEntity => !!p)
      .slice(0, 11);
    if (realLineupPlayers.length < 11) {
      realLineupPlayers = [...pick.players]
        .sort((a, b) => overallFromAttributes(b.attrs, b.pos) - overallFromAttributes(a.attrs, a.pos))
        .slice(0, 11);
    }

    const stub: OpponentStub = {
      id: pick.userId,
      name: pick.clubName,
      shortName: pick.clubShort,
      strength: pick.avgOvr,
      genesisAwayPlayers: realLineupPlayers,
      formationScheme: pick.formationScheme ?? '4-3-3',
      supporterCrestUrl: pick.supporterCrestUrl,
    };

    addRecentOpponent(pick.userId, myUserId);
    return { type: 'real_manager', stub };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('[friendlyMatchmaking] timeout buscando adversário');
    } else {
      console.warn('[friendlyMatchmaking] real manager search failed:', err);
    }
    return null;
  }
}

/**
 * Busca automática de adversário para amistoso (Quick + Classic).
 *
 * Decisão de produto (2026-05-27 — atualizada):
 * 1. SEMPRE deve devolver uma partida — nada de "Nenhum manager disponível".
 * 2. Hierarquia de fallback (máx 5s total via Promise.race):
 *    a) Manager real (≥11 jogadores) — squad snapshot, IA joga por ele offline
 *    b) Manager real (relax do filtro de recentes)
 *    c) Time da Liga Global — sintetiza squad com base no overall do team
 *    d) Bot — último recurso (nunca chega aqui com 40+ managers ativos)
 * 3. Sem filtro de OVR (todos contra todos enquanto a base é pequena).
 */
export async function findFriendlyOpponent(
  params: MatchmakingParams,
): Promise<OpponentMatch> {
  const { myUserId, myOverall } = params;

  // (a) Manager qualquer (exclui recentes via getRecentOpponents)
  const anyManager = await findRealManagerOpponent(myUserId, myOverall, 99);
  if (anyManager) return anyManager;

  // (b) Relax do filtro de recentes — limpa cache e tenta de novo
  try {
    if (myUserId) {
      localStorage.removeItem(recentOpponentsKey(myUserId));
    } else {
      localStorage.removeItem(recentOpponentsKey());
    }
  } catch { /* ignore */ }
  const relaxedManager = await findRealManagerOpponent(myUserId, myOverall, 99);
  if (relaxedManager) return relaxedManager;

  // (c) Time da Liga Global — sintetiza adversário a partir do team registrado
  const globalTeam = await findGlobalLeagueOpponent(myUserId, myOverall);
  if (globalTeam) return globalTeam;

  // (d) Bot — último recurso. Garante que a partida SEMPRE começa.
  const bot = getMatchingBotTeam(myOverall, 10);
  return { type: 'bot', bot };
}

/**
 * Busca um adversário entre os times registrados na Liga Global. Quando o
 * manager_squad do dono do time não existe ou time é "fantasma", sintetiza
 * um squad básico baseado em `overall` (suficiente pra Quick/Classic).
 *
 * Promise.race garante <2s.
 */
async function findGlobalLeagueOpponent(
  myUserId: string | undefined,
  myOverall: number,
): Promise<OpponentMatch | null> {
  const sb = getSupabase();
  if (!sb) return null;
  void myOverall;
  try {
    const queryPromise = sb
      .from('global_league_teams')
      .select('id, manager_id, club_name, club_short, overall')
      .limit(50);
    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
      setTimeout(() => resolve({ data: null, error: { message: 'global-league timeout 2s' } }), 2000);
    });
    const result = await Promise.race([queryPromise, timeoutPromise]);
    const rows = (result as { data: unknown }).data;
    const error = (result as { error: { message: string } | null }).error;
    if (error || !Array.isArray(rows) || rows.length === 0) {
      if (error) console.warn('[friendlyMatchmaking] Liga Global:', error.message);
      return null;
    }

    type TeamRow = { id: string; manager_id: string; club_name: string; club_short: string; overall: number };
    const candidates = (rows as TeamRow[]).filter(
      (r) => r.manager_id !== myUserId && Number(r.overall) > 0,
    );
    if (candidates.length === 0) return null;
    const pick = candidates[Math.floor(Math.random() * candidates.length)]!;

    // Sintetiza squad com base no overall do time da Liga Global
    const syntheticSquad = generateSyntheticSquad(pick.club_short, Number(pick.overall));
    const stub: OpponentStub = {
      id: `globalleague-${pick.id}`,
      name: pick.club_name,
      shortName: pick.club_short,
      strength: Number(pick.overall),
      genesisAwayPlayers: syntheticSquad,
      formationScheme: '4-3-3',
      supporterCrestUrl: null,
    };
    return { type: 'real_manager', stub };
  } catch (err) {
    console.warn('[friendlyMatchmaking] global league fallback failed:', err);
    return null;
  }
}

/** Gera 11 jogadores sintéticos com OVR centrado no valor dado. Suficiente
 *  pra alimentar o ClassicMatchScreen / MatchQuick quando o squad real não
 *  está disponível (raro). */
function generateSyntheticSquad(prefix: string, ovr: number): PlayerEntity[] {
  const positions: Array<{ pos: string; zone: PlayerEntity['zone'] }> = [
    { pos: 'GOL', zone: 'gol' },
    { pos: 'ZAG', zone: 'defesa' },
    { pos: 'ZAG', zone: 'defesa' },
    { pos: 'LE',  zone: 'lateral_esq' },
    { pos: 'LD',  zone: 'lateral_dir' },
    { pos: 'VOL', zone: 'meio' },
    { pos: 'MC',  zone: 'meio' },
    { pos: 'MEI', zone: 'meio' },
    { pos: 'PE',  zone: 'ataque' },
    { pos: 'PD',  zone: 'ataque' },
    { pos: 'ATA', zone: 'ataque' },
  ];
  const base = Math.max(40, Math.min(95, ovr));
  return positions.map(({ pos, zone }, i) => {
    const variance = Math.floor(Math.random() * 6) - 3; // -3..+2
    const lvl = Math.max(35, Math.min(99, base + variance));
    return {
      id: `gl-syn-${prefix.toLowerCase()}-${i + 1}`,
      num: i + 1,
      name: `${prefix} ${pos} ${i + 1}`,
      pos,
      archetype: 'profissional',
      zone,
      behavior: 'equilibrado',
      attrs: {
        passe: lvl, marcacao: lvl, velocidade: lvl, drible: lvl, finalizacao: lvl,
        fisico: lvl, tatico: lvl, mentalidade: lvl, confianca: lvl, fairPlay: lvl,
      },
      fatigue: 0,
      injuryRisk: 0,
      evolutionXp: 0,
      outForMatches: 0,
    };
  });
}

/**
 * Busca rápida de adversário (usado no botão "BUSCAR PARTIDA").
 */
export async function quickFindOpponent(
  myClubId: string,
  myOverall: number,
  myUserId?: string,
): Promise<OpponentMatch> {
  return findFriendlyOpponent({
    myClubId,
    myUserId,
    myOverall,
    preferredMode: 'quick',
    maxOvrDiff: 10,
  });
}

/**
 * Verifica se um clube está ONLINE e disponível para amistosos.
 */
export async function isClubOnlineAvailable(clubId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { data, error } = await sb
      .from('clubs')
      .select('friendly_availability')
      .eq('club_id', clubId)
      .maybeSingle();

    if (error || !data) return false;
    return (data.friendly_availability as string) === 'ONLINE';
  } catch {
    return false;
  }
}

/**
 * Atualiza a disponibilidade de um clube no Supabase.
 */
export async function updateClubAvailability(
  clubId: string,
  availability: 'ONLINE' | 'OFFLINE',
): Promise<{ ok: true } | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase não configurado.' };

  try {
    const { error } = await sb
      .from('clubs')
      .update({ friendly_availability: availability } as never)
      .eq('club_id', clubId);

    if (error) return { error: error.message };
    return { ok: true };
  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * Atualiza a configuração de auto-aceitar convites.
 */
export async function updateClubAutoAccept(
  clubId: string,
  autoAccept: boolean,
): Promise<{ ok: true } | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase não configurado.' };

  try {
    const { error } = await sb
      .from('clubs')
      .update({ friendly_auto_accept: autoAccept } as never)
      .eq('club_id', clubId);

    if (error) return { error: error.message };
    return { ok: true };
  } catch (err) {
    return { error: String(err) };
  }
}
