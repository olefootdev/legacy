import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const DEFAULT_SLOTS = ['05:30', '11:00', '15:00', '19:00', '21:30'];
const STALE_LIVE_ROUND_MS = 10 * 60 * 1000;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface ProfileRow {
  id: string;
  display_name: string | null;
  club_name: string | null;
  club_short: string | null;
  onboarding_data: unknown;
}

interface SquadRow {
  user_id: string;
  players: unknown;
  lineup: Record<string, string> | null;
}

interface TeamRow {
  id: string;
  manager_id: string;
  club_name: string;
  club_short: string;
  overall: number;
  division: number | null;
  position: number | null;
  previous_position: number | null;
  playoff_points: number;
  playoff_matches_played: number;
  playoff_wins: number;
  playoff_draws: number;
  playoff_losses: number;
  playoff_goals_for: number;
  playoff_goals_against: number;
  points: number;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  recent_form: ('W' | 'D' | 'L')[];
  injury_modifier: number;
  injury_rounds_remaining: number;
  yellow_card_count: number;
  suspension_rounds_remaining: number;
  all_time_points: number;
  all_time_matches_played: number;
  all_time_wins: number;
  all_time_draws: number;
  all_time_losses: number;
  all_time_goals_for: number;
  all_time_goals_against: number;
  all_time_seasons_played: number;
}

function argValue(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function managerEmailFromProfile(profile: ProfileRow): string | null {
  const data = profile.onboarding_data as { managerProfile?: { email?: unknown } } | null;
  const email = data?.managerProfile?.email;
  return typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null;
}

function cleanShortName(value: string | null | undefined, fallback: string): string {
  const raw = (value || fallback || 'FC').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase();
  return raw || 'FC';
}

function avgOverallFromSquad(squad?: SquadRow): number {
  if (!squad || !Array.isArray(squad.players)) return 42;
  const players = squad.players as Array<{ id?: string; attrs?: Record<string, unknown> }>;
  const lineupIds = Object.values(squad.lineup ?? {});
  const selected = lineupIds.length > 0
    ? lineupIds.map(id => players.find(p => p.id === id)).filter((p): p is { attrs?: Record<string, unknown> } => !!p)
    : players;
  const ovrs = selected
    .map((p) => {
      const nums = Object.values(p.attrs ?? {}).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      return nums.length > 0 ? Math.round(nums.reduce((sum, n) => sum + n, 0) / nums.length) : null;
    })
    .filter((n): n is number => n != null);
  if (ovrs.length === 0) return 42;
  return Math.max(40, Math.min(99, Math.round(ovrs.reduce((sum, n) => sum + n, 0) / ovrs.length)));
}

function teamFromProfile(profile: ProfileRow, squad?: SquadRow, existing?: TeamRow): TeamRow {
  const managerId = managerEmailFromProfile(profile) ?? profile.id;
  const clubName = profile.club_name?.trim() || profile.display_name?.trim() || 'Olefoot FC';
  const clubShort = cleanShortName(profile.club_short, clubName);
  const base: TeamRow = existing ?? {
    id: 'gt_' + managerId.replace(/[^a-z0-9]/gi, '_'),
    manager_id: managerId,
    club_name: clubName,
    club_short: clubShort,
    overall: avgOverallFromSquad(squad),
    division: null,
    position: null,
    previous_position: null,
    playoff_points: 0,
    playoff_matches_played: 0,
    playoff_wins: 0,
    playoff_draws: 0,
    playoff_losses: 0,
    playoff_goals_for: 0,
    playoff_goals_against: 0,
    points: 0,
    matches_played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    goal_difference: 0,
    recent_form: [],
    injury_modifier: 0,
    injury_rounds_remaining: 0,
    yellow_card_count: 0,
    suspension_rounds_remaining: 0,
    all_time_points: 0,
    all_time_matches_played: 0,
    all_time_wins: 0,
    all_time_draws: 0,
    all_time_losses: 0,
    all_time_goals_for: 0,
    all_time_goals_against: 0,
    all_time_seasons_played: 0,
  };

  return {
    ...base,
    manager_id: managerId,
    club_name: clubName,
    club_short: clubShort,
    overall: avgOverallFromSquad(squad) || base.overall,
  };
}

async function recoverStaleLiveRounds() {
  let recovered = 0;
  for (;;) {
    const staleBefore = Date.now() - STALE_LIVE_ROUND_MS;
    const { data: rounds, error } = await sb
      .from('global_league_rounds')
      .select('*')
      .eq('status', 'live')
      .lte('actual_kickoff_ms', staleBefore)
      .order('actual_kickoff_ms', { ascending: true })
      .limit(1);
    if (error) throw error;
    if (!rounds || rounds.length === 0) return recovered;

    const round = rounds[0] as { id: string };
    const { data: fixtures, error: fxErr } = await sb
      .from('global_league_fixtures')
      .select('id,status')
      .eq('round_id', round.id);
    if (fxErr) throw fxErr;

    const rows = (fixtures ?? []) as Array<{ status: string }>;
    const finished = rows.filter(f => f.status === 'finished').length;

    if (rows.length > 0 && finished === rows.length) {
      await sb.from('global_league_rounds').update({ status: 'finished', finished_at_ms: Date.now() }).eq('id', round.id);
    } else if (finished === 0) {
      await sb.from('global_league_fixtures').update({ status: 'scheduled', kickoff_ms: null }).eq('round_id', round.id).neq('status', 'finished');
      await sb.from('global_league_rounds').update({ status: 'scheduled', actual_kickoff_ms: null }).eq('id', round.id);
    } else {
      throw new Error(`Rodada ${round.id} em estado misto; auditoria manual necessaria.`);
    }
    recovered += 1;
  }
}

async function backfillTeams() {
  const [{ data: profiles, error: profilesErr }, { data: squads, error: squadsErr }, { data: existing, error: teamsErr }] =
    await Promise.all([
      sb.from('profiles').select('id, display_name, club_name, club_short, onboarding_data').order('created_at', { ascending: true }),
      sb.from('manager_squad').select('user_id, players, lineup'),
      sb.from('global_league_teams').select('*'),
    ]);

  if (profilesErr) throw profilesErr;
  if (squadsErr) throw squadsErr;
  if (teamsErr) throw teamsErr;

  const squadByUser = new Map(((squads as SquadRow[] | null) ?? []).map(s => [s.user_id, s]));
  const existingByManager = new Map(((existing as TeamRow[] | null) ?? []).map(t => [t.manager_id, t]));
  const teams = ((profiles as ProfileRow[] | null) ?? [])
    .filter(profile => !!profile.club_name?.trim())
    .map(profile => {
      const managerId = managerEmailFromProfile(profile) ?? profile.id;
      return teamFromProfile(profile, squadByUser.get(profile.id), existingByManager.get(managerId));
    });

  if (teams.length > 0) {
    const { error } = await sb.from('global_league_teams').upsert(teams as never[], { onConflict: 'manager_id' });
    if (error) throw error;
  }

  return { profiles: profiles?.length ?? 0, upserted: teams.length, inserted: teams.filter(t => !existingByManager.has(t.manager_id)).length };
}

async function startSeason() {
  const seasonName = argValue('name', `OLEFOOT GLOBAL 10D ${new Date().toISOString().slice(0, 10)}`);
  const durationDays = Number(argValue('days', '10'));
  const slots = argValue('slots', DEFAULT_SLOTS.join(',')).split(',').map(s => s.trim()).filter(Boolean);
  const slotDurationMin = Number(argValue('slotDurationMin', '30'));
  const minTeamsRequired = Number(argValue('minTeamsRequired', '2'));
  const seasonId = `season_${Date.now()}`;

  const { data: state } = await sb.from('global_league_state').select('season_id').eq('id', 'current').maybeSingle();
  if (state?.season_id) {
    const { data: rounds } = await sb.from('global_league_rounds').select('id').eq('season_id', state.season_id);
    const roundIds = (rounds ?? []).map((r: { id: string }) => r.id);
    if (roundIds.length > 0) {
      const { data: fixtures } = await sb.from('global_league_fixtures').select('id').in('round_id', roundIds);
      const fixtureIds = (fixtures ?? []).map((f: { id: string }) => f.id);
      if (fixtureIds.length > 0) {
        await sb.from('global_league_events').delete().in('fixture_id', fixtureIds);
        await sb.from('global_league_fixtures').delete().in('id', fixtureIds);
      }
      await sb.from('global_league_rounds').delete().in('id', roundIds);
    }
  }

  const { error: resetErr } = await sb.from('global_league_teams').update({
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    goal_difference: 0,
    matches_played: 0,
    playoff_points: 0,
    playoff_wins: 0,
    playoff_draws: 0,
    playoff_losses: 0,
    playoff_goals_for: 0,
    playoff_goals_against: 0,
    playoff_matches_played: 0,
    division: null,
    position: null,
    previous_position: null,
  }).neq('id', '00000000-0000-0000-0000-000000000000');
  if (resetErr) throw resetErr;

  const nowIso = new Date().toISOString();
  const { error: stateErr } = await sb.from('global_league_state').upsert({
    id: 'current',
    status: 'waiting_teams',
    season_id: seasonId,
    season_name: seasonName,
    competition_started_at: nowIso,
    competition_duration_days: durationDays,
    competition_id: `competition_${Date.now()}`,
    match_slots: slots,
    slot_duration_min: slotDurationMin,
    min_teams_required: minTeamsRequired,
    current_playoff_round: null,
    current_league_round: null,
  });
  if (stateErr) throw stateErr;

  return { seasonId, seasonName, durationDays, slots, slotDurationMin, minTeamsRequired, startedAt: nowIso };
}

async function main() {
  console.log('Global League season start');
  const recovered = await recoverStaleLiveRounds();
  console.log(`Recovered stale live rounds: ${recovered}`);
  const backfill = await backfillTeams();
  console.log(`Backfill: ${JSON.stringify(backfill)}`);
  const season = await startSeason();
  console.log(`Season started: ${JSON.stringify(season)}`);
  console.log('Cron/Edge will auto-create playoff rounds on the next tick.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
