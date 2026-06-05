import { getSupabase } from '@/supabase/client';

export interface PremiumLeague {
  id: string;
  name: string;
  slug: string;
  creator_club_name: string;
  creator_type: 'manager' | 'admin';
  max_teams: number;
  current_teams: number;
  entry_fee: number;
  currency: 'EXP' | 'OLE' | 'BRO';
  total_pool: number;
  status: 'open' | 'live' | 'finished' | 'cancelled';
  current_round: number | null;
  total_rounds: number | null;
  invite_code: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface PremiumLeagueEntry {
  id: string;
  league_id: string;
  user_id: string;
  club_name: string;
  club_short: string | null;
  overall: number;
  fee_paid: number;
  currency: string;
  entered_at: string;
}

export interface PremiumLeagueFixture {
  id: string;
  league_id: string;
  round: number;
  match_index: number;
  home_entry_id: string | null;
  away_entry_id: string | null;
  home_club_name: string | null;
  away_club_name: string | null;
  home_overall: number;
  away_overall: number;
  score_home: number | null;
  score_away: number | null;
  penalty_home: number | null;
  penalty_away: number | null;
  went_to_penalties: boolean;
  winner_entry_id: string | null;
  status: 'pending' | 'live' | 'finished';
}

export interface PremiumLeagueChampion {
  id: string;
  league_id: string;
  rank: number;
  user_id: string;
  club_name: string;
  prize_amount: number;
  currency: string;
}

export async function fetchOpenLeagues(): Promise<PremiumLeague[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('premium_leagues')
    .select('*')
    .in('status', ['open', 'live'])
    .order('created_at', { ascending: false });
  return (data ?? []) as PremiumLeague[];
}

export async function fetchMyLeagues(): Promise<PremiumLeague[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const { data: entries } = await sb
    .from('premium_league_entries')
    .select('league_id')
    .eq('user_id', user.id);

  if (!entries || entries.length === 0) return [];
  const ids = entries.map((e) => e.league_id);

  const { data } = await sb
    .from('premium_leagues')
    .select('*')
    .in('id', ids)
    .order('created_at', { ascending: false });
  return (data ?? []) as PremiumLeague[];
}

export async function fetchLeagueDetail(leagueId: string): Promise<{
  league: PremiumLeague;
  entries: PremiumLeagueEntry[];
  fixtures: PremiumLeagueFixture[];
  champions: PremiumLeagueChampion[];
} | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const [leagueRes, entriesRes, fixturesRes, championsRes] = await Promise.all([
    sb.from('premium_leagues').select('*').eq('id', leagueId).maybeSingle(),
    sb.from('premium_league_entries').select('*').eq('league_id', leagueId).order('entered_at'),
    sb.from('premium_league_fixtures').select('*').eq('league_id', leagueId).order('round').order('match_index'),
    sb.from('premium_league_champions').select('*').eq('league_id', leagueId).order('rank'),
  ]);

  if (!leagueRes.data) return null;
  return {
    league: leagueRes.data as PremiumLeague,
    entries: (entriesRes.data ?? []) as PremiumLeagueEntry[],
    fixtures: (fixturesRes.data ?? []) as PremiumLeagueFixture[],
    champions: (championsRes.data ?? []) as PremiumLeagueChampion[],
  };
}

export async function createLeague(input: {
  name: string;
  maxTeams: 16 | 32 | 64;
  entryFee: number;
  clubName: string;
  clubShort?: string;
}): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Supabase não configurado' };
  const { data, error } = await sb.rpc('create_premium_league', {
    p_name: input.name,
    p_max_teams: input.maxTeams,
    p_entry_fee: input.entryFee,
    p_currency: 'EXP',
    p_club_name: input.clubName,
    p_club_short: input.clubShort ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

const JOIN_ERROR_MAP: Record<string, string> = {
  'league is full': 'Liga completa! Todas as vagas foram preenchidas.',
  'league is not open for entries': 'Liga já iniciou — inscrições encerradas.',
  'already entered this league': 'Você já está inscrito nesta liga.',
  'must be authenticated': 'Faça login para se inscrever.',
};

export async function joinLeague(input: {
  leagueId: string;
  clubName: string;
  clubShort?: string;
  overall?: number;
}): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Supabase não configurado' };
  const { data, error } = await sb.rpc('join_premium_league', {
    p_league_id: input.leagueId,
    p_club_name: input.clubName,
    p_club_short: input.clubShort ?? null,
    p_overall: input.overall ?? 50,
  });
  if (error) return { ok: false, error: JOIN_ERROR_MAP[error.message] ?? error.message };
  const result = Array.isArray(data) ? data[0] : data;
  if (result?.league_full) {
    await sb.rpc('start_premium_league', { p_league_id: input.leagueId });
  }
  return { ok: true, data: result };
}

export async function findLeagueByInvite(code: string): Promise<PremiumLeague | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.rpc('find_premium_league_by_invite', { p_code: code.trim() });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.found) return null;
  return row as unknown as PremiumLeague;
}

export async function findLeagueBySlug(slug: string): Promise<PremiumLeague | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const trimmed = slug.trim().toLowerCase();
  const { data } = await sb
    .from('premium_leagues')
    .select('*')
    .eq('slug', trimmed)
    .maybeSingle();
  if (data) return data as PremiumLeague;
  const { data: fuzzy } = await sb
    .from('premium_leagues')
    .select('*')
    .like('slug', `${trimmed}%`)
    .limit(1)
    .maybeSingle();
  return (fuzzy ?? null) as PremiumLeague | null;
}

export function inviteLinkForLeague(slug: string): string {
  return `${window.location.origin}/rewards/${slug}`;
}
