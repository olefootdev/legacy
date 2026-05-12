import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/supabase/client';
import { isUuidString } from '@/supabase/matchPersistence';

export const FRIENDLY_CHALLENGE_TTL_SEC = 45;

export type FriendlyChallengeStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'cancelled';

export type FriendlyChallengeRow = {
  id: string;
  challenger_club_id: string;
  challenged_club_id: string;
  challenger_club_name: string;
  challenged_club_name: string;
  mode: 'quick' | 'live' | 'penalty';
  bet_currency: 'BRO' | 'EXP';
  bet_bro_cents: number | null;
  bet_exp: number | null;
  status: FriendlyChallengeStatus;
  expires_at: string;
  simulation_seed: number | null;
  created_at: string;
  accepted_at: string | null;
};

export type ClubSearchHit = { club_id: string; name: string; short_name: string };

export async function getSupabaseSessionUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

/** `club_id` do perfil remoto (UUID). */
export async function fetchProfileRemoteClubId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const uid = await getSupabaseSessionUserId();
  if (!uid) return null;
  const { data, error } = await sb.from('profiles').select('club_id').eq('id', uid).maybeSingle();
  if (error || !data?.club_id) return null;
  const cid = data.club_id as string;
  return isUuidString(cid) ? cid : null;
}

export async function searchClubsForFriendly(query: string): Promise<ClubSearchHit[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await sb.rpc('search_clubs_for_friendly', {
    search: q,
    max_results: 12,
  } as never);
  if (error) {
    console.warn('[friendlyChallenges] search:', error.message);
    return [];
  }
  const rows = (data ?? []) as { club_id: string; name: string; short_name: string }[];
  return rows.map((r) => ({
    club_id: r.club_id,
    name: r.name,
    short_name: r.short_name ?? r.name,
  }));
}

export async function fetchFriendlyChallengeById(id: string): Promise<FriendlyChallengeRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from('friendly_challenges').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.warn('[friendlyChallenges] fetch:', error.message);
    return null;
  }
  return data as FriendlyChallengeRow | null;
}

export async function createFriendlyChallenge(input: {
  challengedClubId: string;
  challengedClubName: string;
  challengerClubName: string;
  mode: 'quick' | 'live' | 'penalty';
  betCurrency: 'BRO' | 'EXP';
  betBroCents: number | null;
  betExp: number | null;
}): Promise<{ id: string } | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase não configurado.' };
  const challengerClubId = await fetchProfileRemoteClubId();
  if (!challengerClubId) return { error: 'Associa o teu clube ao perfil (login Supabase + club_id).' };
  if (challengerClubId === input.challengedClubId) return { error: 'Não podes desafiar o teu próprio clube.' };
  const expires = new Date(Date.now() + FRIENDLY_CHALLENGE_TTL_SEC * 1000).toISOString();
  const { data, error } = await sb
    .from('friendly_challenges')
    .insert({
      challenger_club_id: challengerClubId,
      challenged_club_id: input.challengedClubId,
      challenger_club_name: input.challengerClubName,
      challenged_club_name: input.challengedClubName,
      mode: input.mode,
      bet_currency: input.betCurrency,
      bet_bro_cents: input.betCurrency === 'BRO' ? input.betBroCents : null,
      bet_exp: input.betCurrency === 'EXP' ? input.betExp : null,
      status: 'pending',
      expires_at: expires,
    } as never)
    .select('id')
    .single();
  if (error || !data) return { error: error?.message ?? 'Falha ao criar desafio.' };
  return { id: (data as { id: string }).id };
}

export async function updateFriendlyChallengeStatus(
  id: string,
  status: FriendlyChallengeStatus,
): Promise<{ ok: true } | { error: string }> {
  const sb = getSupabase();
  if (!sb) return { error: 'Sem cliente.' };
  const { error } = await sb.from('friendly_challenges').update({ status } as never).eq('id', id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function markFriendlyChallengeExpiredIfNeeded(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const row = await fetchFriendlyChallengeById(id);
  if (!row || row.status !== 'pending') return;
  if (new Date(row.expires_at).getTime() > Date.now()) return;
  await updateFriendlyChallengeStatus(id, 'expired');
}

export function subscribeFriendlyChallengeUpdates(
  challengeId: string,
  onRow: (row: FriendlyChallengeRow) => void,
): RealtimeChannel {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase não configurado');
  const channel = sb
    .channel(`friendly-challenge-${challengeId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'friendly_challenges',
        filter: `id=eq.${challengeId}`,
      },
      (payload) => {
        const n = payload.new as FriendlyChallengeRow;
        if (n?.id) onRow(n);
      },
    )
    .subscribe();
  return channel;
}

export function subscribeIncomingFriendlyChallenges(
  challengedClubId: string,
  onInsert: (row: FriendlyChallengeRow) => void,
): RealtimeChannel {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase não configurado');
  const channel = sb
    .channel(`friendly-incoming-${challengedClubId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'friendly_challenges',
        filter: `challenged_club_id=eq.${challengedClubId}`,
      },
      (payload) => {
        const n = payload.new as FriendlyChallengeRow;
        if (n?.id && n.status === 'pending') onInsert(n);
      },
    )
    .subscribe();
  return channel;
}

export function unsubscribeChannel(ch: RealtimeChannel | null) {
  if (!ch) return;
  void getSupabase()?.removeChannel(ch);
}

export function participantClubIds(row: FriendlyChallengeRow): { challenger: string; challenged: string } {
  return { challenger: row.challenger_club_id, challenged: row.challenged_club_id };
}

export async function userParticipatesInChallenge(row: FriendlyChallengeRow): Promise<boolean> {
  const mine = await fetchProfileRemoteClubId();
  if (!mine) return false;
  return mine === row.challenger_club_id || mine === row.challenged_club_id;
}
