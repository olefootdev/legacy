import { getSupabase } from '@/supabase/client';
import { getMatchingBotTeam, type BotTeamDefinition } from './botTeams';
import type { ClubSearchHit } from '@/supabase/friendlyChallenges';
import type { OpponentStub, PlayerEntity } from '@/entities/types';
import type { FormationSchemeId } from '@/match-engine/types';
import { overallFromAttributes } from '@/entities/player';

// ── Histórico de adversários recentes (evita repetição) ──────────────────────
const RECENT_OPPONENTS_KEY = 'olefoot_recent_opponents';
const MAX_RECENT_OPPONENTS = 5;

function getRecentOpponents(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_OPPONENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function addRecentOpponent(userId: string): void {
  try {
    const recent = getRecentOpponents().filter(id => id !== userId);
    recent.unshift(userId);
    localStorage.setItem(RECENT_OPPONENTS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_OPPONENTS)));
  } catch { /* ignore */ }
}

/**
 * Converte qualquer `OpponentMatch` em `OpponentStub` para passar via
 * navigate state (mantém o adversário consistente entre tela de busca e
 * MatchQuick/MatchClassic — evita cair no DEFAULT_OPPONENT placeholder).
 */
export function opponentMatchToStub(m: OpponentMatch, myOverall: number): OpponentStub {
  if (m.type === 'real_manager') return m.stub;
  if (m.type === 'online') {
    return {
      id: m.club.club_id,
      name: m.club.name,
      shortName: m.club.short_name,
      strength: Math.max(50, myOverall - m.ovrDiff),
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
  | { type: 'online'; club: ClubSearchHit; ovrDiff: number }
  | { type: 'bot'; bot: BotTeamDefinition };

/**
 * Busca adversário real REGISTRADO NA LIGA GLOBAL.
 * Só retorna managers que estão em global_league_teams.
 * Usa jogadores REAIS do plantel (manager_squad).
 */
async function findRealManagerOpponent(
  myUserId: string | undefined,
  myOverall: number,
  maxOvrDiff: number,
): Promise<OpponentMatch | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    // 1. Buscar managers da Liga Global com OVR no range
    let query = sb
      .from('global_league_teams')
      .select('manager_id, club_name, club_short, overall')
      .gte('overall', Math.max(40, myOverall - maxOvrDiff))
      .lte('overall', Math.min(99, myOverall + maxOvrDiff))
      .limit(20);

    if (myUserId) {
      query = query.neq('manager_id', myUserId);
    }

    const { data: globalTeams, error: glErr } = await query;
    if (glErr || !globalTeams || globalTeams.length === 0) return null;

    // Filtrar nomes inválidos e adversários recentes
    const recentOpponents = new Set(getRecentOpponents());
    const validTeams = (globalTeams as Array<{
      manager_id: string; club_name: string; club_short: string; overall: number;
    }>).filter(t =>
      t.club_name &&
      t.club_name !== 'Buscando…' &&
      t.overall >= 40 &&
      t.overall <= 99 &&
      !recentOpponents.has(t.manager_id)
    );

    if (validTeams.length === 0) return null;

    // 2. Buscar squads reais desses managers
    const managerIds = validTeams.map(t => t.manager_id);
    const { data: squads, error: sqErr } = await sb
      .from('manager_squad')
      .select('user_id, players, lineup, formation_scheme')
      .in('user_id', managerIds);

    if (sqErr || !squads || squads.length === 0) return null;

    // Indexar squads por user_id
    const squadByManager: Record<string, {
      players: PlayerEntity[];
      lineup: Record<string, string>;
      formation_scheme: FormationSchemeId | null;
    }> = {};
    for (const row of squads as unknown as Array<{
      user_id: string;
      players: PlayerEntity[];
      lineup: Record<string, string>;
      formation_scheme: FormationSchemeId | null;
    }>) {
      const players = Array.isArray(row.players) ? row.players as PlayerEntity[] : [];
      if (players.length >= 11) {
        squadByManager[row.user_id] = {
          players,
          lineup: (row.lineup as Record<string, string>) ?? {},
          formation_scheme: row.formation_scheme,
        };
      }
    }

    // 3. Montar candidatos: só managers da Liga Global COM squad real
    const candidates: Array<{
      userId: string;
      clubName: string;
      clubShort: string;
      players: PlayerEntity[];
      lineup: Record<string, string>;
      formationScheme: FormationSchemeId | null;
      avgOvr: number;
    }> = [];

    for (const team of validTeams) {
      const squad = squadByManager[team.manager_id];
      if (!squad) continue;

      let lineupPlayers = Object.values(squad.lineup)
        .map(id => squad.players.find(p => p.id === id))
        .filter((p): p is PlayerEntity => !!p);

      if (lineupPlayers.length < 11) {
        lineupPlayers = [...squad.players]
          .sort((a, b) => overallFromAttributes(b.attrs) - overallFromAttributes(a.attrs))
          .slice(0, 11);
      }

      const avgOvr = Math.round(
        lineupPlayers.reduce((s, p) => s + overallFromAttributes(p.attrs), 0) / lineupPlayers.length
      );

      candidates.push({
        userId: team.manager_id,
        clubName: team.club_name,
        clubShort: team.club_short,
        players: squad.players,
        lineup: squad.lineup,
        formationScheme: squad.formation_scheme,
        avgOvr,
      });
    }

    if (candidates.length === 0) return null;

    // Escolher um dos mais próximos em OVR
    const sorted = candidates.sort((a, b) =>
      Math.abs(a.avgOvr - myOverall) - Math.abs(b.avgOvr - myOverall)
    );
    const pick = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))]!;

    // Montar stub com jogadores REAIS do lineup
    let realLineupPlayers = Object.values(pick.lineup)
      .map(id => pick.players.find(p => p.id === id))
      .filter((p): p is PlayerEntity => !!p)
      .slice(0, 11);

    // Fallback: se lineup não resolve 11, usar os melhores do plantel
    if (realLineupPlayers.length < 11) {
      realLineupPlayers = [...pick.players]
        .sort((a, b) => overallFromAttributes(b.attrs) - overallFromAttributes(a.attrs))
        .slice(0, 11);
    }

    const stub: OpponentStub = {
      id: pick.userId,
      name: pick.clubName,
      shortName: pick.clubShort,
      strength: pick.avgOvr,
      genesisAwayPlayers: realLineupPlayers,
      formationScheme: pick.formationScheme ?? '4-3-3',
    };

    // Registrar adversário no histórico para evitar repetição
    addRecentOpponent(pick.userId);

    return { type: 'real_manager', stub };
  } catch (err) {
    console.warn('[friendlyMatchmaking] real manager search failed:', err);
    return null;
  }
}

/**
 * Busca automática de adversário para amistoso.
 *
 * Prioridade:
 * 1. Manager real com squad persistido (jogadores REAIS) — OVR ±10
 * 2. Manager real com squad persistido — OVR ±20
 * 3. Manager real com squad persistido — OVR ±30 (qualquer)
 * 4. Bot (último recurso — nunca inventa jogadores para managers reais)
 */
export async function findFriendlyOpponent(
  params: MatchmakingParams,
): Promise<OpponentMatch> {
  const { myUserId, myOverall, maxOvrDiff = 10 } = params;

  // 1. Squad real (±10)
  const real = await findRealManagerOpponent(myUserId, myOverall, maxOvrDiff);
  if (real) return real;

  // 2. Squad real (±20)
  const realWide = await findRealManagerOpponent(myUserId, myOverall, 20);
  if (realWide) return realWide;

  // 3. Squad real (±30)
  const realVeryWide = await findRealManagerOpponent(myUserId, myOverall, 30);
  if (realVeryWide) return realVeryWide;

  // 4. Bot (último recurso)
  const bot = getMatchingBotTeam(myOverall, 15);
  return { type: 'bot', bot };
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
