import { getSupabase } from '@/supabase/client';
import { getBotTeamById, getMatchingBotTeam, type BotTeamDefinition } from './botTeams';
import type { ClubSearchHit } from '@/supabase/friendlyChallenges';
import type { OpponentStub } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';
import { fetchOpponentSquads } from '@/supabase/managerSquad';

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
  // bot
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
 * Monta um OpponentStub a partir de um squad real do banco.
 */
function squadToOpponentStub(entry: {
  userId: string;
  clubName: string;
  clubShort: string;
  players: import('@/entities/types').PlayerEntity[];
  lineup: Record<string, string>;
  avgOvr: number;
}): OpponentStub {
  const lineupPlayers = Object.values(entry.lineup)
    .map(id => entry.players.find(p => p.id === id))
    .filter((p): p is import('@/entities/types').PlayerEntity => !!p);

  return {
    id: entry.userId,
    name: entry.clubName,
    shortName: entry.clubShort,
    strength: entry.avgOvr,
    genesisAwayPlayers: lineupPlayers,
  };
}

/**
 * Busca automática de adversário para amistoso.
 *
 * Prioridade:
 * 1. Times reais do banco (manager_squad) com OVR similar (±10) — PvP assíncrono
 * 2. Times reais do banco com OVR similar (±20) — range mais amplo
 * 3. Qualquer time real do banco (sem filtro de OVR) — sempre preferir manager real
 * 4. Bot aleatório com OVR próximo (último recurso)
 */
export async function findFriendlyOpponent(
  params: MatchmakingParams,
): Promise<OpponentMatch> {
  const { myUserId, myOverall, maxOvrDiff = 10 } = params;

  if (myUserId) {
    // 1. Times reais (±10)
    const realTeams = await fetchOpponentSquads({
      excludeUserId: myUserId,
      ovrRange: [myOverall - maxOvrDiff, myOverall + maxOvrDiff],
    });
    const valid = realTeams.filter(isValidOpponentSquad);
    if (valid.length > 0) {
      return { type: 'real_manager', stub: squadToOpponentStub(pickClosest(valid, myOverall)) };
    }

    // 2. Times reais (±20)
    const realTeamsWide = await fetchOpponentSquads({
      excludeUserId: myUserId,
      ovrRange: [myOverall - 20, myOverall + 20],
    });
    const validWide = realTeamsWide.filter(isValidOpponentSquad);
    if (validWide.length > 0) {
      return { type: 'real_manager', stub: squadToOpponentStub(pickClosest(validWide, myOverall)) };
    }

    // 3. Qualquer time real (sem filtro OVR)
    const allTeams = await fetchOpponentSquads({
      excludeUserId: myUserId,
      ovrRange: [0, 99],
    });
    const validAll = allTeams.filter(isValidOpponentSquad);
    if (validAll.length > 0) {
      return { type: 'real_manager', stub: squadToOpponentStub(pickClosest(validAll, myOverall)) };
    }
  }

  // 4. Fallback: bot com OVR próximo
  const bot = getMatchingBotTeam(myOverall, 15);
  return { type: 'bot', bot };
}

function isValidOpponentSquad(entry: import('@/supabase/managerSquad').OpponentSquadEntry): boolean {
  if (!entry.clubName || entry.clubName === 'Buscando…' || entry.clubName === 'Clube Visitante') return false;
  if (entry.avgOvr < 40 || entry.avgOvr > 99) return false;
  const lineupSize = Object.values(entry.lineup).filter(Boolean).length;
  if (lineupSize < 11) return false;
  return true;
}

function pickClosest(
  teams: import('@/supabase/managerSquad').OpponentSquadEntry[],
  myOverall: number,
): import('@/supabase/managerSquad').OpponentSquadEntry {
  const sorted = [...teams].sort((a, b) =>
    Math.abs(a.avgOvr - myOverall) - Math.abs(b.avgOvr - myOverall)
  );
  return sorted[Math.floor(Math.random() * Math.min(3, sorted.length))]!;
}

/**
 * Busca rápida de adversário (usado no botão "BUSCAR PARTIDA").
 * Retorna imediatamente um bot se não houver times online.
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
