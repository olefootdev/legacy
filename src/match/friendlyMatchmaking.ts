import { getSupabase } from '@/supabase/client';
import { getMatchingBotTeam, type BotTeamDefinition } from './botTeams';
import type { OpponentStub, PlayerEntity } from '@/entities/types';
import type { FormationSchemeId } from '@/match-engine/types';
import { overallFromAttributes } from '@/entities/player';

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    // Pega todos managers com squad. JOIN com profiles via FK manager_squad.user_id → profiles.id.
    let query = sb
      .from('manager_squad')
      .select('user_id, players, lineup, formation_scheme, profiles!inner(display_name, club_name, club_short)')
      .limit(100)
      .abortSignal(controller.signal);

    if (myUserId) {
      query = query.neq('user_id', myUserId);
    }

    const { data: rows, error } = await query;
    if (error || !rows || rows.length === 0) return null;

    const recentOpponents = new Set(getRecentOpponents(myUserId));

    type SquadRow = {
      user_id: string;
      players: unknown;
      lineup: unknown;
      formation_scheme: FormationSchemeId | null;
      profiles: { display_name: string | null; club_name: string | null; club_short: string | null } | { display_name: string | null; club_name: string | null; club_short: string | null }[];
    };

    const candidates: Array<{
      userId: string;
      clubName: string;
      clubShort: string;
      players: PlayerEntity[];
      lineup: Record<string, string>;
      formationScheme: FormationSchemeId | null;
      avgOvr: number;
    }> = [];

    for (const row of rows as unknown as SquadRow[]) {
      if (recentOpponents.has(row.user_id)) continue;

      const players = Array.isArray(row.players) ? (row.players as PlayerEntity[]) : [];
      if (players.length < 11) continue;

      const lineup = (row.lineup && typeof row.lineup === 'object' ? row.lineup : {}) as Record<string, string>;
      // profiles pode vir como objeto único ou array, dependendo do supabase-js
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const clubName = profile?.club_name ?? profile?.display_name ?? 'Manager';
      const clubShort = profile?.club_short ?? 'MNG';

      // OVR médio dos 11 titulares (lineup) ou top 11 fallback
      let starters = Object.values(lineup)
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is PlayerEntity => !!p);
      if (starters.length < 11) {
        starters = [...players]
          .sort((a, b) => overallFromAttributes(b.attrs) - overallFromAttributes(a.attrs))
          .slice(0, 11);
      }
      const avgOvr = Math.round(
        starters.reduce((s, p) => s + overallFromAttributes(p.attrs), 0) / starters.length,
      );

      candidates.push({
        userId: row.user_id,
        clubName,
        clubShort,
        players,
        lineup,
        formationScheme: row.formation_scheme,
        avgOvr,
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

    addRecentOpponent(pick.userId, myUserId);
    return { type: 'real_manager', stub };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('[friendlyMatchmaking] timeout (5s) buscando adversário');
    } else {
      console.warn('[friendlyMatchmaking] real manager search failed:', err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Busca automática de adversário para amistoso.
 *
 * Decisão de produto (2026-05-26):
 * 1. Partidas Rápida e Clássica são SEMPRE contra managers reais — sem bots.
 * 2. Enquanto a base é pequena, é "todos contra todos" — SEM filtro de OVR.
 *    Filtros por divisão/skill voltam quando houver volume de managers.
 *
 * Comportamento:
 * - Busca qualquer manager registrado na Liga Global (≠ eu, ≠ recentes).
 * - Se não encontrar ninguém, retorna { type: 'none' } e a UI mostra
 *   "Nenhum manager disponível" em vez de jogar contra mock.
 */
export async function findFriendlyOpponent(
  params: MatchmakingParams,
): Promise<OpponentMatch> {
  const { myUserId, myOverall } = params;

  // Busca QUALQUER manager (cap 99 = sem filtro real de OVR)
  const anyManager = await findRealManagerOpponent(myUserId, myOverall, 99);
  if (anyManager) return anyManager;

  // Nenhum manager disponível — NÃO cai em bot. UI deve tratar.
  return { type: 'none' };
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
