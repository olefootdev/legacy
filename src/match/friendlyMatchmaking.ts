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
 * 1. Times reais do banco com OVR similar (±10) — PvP assíncrono
 * 2. Times reais do banco com OVR similar (±15)
 * 3. Times ONLINE com OVR similar (±10)
 * 4. Times ONLINE com OVR similar (±15)
 * 5. Bot aleatório com OVR próximo (fallback)
 */
export async function findFriendlyOpponent(
  params: MatchmakingParams,
): Promise<OpponentMatch> {
  const { myClubId, myUserId, myOverall, maxOvrDiff = 10 } = params;

  // 1. Times reais do banco (±10)
  if (myUserId) {
    const realTeams = await fetchOpponentSquads({
      excludeUserId: myUserId,
      ovrRange: [myOverall - maxOvrDiff, myOverall + maxOvrDiff],
    });
    if (realTeams.length > 0) {
      // Escolhe o mais próximo em OVR, com aleatoriedade para variar
      const sorted = [...realTeams].sort((a, b) =>
        Math.abs(a.avgOvr - myOverall) - Math.abs(b.avgOvr - myOverall)
      );
      // Pega um dos 3 mais próximos aleatoriamente
      const pick = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
      return { type: 'real_manager', stub: squadToOpponentStub(pick!) };
    }

    // 2. Times reais do banco (±15)
    const realTeamsWide = await fetchOpponentSquads({
      excludeUserId: myUserId,
      ovrRange: [myOverall - 15, myOverall + 15],
    });
    if (realTeamsWide.length > 0) {
      const sorted = [...realTeamsWide].sort((a, b) =>
        Math.abs(a.avgOvr - myOverall) - Math.abs(b.avgOvr - myOverall)
      );
      const pick = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
      return { type: 'real_manager', stub: squadToOpponentStub(pick!) };
    }
  }

  // 3. Times ONLINE disponíveis (±10)
  const onlineTeams = await searchOnlineAvailableTeams({
    ovrRange: [myOverall - maxOvrDiff, myOverall + maxOvrDiff],
    excludeClubId: myClubId,
  });
  if (onlineTeams.length > 0) {
    const best = pickBestOnlineMatch(onlineTeams, myOverall);
    return { type: 'online', club: best.club, ovrDiff: best.ovrDiff };
  }

  // 4. Times ONLINE disponíveis (±15)
  const onlineTeamsWide = await searchOnlineAvailableTeams({
    ovrRange: [myOverall - 15, myOverall + 15],
    excludeClubId: myClubId,
  });
  if (onlineTeamsWide.length > 0) {
    const best = pickBestOnlineMatch(onlineTeamsWide, myOverall);
    return { type: 'online', club: best.club, ovrDiff: best.ovrDiff };
  }

  // 5. Fallback: bot com OVR próximo
  const bot = getMatchingBotTeam(myOverall, 15);
  return { type: 'bot', bot };
}

/**
 * Busca times ONLINE disponíveis no Supabase.
 */
async function searchOnlineAvailableTeams(params: {
  ovrRange: [number, number];
  excludeClubId: string;
}): Promise<Array<ClubSearchHit & { overall: number }>> {
  const sb = getSupabase();
  if (!sb) return [];

  const { ovrRange, excludeClubId } = params;
  const [minOvr, maxOvr] = ovrRange;

  try {
    // Buscar clubes com friendly_availability = 'ONLINE'
    // e overall dentro do range especificado
    const { data, error } = await sb
      .from('clubs')
      .select('club_id, name, short_name, overall')
      .eq('friendly_availability', 'ONLINE')
      .gte('overall', minOvr)
      .lte('overall', maxOvr)
      .neq('club_id', excludeClubId)
      .limit(20);

    if (error) {
      console.warn('[friendlyMatchmaking] search error:', error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      club_id: row.club_id as string,
      name: row.name as string,
      short_name: (row.short_name as string) ?? (row.name as string),
      overall: (row.overall as number) ?? 70,
    }));
  } catch (err) {
    console.warn('[friendlyMatchmaking] search exception:', err);
    return [];
  }
}

/**
 * Escolhe o melhor match online baseado na diferença de OVR.
 */
function pickBestOnlineMatch(
  teams: Array<ClubSearchHit & { overall: number }>,
  myOverall: number,
): { club: ClubSearchHit; ovrDiff: number } {
  const sorted = teams
    .map((t) => ({
      club: t,
      ovrDiff: Math.abs(t.overall - myOverall),
    }))
    .sort((a, b) => a.ovrDiff - b.ovrDiff);

  return sorted[0]!;
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
