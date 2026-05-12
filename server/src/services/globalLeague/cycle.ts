import type { SupabaseClient } from '@supabase/supabase-js';
import type { TeamRow, RoundRow, FixtureRow, StateRow, CycleResult, FixtureStatus } from './types.js';
import { simulateFixture, updateTeamRow, effectiveOverall } from './simulate.js';

const ROUND_INTERVAL_MS = 5 * 60 * 1000;
const SIM_DURATION_MS = 90_000;
const STALE_LIVE_ROUND_MS = 10 * 60 * 1000;
const NEW_ID = () => 'gf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

function nextKickoff(fromMs: number): number {
  return Math.ceil((fromMs + 1000) / ROUND_INTERVAL_MS) * ROUND_INTERVAL_MS;
}

function generatePlayoffFixtures(teams: TeamRow[], seasonId: string, nowMs: number) {
  const rounds: Omit<RoundRow, 'actual_kickoff_ms' | 'finished_at_ms'>[] = [];
  const fixtures: Omit<FixtureRow, 'kickoff_ms' | 'finished_at_ms'>[] = [];
  const n = teams.length;
  if (n < 2) return { rounds, fixtures };
  let lastKickoff = nowMs;
  for (let rn = 1; rn <= 6; rn++) {
    const isReturn = rn > 3;
    const phase = rn <= 2 ? 'round_1' : rn <= 4 ? 'round_2' : 'round_3';
    const kickoffMs = nextKickoff(lastKickoff + (rn === 1 ? 0 : 60_000));
    lastKickoff = kickoffMs;
    const roundId = 'playoff_' + seasonId + '_' + rn;
    rounds.push({ id: roundId, season_id: seasonId, round_number: rn,
      round_type: 'playoff', phase, is_returning: isReturn, status: 'scheduled', scheduled_kickoff_ms: kickoffMs } as Omit<RoundRow, 'actual_kickoff_ms' | 'finished_at_ms'>);
    const half = Math.floor(n / 2);
    const turnRound = isReturn ? rn - 3 : rn;
    const rotated = [...teams];
    for (let r = 1; r < turnRound; r++) { const last = rotated.pop()!; rotated.splice(1, 0, last); }
    for (let i = 0; i < half; i++) {
      let home = rotated[i]!, away = rotated[n - 1 - i]!;
      if (isReturn) [home, away] = [away, home];
      fixtures.push({ id: NEW_ID(), round_id: roundId, division: 'playoff',
        home_team_id: home.id, away_team_id: away.id,
        home_team_name: home.club_name, away_team_name: away.club_name,
        home_overall: home.overall, away_overall: away.overall,
        score_home: 0, score_away: 0, current_minute: 0, status: 'scheduled' });
    }
  }
  return { rounds, fixtures };
}

function distributeIntoDivisions(teams: TeamRow[]): TeamRow[] {
  const sorted = [...teams].sort((a, b) => {
    if (b.playoff_points !== a.playoff_points) return b.playoff_points - a.playoff_points;
    if (b.playoff_wins !== a.playoff_wins) return b.playoff_wins - a.playoff_wins;
    return a.club_name.localeCompare(b.club_name);
  });
  const perDiv = Math.ceil(teams.length / 3);
  return sorted.map((t, i) => ({ ...t,
    division: Math.min(Math.floor(i / perDiv) + 1, 3),
    position: (i % perDiv) + 1 }));
}

function generateLeagueFixtures(teams: TeamRow[], seasonId: string, nowMs: number) {
  const rounds: Omit<RoundRow, 'actual_kickoff_ms' | 'finished_at_ms'>[] = [];
  const fixtures: Omit<FixtureRow, 'kickoff_ms' | 'finished_at_ms'>[] = [];
  const byDiv = new Map<number, TeamRow[]>();
  for (const t of teams) {
    if (!t.division) continue;
    if (!byDiv.has(t.division)) byDiv.set(t.division, []);
    byDiv.get(t.division)!.push(t);
  }
  const divsWithMatches = [...byDiv.values()].filter(d => d.length >= 2);
  if (divsWithMatches.length === 0) return { rounds, fixtures };
  const maxN = Math.max(...divsWithMatches.map(d => d.length));
  const totalRounds = (maxN - 1) * 2;
  let lastKickoff = nowMs;
  for (let rn = 1; rn <= totalRounds; rn++) {
    const isReturn = rn > maxN - 1;
    const kickoffMs = nextKickoff(lastKickoff + (rn === 1 ? 0 : 60_000));
    lastKickoff = kickoffMs;
    const roundId = 'league_' + seasonId + '_' + rn;
    rounds.push({ id: roundId, season_id: seasonId, round_number: rn,
      round_type: 'league', phase: null, is_returning: isReturn, status: 'scheduled', scheduled_kickoff_ms: kickoffMs } as Omit<RoundRow, 'actual_kickoff_ms' | 'finished_at_ms'>);
    for (const [, divTeams] of byDiv) {
      const n = divTeams.length;
      if (n < 2) continue;
      const half = Math.floor(n / 2);
      const turnRound = isReturn ? rn - (maxN - 1) : rn;
      const rotated = [...divTeams];
      for (let r = 1; r < turnRound; r++) { const last = rotated.pop()!; rotated.splice(1, 0, last); }
      for (let i = 0; i < half; i++) {
        let home = rotated[i]!, away = rotated[n - 1 - i]!;
        if (isReturn) [home, away] = [away, home];
        fixtures.push({ id: NEW_ID(), round_id: roundId, division: String(home.division),
          home_team_id: home.id, away_team_id: away.id,
          home_team_name: home.club_name, away_team_name: away.club_name,
          home_overall: home.overall, away_overall: away.overall,
          score_home: 0, score_away: 0, current_minute: 0, status: 'scheduled' });
      }
    }
  }
  return { rounds, fixtures };
}

export async function runGlobalLeagueCycle(sb: SupabaseClient): Promise<CycleResult> {
  const now = Date.now();
  const { data: stateData, error: stateErr } = await sb
    .from('global_league_state').select('*').eq('id', 'current').maybeSingle();
  if (stateErr || !stateData) {
    console.error('[cycle] load-state failed:', stateErr?.message);
    return { ok: false, step: 'load-state', error: stateErr?.message ?? 'no state' };
  }
  const state = stateData as StateRow;

  const recovered = await recoverStaleLiveRound(sb, now);
  if (recovered) return recovered;

  if (state.status === 'waiting_teams') {
    const { data: teamsData } = await sb.from('global_league_teams').select('*');
    const teams = (teamsData as TeamRow[]) ?? [];
    if (teams.length < state.min_teams_required || teams.length < 2) {
      return { ok: true, step: 'auto-start', skipped: true,
        reason: 'need ' + state.min_teams_required + ' teams, have ' + teams.length };
    }
    const { data: existingRounds } = await sb
      .from('global_league_rounds').select('id').eq('season_id', state.season_id).limit(1);
    if (existingRounds && existingRounds.length > 0) {
      await sb.from('global_league_state')
        .update({ status: 'playoffs', current_playoff_round: 1 }).eq('id', 'current');
      return { ok: true, step: 'auto-start', reason: 'promoted-existing-rounds' };
    }
    const { rounds, fixtures } = generatePlayoffFixtures(teams, state.season_id, now);
    if (rounds.length === 0) return { ok: true, step: 'auto-start', skipped: true, reason: 'gen-empty' };
    await sb.from('global_league_rounds').upsert(rounds as never[], { onConflict: 'id' });
    if (fixtures.length > 0) await sb.from('global_league_fixtures').upsert(fixtures as never[], { onConflict: 'id' });
    await sb.from('global_league_state')
      .update({ status: 'playoffs', current_playoff_round: 1 }).eq('id', 'current');
    return { ok: true, step: 'auto-start', rounds: rounds.length, fixtures: fixtures.length };
  }

  if (state.status === 'playoffs') {
    const { data: pRounds } = await sb.from('global_league_rounds').select('id,status,round_type')
      .eq('season_id', state.season_id).eq('round_type', 'playoff');
    const allDone = (pRounds ?? []).length > 0 && (pRounds ?? []).every((r: { status: string }) => r.status === 'finished');
    if (allDone) {
      const { data: teamsData } = await sb.from('global_league_teams').select('*');
      const teams = (teamsData as TeamRow[]) ?? [];
      const distributed = distributeIntoDivisions(teams);
      const { rounds, fixtures } = generateLeagueFixtures(distributed, state.season_id, now);
      await sb.from('global_league_teams').upsert(distributed as never[], { onConflict: 'id' });
      if (rounds.length > 0) await sb.from('global_league_rounds').upsert(rounds as never[], { onConflict: 'id' });
      if (fixtures.length > 0) await sb.from('global_league_fixtures').upsert(fixtures as never[], { onConflict: 'id' });
      await sb.from('global_league_state').update({
        status: 'active', current_playoff_round: null,
        current_league_round: rounds.length > 0 ? 1 : null,
      }).eq('id', 'current');
      return { ok: true, step: 'transition-to-league', rounds: rounds.length, fixtures: fixtures.length };
    }
  }

  const { data: pending, error: pendingErr } = await sb
    .from('global_league_rounds').select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_kickoff_ms', now)
    .order('scheduled_kickoff_ms', { ascending: true })
    .limit(1);
  if (pendingErr) {
    console.error('[cycle] fetch-pending failed:', pendingErr.message);
    return { ok: false, step: 'fetch-pending', error: pendingErr.message };
  }
  if (!pending || pending.length === 0) {
    return { ok: true, step: 'idle', skipped: true, reason: 'no-pending-rounds' };
  }

  const round = pending[0] as RoundRow;
  const isPlayoff = round.round_type === 'playoff';

  const { count: lockCount } = await sb
    .from('global_league_rounds')
    .update({ status: 'live', actual_kickoff_ms: now }, { count: 'exact' })
    .eq('id', round.id).eq('status', 'scheduled');
  if (!lockCount || lockCount === 0) {
    return { ok: true, step: 'skip-duplicate', skipped: true, roundId: round.id };
  }

  const { data: fixturesData, error: fxErr } = await sb
    .from('global_league_fixtures').select('*').eq('round_id', round.id);
  if (fxErr || !fixturesData) {
    console.error('[cycle] fetch-fixtures failed:', fxErr?.message);
    await sb.from('global_league_rounds').update({ status: 'scheduled' }).eq('id', round.id);
    return { ok: false, step: 'fetch-fixtures', error: fxErr?.message };
  }

  const teamIds = new Set<string>();
  for (const fx of fixturesData as FixtureRow[]) { teamIds.add(fx.home_team_id); teamIds.add(fx.away_team_id); }
  const { data: preTeams } = await sb.from('global_league_teams').select('*').in('id', [...teamIds]);
  const teamById = new Map<string, TeamRow>();
  for (const t of (preTeams as TeamRow[] | null) ?? []) teamById.set(t.id, t);

  const fixturesUpdated: FixtureRow[] = [];
  const eventsToInsert: object[] = [];
  const teamDelta = new Map<string, { gf: number; ga: number }>();
  const newInjuries = new Map<string, { modifier: number; rounds: number }>();
  const yellowsThisRound = new Map<string, number>();

  for (const fx of fixturesData as FixtureRow[]) {
    const home = teamById.get(fx.home_team_id);
    const away = teamById.get(fx.away_team_id);
    const effH = home ? effectiveOverall(home) : fx.home_overall;
    const effA = away ? effectiveOverall(away) : fx.away_overall;
    let sim;
    try { sim = simulateFixture(fx, effH, effA, now); }
    catch (err) {
      console.error('[cycle] simulate failed for fixture ' + fx.id + ':', err);
      // Mantém 'scheduled' para permitir retry no próximo ciclo
      fixturesUpdated.push({ ...fx, status: 'scheduled' }); continue;
    }
    fixturesUpdated.push({ ...fx, score_home: sim.score_home, score_away: sim.score_away,
      status: 'finished', kickoff_ms: now, finished_at_ms: now + SIM_DURATION_MS });
    for (const ev of sim.events) eventsToInsert.push(ev);
    const ha = teamDelta.get(fx.home_team_id) ?? { gf: 0, ga: 0 };
    ha.gf += sim.score_home; ha.ga += sim.score_away; teamDelta.set(fx.home_team_id, ha);
    const aa = teamDelta.get(fx.away_team_id) ?? { gf: 0, ga: 0 };
    aa.gf += sim.score_away; aa.ga += sim.score_home; teamDelta.set(fx.away_team_id, aa);
    if (sim.injured_side) {
      const injId = sim.injured_side === 'home' ? fx.home_team_id : fx.away_team_id;
      const modifier = -(2 + Math.floor(Math.random() * 3));
      const rounds = 1 + Math.floor(Math.random() * 2);
      const ex = newInjuries.get(injId);
      newInjuries.set(injId, { modifier: ex && ex.modifier < modifier ? ex.modifier : modifier,
        rounds: ex && ex.rounds > rounds ? ex.rounds : rounds });
    }
    if (sim.home_yellow) yellowsThisRound.set(fx.home_team_id, (yellowsThisRound.get(fx.home_team_id) ?? 0) + 1);
    if (sim.away_yellow) yellowsThisRound.set(fx.away_team_id, (yellowsThisRound.get(fx.away_team_id) ?? 0) + 1);
  }

  if (fixturesUpdated.length > 0) {
    const { error: fxUpErr } = await sb.from('global_league_fixtures').upsert(fixturesUpdated as never[], { onConflict: 'id' });
    if (fxUpErr) console.error('[cycle] fixtures upsert failed:', fxUpErr.message);
  }
  if (eventsToInsert.length > 0) {
    const { error: evErr } = await sb.from('global_league_events').upsert(eventsToInsert as never[], { onConflict: 'id' });
    if (evErr) console.error('[cycle] events upsert failed:', evErr.message);
  }

  if (teamById.size > 0) {
    const updated = [...teamById.values()].map((t) => {
      const d = teamDelta.get(t.id);
      let next = d ? updateTeamRow(t, d.gf, d.ga, isPlayoff) : t;
      if (next.suspension_rounds_remaining > 0)
        next = { ...next, suspension_rounds_remaining: next.suspension_rounds_remaining - 1 };
      const newYellows = yellowsThisRound.get(next.id) ?? 0;
      if (newYellows > 0) {
        const total = (next.yellow_card_count ?? 0) + newYellows;
        next = total >= 3
          ? { ...next, yellow_card_count: 0, suspension_rounds_remaining: (next.suspension_rounds_remaining ?? 0) + 1 }
          : { ...next, yellow_card_count: total };
      }
      if (next.injury_rounds_remaining > 0) {
        const rem = next.injury_rounds_remaining - 1;
        next = { ...next, injury_rounds_remaining: rem, injury_modifier: rem === 0 ? 0 : next.injury_modifier };
      }
      const fresh = newInjuries.get(next.id);
      if (fresh) next = { ...next,
        injury_modifier: next.injury_modifier < fresh.modifier ? next.injury_modifier : fresh.modifier,
        injury_rounds_remaining: next.injury_rounds_remaining > fresh.rounds ? next.injury_rounds_remaining : fresh.rounds };
      return next;
    });
    const { error: teamsErr } = await sb.from('global_league_teams').upsert(updated as never[], { onConflict: 'id' });
    if (teamsErr) console.error('[cycle] teams upsert failed:', teamsErr.message);
  }

  await sb.from('global_league_rounds')
    .update({ status: 'finished', finished_at_ms: now + SIM_DURATION_MS }).eq('id', round.id);
  const stateUpdate: Record<string, unknown> = {};
  if (isPlayoff) stateUpdate.current_playoff_round = round.round_number + 1;
  else stateUpdate.current_league_round = round.round_number + 1;
  await sb.from('global_league_state').update(stateUpdate).eq('id', 'current');

  console.log('[cycle] process-round: ' + round.id + ' (' + round.round_type + ' #' + round.round_number + '), ' + fixturesUpdated.length + ' fixtures, ' + eventsToInsert.length + ' events');
  return { ok: true, step: 'process-round', roundId: round.id, fixtures: fixturesUpdated.length, events: eventsToInsert.length };
}

export async function recoverStaleLiveRound(
  sb: SupabaseClient,
  now = Date.now(),
): Promise<CycleResult | null> {
  const staleBefore = now - STALE_LIVE_ROUND_MS;
  const { data: staleRounds, error } = await sb
    .from('global_league_rounds')
    .select('*')
    .eq('status', 'live')
    .lte('actual_kickoff_ms', staleBefore)
    .order('actual_kickoff_ms', { ascending: true })
    .limit(1);

  if (error) {
    console.error('[cycle] stale-live lookup failed:', error.message);
    return { ok: false, step: 'recover-stale-live', error: error.message };
  }
  if (!staleRounds || staleRounds.length === 0) return null;

  const round = staleRounds[0] as RoundRow;
  const { data: fixtures, error: fxErr } = await sb
    .from('global_league_fixtures')
    .select('id,status')
    .eq('round_id', round.id);

  if (fxErr) {
    console.error('[cycle] stale-live fixtures lookup failed:', fxErr.message);
    return { ok: false, step: 'recover-stale-live', roundId: round.id, error: fxErr.message };
  }

  const fixtureRows = (fixtures ?? []) as Array<{ id: string; status: FixtureStatus }>;
  const finishedCount = fixtureRows.filter(f => f.status === 'finished').length;
  const liveCount = fixtureRows.filter(f => f.status === 'live').length;

  if (fixtureRows.length > 0 && finishedCount === fixtureRows.length) {
    await sb
      .from('global_league_rounds')
      .update({ status: 'finished', finished_at_ms: now })
      .eq('id', round.id)
      .eq('status', 'live');

    const stateUpdate: Record<string, unknown> = {};
    if (round.round_type === 'playoff') stateUpdate.current_playoff_round = round.round_number + 1;
    else stateUpdate.current_league_round = round.round_number + 1;
    await sb.from('global_league_state').update(stateUpdate).eq('id', 'current');

    return {
      ok: true,
      step: 'recover-stale-live',
      roundId: round.id,
      fixtures: fixtureRows.length,
      reason: 'round was live but all fixtures were already finished',
    };
  }

  if (finishedCount === 0) {
    if (liveCount > 0) {
      await sb
        .from('global_league_fixtures')
        .update({ status: 'scheduled', kickoff_ms: null })
        .eq('round_id', round.id)
        .neq('status', 'finished');
    }

    await sb
      .from('global_league_rounds')
      .update({ status: 'scheduled', actual_kickoff_ms: null })
      .eq('id', round.id)
      .eq('status', 'live');

    return {
      ok: true,
      step: 'recover-stale-live',
      roundId: round.id,
      fixtures: fixtureRows.length,
      reason: 'round lock was stale before any fixture finished; reset for retry',
    };
  }

  return {
    ok: true,
    step: 'recover-stale-live',
    skipped: true,
    roundId: round.id,
    fixtures: fixtureRows.length,
    reason: `mixed fixture state (${finishedCount}/${fixtureRows.length} finished); manual audit required`,
  };
}

export async function enrollClubInGlobalLeague(
  sb: SupabaseClient,
  opts: { managerId: string; clubName: string; clubShort: string; overall: number },
): Promise<{ ok: boolean; teamId?: string; error?: string }> {
  const { data: existing } = await sb
    .from('global_league_teams')
    .select('*')
    .eq('manager_id', opts.managerId)
    .maybeSingle();
  const existingTeam = existing as TeamRow | null;
  const teamId = existingTeam?.id ?? ('gt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
  const team: TeamRow = {
    ...(existingTeam ?? {
      division: null, position: null, previous_position: null,
      playoff_points: 0, playoff_matches_played: 0, playoff_wins: 0,
      playoff_draws: 0, playoff_losses: 0, playoff_goals_for: 0, playoff_goals_against: 0,
      points: 0, matches_played: 0, wins: 0, draws: 0, losses: 0,
      goals_for: 0, goals_against: 0, goal_difference: 0,
      recent_form: [], injury_modifier: 0, injury_rounds_remaining: 0,
      yellow_card_count: 0, suspension_rounds_remaining: 0,
      all_time_points: 0, all_time_matches_played: 0, all_time_wins: 0,
      all_time_draws: 0, all_time_losses: 0, all_time_goals_for: 0,
      all_time_goals_against: 0, all_time_seasons_played: 0,
    }),
    id: teamId, manager_id: opts.managerId,
    club_name: opts.clubName, club_short: opts.clubShort, overall: opts.overall,
  };
  const { error } = await sb.from('global_league_teams').upsert(team as never, { onConflict: 'manager_id' });
  if (error) { console.error('[enrollClub] failed:', error.message); return { ok: false, error: error.message }; }
  console.log('[enrollClub] ' + opts.clubName + ' (' + opts.managerId + ') enrolled, id=' + teamId);
  return { ok: true, teamId };
}
