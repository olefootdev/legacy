import { getSupabase } from '@/supabase/client';
import { getBotTeamById, getMatchingBotTeam, type BotTeamDefinition } from './botTeams';
import type { ClubSearchHit } from '@/supabase/friendlyChallenges';

export type MatchmakingMode = 'quick' | 'penalty';

export interface MatchmakingParams {
  myClubId: string;
  myOverall: number;
  preferredMode: MatchmakingMode;
  maxOvrDiff?: number;
}

export type OpponentMatch =
  | { type: 'online'; club: ClubSearchHit; ovrDiff: number }
  | { type: 'bot'; bot: BotTeamDefinition };

/**
 * Busca automática de adversário para amistoso.
 *
 * Prioridade:
 * 1. Times ONLINE com OVR similar (±10)
 * 2. Times ONLINE com OVR similar (±15)
 * 3. Bot aleatório com OVR próximo
 */
export async function findFriendlyOpponent(
  params: MatchmakingParams,
): Promise<OpponentMatch> {
  const { myClubId, myOverall, maxOvrDiff = 10 } = params;

  // 1. Tentar buscar times ONLINE disponíveis
  const onlineTeams = await searchOnlineAvailableTeams({
    ovrRange: [myOverall - maxOvrDiff, myOverall + maxOvrDiff],
    excludeClubId: myClubId,
  });

  if (onlineTeams.length > 0) {
    const best = pickBestOnlineMatch(onlineTeams, myOverall);
    return {
      type: 'online',
      club: best.club,
      ovrDiff: best.ovrDiff,
    };
  }

  // 2. Tentar com range maior (±15)
  const onlineTeamsWide = await searchOnlineAvailableTeams({
    ovrRange: [myOverall - 15, myOverall + 15],
    excludeClubId: myClubId,
  });

  if (onlineTeamsWide.length > 0) {
    const best = pickBestOnlineMatch(onlineTeamsWide, myOverall);
    return {
      type: 'online',
      club: best.club,
      ovrDiff: best.ovrDiff,
    };
  }

  // 3. Fallback: retornar bot com OVR próximo
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
): Promise<OpponentMatch> {
  return findFriendlyOpponent({
    myClubId,
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
