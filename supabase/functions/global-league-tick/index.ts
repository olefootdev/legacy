// deno-lint-ignore-file no-explicit-any
// Olefoot — global-league-tick v7: competição longa (carry-over de pontos).
//
// Acionada pelo pg_cron a cada 1 min. Faz o ciclo completo da Liga Global
// sem depender do servidor Railway (autoritativa).
//
// Fluxo:
//   0. Fim da competição (passou competition_duration_days) → hard reset, novo competition_id
//   1. waiting_teams + ≥ min teams → gera playoff rounds (auto-start) — em slots
//   2. playoffs com todas rodadas 'finished' → distribui em divisões + gera league
//   3. active com todas rodadas 'finished' → SOFT promo/rele (carry-over) + nova season
//   4. Processa próxima rodada 'scheduled' que já passou do kickoff (dentro de slot)
//
// Etapas implementadas:
//   - all-time stats (não zeram nunca)
//   - slots fixos por dia (default ['05:30','11:00','15:00','19:00','21:30'])
//   - competição longa (default 7 dias) com carry-over entre seasons

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ROUND_INTERVAL_MS = 5 * 60 * 1000;
const SIM_DURATION_MS = 90_000;
const NEW_ID = () => `gf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function slotStartMs(dayDate: Date, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(dayDate);
  d.setUTCHours(h, m, 0, 0);
  return d.getTime();
}

function nextSlotAlignedKickoff(fromMs: number, slots: string[], durationMin: number): number {
  if (!slots || slots.length === 0) {
    return Math.ceil((fromMs + 1000) / ROUND_INTERVAL_MS) * ROUND_INTERVAL_MS;
  }
  const durationMs = durationMin * 60_000;
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const day = new Date(fromMs);
    day.setUTCDate(day.getUTCDate() + dayOffset);
    day.setUTCHours(0, 0, 0, 0);
    const sortedSlots = [...slots].sort();
    for (const slot of sortedSlots) {
      const start = slotStartMs(day, slot);
      const end = start + durationMs;
      if (fromMs >= end) continue;
      const candidate = Math.max(fromMs, start);
      const aligned = Math.ceil((candidate + 1000) / ROUND_INTERVAL_MS) * ROUND_INTERVAL_MS;
      if (aligned < end) return aligned;
    }
  }
  return fromMs + ROUND_INTERVAL_MS;
}

function utcDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

interface FixtureRow {
  id: string; round_id: string; division: string;
  home_team_id: string; away_team_id: string;
  home_team_name: string; away_team_name: string;
  home_overall: number; away_overall: number;
  score_home: number; score_away: number;
  current_minute?: number; status: string;
  kickoff_ms?: number | null; finished_at_ms?: number | null;
}
interface RoundRow {
  id: string; season_id: string;
  round_number: number; round_type: 'playoff' | 'league';
  phase?: string | null; status: string;
  scheduled_kickoff_ms: number;
  actual_kickoff_ms: number | null; finished_at_ms: number | null;
}
interface TeamRow {
  id: string; manager_id: string;
  club_name: string; club_short: string;
  overall: number; division: number | null;
  position: number | null; previous_position: number | null;
  playoff_points: number; playoff_matches_played: number;
  playoff_wins: number; playoff_draws: number; playoff_losses: number;
  playoff_goals_for: number; playoff_goals_against: number;
  points: number; matches_played: number;
  wins: number; draws: number; losses: number;
  goals_for: number; goals_against: number; goal_difference: number;
  recent_form: ('W' | 'D' | 'L')[];
  injury_modifier: number; injury_rounds_remaining: number;
  all_time_points?: number; all_time_matches_played?: number;
  all_time_wins?: number; all_time_draws?: number; all_time_losses?: number;
  all_time_goals_for?: number; all_time_goals_against?: number;
  all_time_seasons_played?: number;
}
interface StateRow {
  id: string; season_id: string; season_name: string;
  status: 'waiting_teams' | 'playoffs' | 'active' | 'season_ended';
  current_playoff_round: number | null; current_league_round: number | null;
  min_teams_required: number; teams_per_division: number;
  promotion_percentage: number; relegation_percentage: number;
  match_slots: string[];
  slot_duration_min: number;
  current_olefoot_day: string;
  competition_started_at: string;
  competition_duration_days: number;
  competition_id: string;
}

function effectiveOverall(team: TeamRow): number {
  const mod = team.injury_rounds_remaining > 0 ? team.injury_modifier : 0;
  return Math.max(40, team.overall + mod);
}
function poissonGoals(expected: number): number {
  const L = Math.exp(-expected);
  let k = 0; let p = 1;
  do { k++; p *= Math.random(); } while (p > L && k < 8);
  return k - 1;
}

function generatePlayoffRoundsAndFixtures(
  teams: TeamRow[], seasonId: string, nowMs: number,
  slots: string[], slotDurationMin: number,
) {
  const rounds: any[] = [];
  const fixtures: any[] = [];
  const n = teams.length;
  if (n < 2) return { rounds, fixtures };
  let lastKickoff = nowMs;
  for (let roundNumber = 1; roundNumber <= 6; roundNumber++) {
    const isReturning = roundNumber > 3;
    const phase = roundNumber <= 2 ? 'round_1' : roundNumber <= 4 ? 'round_2' : 'round_3';
    const half = Math.floor(n / 2);
    const turnRound = isReturning ? roundNumber - 3 : roundNumber;
    const rotated = [...teams];
    for (let r = 1; r < turnRound; r++) {
      const last = rotated.pop()!;
      rotated.splice(1, 0, last);
    }
    const kickoffMs = nextSlotAlignedKickoff(lastKickoff + (roundNumber === 1 ? 0 : 60_000), slots, slotDurationMin);
    lastKickoff = kickoffMs;
    const roundId = `playoff_${seasonId}_${roundNumber}`;
    rounds.push({
      id: roundId, season_id: seasonId, round_number: roundNumber, round_type: 'playoff',
      phase, status: 'scheduled', scheduled_kickoff_ms: kickoffMs,
      actual_kickoff_ms: null, finished_at_ms: null,
    });
    for (let i = 0; i < half; i++) {
      let home = rotated[i]; let away = rotated[n - 1 - i];
      if (isReturning) [home, away] = [away, home];
      fixtures.push({
        id: NEW_ID(), round_id: roundId, division: 'playoff',
        home_team_id: home.id, away_team_id: away.id,
        home_team_name: home.club_name, away_team_name: away.club_name,
        home_overall: home.overall, away_overall: away.overall,
        score_home: 0, score_away: 0, current_minute: 0,
        status: 'scheduled', kickoff_ms: null, finished_at_ms: null,
      });
    }
  }
  return { rounds, fixtures };
}

function distributeIntoDivisions(teams: TeamRow[], totalDivisions = 3): TeamRow[] {
  const sorted = [...teams].sort((a, b) => {
    if (b.playoff_points !== a.playoff_points) return b.playoff_points - a.playoff_points;
    if (b.playoff_wins !== a.playoff_wins) return b.playoff_wins - a.playoff_wins;
    const aDiff = a.playoff_goals_for - a.playoff_goals_against;
    const bDiff = b.playoff_goals_for - b.playoff_goals_against;
    if (bDiff !== aDiff) return bDiff - aDiff;
    if (b.playoff_goals_for !== a.playoff_goals_for) return b.playoff_goals_for - a.playoff_goals_for;
    return a.club_name.localeCompare(b.club_name);
  });
  const teamsPerDivision = Math.ceil(teams.length / totalDivisions);
  return sorted.map((team, index) => ({
    ...team,
    division: Math.min(Math.floor(index / teamsPerDivision) + 1, totalDivisions),
    position: (index % teamsPerDivision) + 1,
  }));
}

function generateLeagueRoundsAndFixtures(
  teams: TeamRow[], seasonId: string, nowMs: number,
  slots: string[], slotDurationMin: number,
) {
  const rounds: any[] = [];
  const fixtures: any[] = [];
  const byDivision = new Map<number, TeamRow[]>();
  for (const team of teams) {
    if (!team.division) continue;
    if (!byDivision.has(team.division)) byDivision.set(team.division, []);
    byDivision.get(team.division)!.push(team);
  }
  const divsWithMatches = Array.from(byDivision.values()).filter(t => t.length >= 2);
  if (divsWithMatches.length === 0) return { rounds, fixtures };
  const maxTeamsInDiv = Math.max(...divsWithMatches.map(t => t.length));
  const totalRounds = (maxTeamsInDiv - 1) * 2;
  let lastKickoff = nowMs;
  for (let roundNumber = 1; roundNumber <= totalRounds; roundNumber++) {
    const isReturning = roundNumber > (maxTeamsInDiv - 1);
    const kickoffMs = nextSlotAlignedKickoff(lastKickoff + (roundNumber === 1 ? 0 : 60_000), slots, slotDurationMin);
    lastKickoff = kickoffMs;
    const roundId = `league_${seasonId}_${roundNumber}`;
    rounds.push({
      id: roundId, season_id: seasonId, round_number: roundNumber, round_type: 'league',
      phase: null, status: 'scheduled', scheduled_kickoff_ms: kickoffMs,
      actual_kickoff_ms: null, finished_at_ms: null,
    });
    for (const [, divTeams] of byDivision) {
      const n = divTeams.length;
      if (n < 2) continue;
      const half = Math.floor(n / 2);
      const turnRound = isReturning ? roundNumber - (maxTeamsInDiv - 1) : roundNumber;
      const rotated = [...divTeams];
      for (let r = 1; r < turnRound; r++) {
        const last = rotated.pop()!;
        rotated.splice(1, 0, last);
      }
      for (let i = 0; i < half; i++) {
        let home = rotated[i]; let away = rotated[n - 1 - i];
        if (isReturning) [home, away] = [away, home];
        fixtures.push({
          id: NEW_ID(), round_id: roundId, division: String(home.division),
          home_team_id: home.id, away_team_id: away.id,
          home_team_name: home.club_name, away_team_name: away.club_name,
          home_overall: home.overall, away_overall: away.overall,
          score_home: 0, score_away: 0, current_minute: 0,
          status: 'scheduled', kickoff_ms: null, finished_at_ms: null,
        });
      }
    }
  }
  return { rounds, fixtures };
}

// SOFT promo/rele — reorganiza divisões MAS PRESERVA pontos da competição
function applyPromotionRelegationSoft(
  teams: TeamRow[], promoPct: number, relePct: number, totalDivisions = 3,
): TeamRow[] {
  const byDivision = new Map<number, TeamRow[]>();
  for (const team of teams) {
    if (!team.division) continue;
    if (!byDivision.has(team.division)) byDivision.set(team.division, []);
    byDivision.get(team.division)!.push(team);
  }
  for (const [, divTeams] of byDivision) {
    divTeams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
      return a.club_name.localeCompare(b.club_name);
    });
  }
  const result: TeamRow[] = [];
  for (let division = 1; division <= totalDivisions; division++) {
    const divTeams = byDivision.get(division) ?? [];
    const promoCount = Math.ceil(divTeams.length * promoPct);
    const releCount = Math.ceil(divTeams.length * relePct);
    divTeams.forEach((team, index) => {
      let newDivision = division;
      if (division > 1 && index < promoCount) newDivision = division - 1;
      else if (division < totalDivisions && index >= divTeams.length - releCount) newDivision = division + 1;
      result.push({
        ...team,
        division: newDivision,
        playoff_points: 0, playoff_matches_played: 0, playoff_wins: 0, playoff_draws: 0,
        playoff_losses: 0, playoff_goals_for: 0, playoff_goals_against: 0,
        position: null,
        previous_position: team.position ?? null,
        all_time_seasons_played: (team.all_time_seasons_played ?? 0) + 1,
      });
    });
  }
  for (const team of teams) {
    if (!team.division) result.push({ ...team });
  }
  return result;
}

// HARD reset — fim da competição (zera tudo de season, all-time intacto)
function applyCompetitionReset(teams: TeamRow[]): TeamRow[] {
  return teams.map((team) => ({
    ...team,
    playoff_points: 0, playoff_matches_played: 0, playoff_wins: 0, playoff_draws: 0,
    playoff_losses: 0, playoff_goals_for: 0, playoff_goals_against: 0,
    points: 0, matches_played: 0, wins: 0, draws: 0, losses: 0,
    goals_for: 0, goals_against: 0, goal_difference: 0,
    recent_form: [], position: null, previous_position: null,
  }));
}

function simulateFixture(fx: FixtureRow, effHome: number, effAway: number, kickoffMs: number) {
  const homeAdvantage = 3;
  const diff = (effHome + homeAdvantage) - effAway;
  const homeExpected = Math.max(0.2, 1.4 + diff / 22);
  const awayExpected = Math.max(0.2, 1.4 - diff / 22);
  const homeGoals = poissonGoals(homeExpected);
  const awayGoals = poissonGoals(awayExpected);
  const events: any[] = [];
  const placeGoal = (side: 'home' | 'away', i: number, total: number) => {
    const minute = Math.max(1, Math.min(90, Math.floor((90 / (total + 1)) * (i + 1) + (Math.random() - 0.5) * 8)));
    const teamName = side === 'home' ? fx.home_team_name : fx.away_team_name;
    events.push({
      id: `evt_${fx.id}_${side}_g${i}_${kickoffMs}`,
      fixture_id: fx.id, event_type: 'goal', minute, side,
      text: `⚽ GOL! ${teamName} marca!`, highlight: true,
      timestamp_ms: kickoffMs + minute * 1000,
    });
  };
  for (let i = 0; i < homeGoals; i++) placeGoal('home', i, homeGoals);
  for (let i = 0; i < awayGoals; i++) placeGoal('away', i, awayGoals);
  let injured_side: 'home' | 'away' | null = null;
  if (Math.random() < 0.08) {
    injured_side = Math.random() < 0.5 ? 'home' : 'away';
    const minute = Math.floor(10 + Math.random() * 80);
    events.push({
      id: `evt_${fx.id}_${injured_side}_inj_${kickoffMs}`,
      fixture_id: fx.id, event_type: 'injury', minute, side: injured_side,
      text: '🚑 Jogador lesionado', highlight: false,
      timestamp_ms: kickoffMs + minute * 1000,
    });
  }
  events.sort((a, b) => (a.minute as number) - (b.minute as number));
  return { score_home: homeGoals, score_away: awayGoals, events, injured_side };
}

function updateTeamRow(team: TeamRow, gf: number, ga: number, isPlayoff: boolean): TeamRow {
  const isWin = gf > ga;
  const isDraw = gf === ga;
  const points = isWin ? 3 : isDraw ? 1 : 0;
  const result: 'W' | 'D' | 'L' = isWin ? 'W' : isDraw ? 'D' : 'L';
  const allTimeBase = {
    all_time_points: (team.all_time_points ?? 0) + points,
    all_time_matches_played: (team.all_time_matches_played ?? 0) + 1,
    all_time_wins: (team.all_time_wins ?? 0) + (isWin ? 1 : 0),
    all_time_draws: (team.all_time_draws ?? 0) + (isDraw ? 1 : 0),
    all_time_losses: (team.all_time_losses ?? 0) + (!isWin && !isDraw ? 1 : 0),
    all_time_goals_for: (team.all_time_goals_for ?? 0) + gf,
    all_time_goals_against: (team.all_time_goals_against ?? 0) + ga,
  };
  if (isPlayoff) {
    return {
      ...team, ...allTimeBase,
      playoff_points: team.playoff_points + points,
      playoff_matches_played: team.playoff_matches_played + 1,
      playoff_wins: team.playoff_wins + (isWin ? 1 : 0),
      playoff_draws: team.playoff_draws + (isDraw ? 1 : 0),
      playoff_losses: team.playoff_losses + (!isWin && !isDraw ? 1 : 0),
      playoff_goals_for: team.playoff_goals_for + gf,
      playoff_goals_against: team.playoff_goals_against + ga,
    };
  }
  const newForm = [...(team.recent_form ?? []), result].slice(-5);
  return {
    ...team, ...allTimeBase,
    points: team.points + points, matches_played: team.matches_played + 1,
    wins: team.wins + (isWin ? 1 : 0), draws: team.draws + (isDraw ? 1 : 0),
    losses: team.losses + (!isWin && !isDraw ? 1 : 0),
    goals_for: team.goals_for + gf, goals_against: team.goals_against + ga,
    goal_difference: team.goal_difference + (gf - ga),
    recent_form: newForm,
  };
}

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const now = Date.now();

  const { data: stateData, error: stateErr } = await supabase
    .from('global_league_state').select('*').eq('id', 'current').maybeSingle();
  if (stateErr || !stateData) {
    return new Response(JSON.stringify({ ok: false, step: 'load-state', error: stateErr?.message }), { status: 500 });
  }
  const state = stateData as StateRow;
  const slots: string[] = Array.isArray(state.match_slots) ? state.match_slots : ['05:30','11:00','15:00','19:00','21:30'];
  const slotDurationMin = state.slot_duration_min ?? 30;
  const promoPct = Number(state.promotion_percentage);
  const relePct = Number(state.relegation_percentage);
  const competitionStartedMs = state.competition_started_at ? new Date(state.competition_started_at).getTime() : now;
  const competitionDurationMs = (state.competition_duration_days ?? 7) * 86_400_000;
  const competitionEndsMs = competitionStartedMs + competitionDurationMs;
  const competitionEnded = now >= competitionEndsMs;

  const today = utcDateString(now);
  if (state.current_olefoot_day !== today) {
    await supabase.from('global_league_state').update({ current_olefoot_day: today }).eq('id', 'current');
  }

  // 0. FIM DE COMPETIÇÃO
  if (competitionEnded) {
    const { data: teamsData } = await supabase.from('global_league_teams').select('*');
    const teams = (teamsData as TeamRow[]) ?? [];
    const reset = applyCompetitionReset(teams);
    const newSeasonId = `season_${now}`;
    const newCompetitionId = `competition_${now}`;
    await supabase.from('global_league_events').delete().neq('id', '');
    await supabase.from('global_league_fixtures').delete().neq('id', '');
    await supabase.from('global_league_rounds').delete().neq('id', '');
    await supabase.from('global_league_teams').upsert(reset as any, { onConflict: 'id' });
    await supabase.from('global_league_state').update({
      season_id: newSeasonId,
      season_name: `OLEFOOT LIGA — ${newSeasonId}`,
      status: 'waiting_teams',
      current_playoff_round: null, current_league_round: null,
      competition_id: newCompetitionId,
      competition_started_at: new Date(now).toISOString(),
    }).eq('id', 'current');
    return new Response(JSON.stringify({
      ok: true, step: 'competition-end',
      newCompetitionId, newSeasonId,
      competitionDurationDays: state.competition_duration_days ?? 7,
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // 1. AUTO-START PLAYOFFS
  if (state.status === 'waiting_teams') {
    const { data: teamsData } = await supabase.from('global_league_teams').select('*');
    const teams = (teamsData as TeamRow[]) ?? [];
    if (teams.length < state.min_teams_required || teams.length < 2) {
      return new Response(JSON.stringify({ ok: true, step: 'auto-start', reason: 'not-enough-teams', teamCount: teams.length, min: state.min_teams_required }), { headers: { 'Content-Type': 'application/json' } });
    }
    const { data: existingRounds } = await supabase
      .from('global_league_rounds').select('id').eq('season_id', state.season_id).limit(1);
    if (existingRounds && existingRounds.length > 0) {
      await supabase.from('global_league_state').update({ status: 'playoffs', current_playoff_round: 1 }).eq('id', 'current');
      return new Response(JSON.stringify({ ok: true, step: 'auto-start', action: 'promote-status-existing-rounds' }), { headers: { 'Content-Type': 'application/json' } });
    }
    const { rounds, fixtures } = generatePlayoffRoundsAndFixtures(teams, state.season_id, now, slots, slotDurationMin);
    if (rounds.length === 0) {
      return new Response(JSON.stringify({ ok: true, step: 'auto-start', reason: 'gen-empty' }), { headers: { 'Content-Type': 'application/json' } });
    }
    await supabase.from('global_league_rounds').upsert(rounds as any, { onConflict: 'id' });
    if (fixtures.length > 0) await supabase.from('global_league_fixtures').upsert(fixtures as any, { onConflict: 'id' });
    await supabase.from('global_league_state').update({ status: 'playoffs', current_playoff_round: 1 }).eq('id', 'current');
    return new Response(JSON.stringify({
      ok: true, step: 'auto-start', action: 'created-playoffs',
      rounds: rounds.length, fixtures: fixtures.length,
      firstKickoffUtc: new Date(rounds[0].scheduled_kickoff_ms).toISOString(),
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // 2. TRANSIÇÃO PLAYOFFS → ACTIVE
  if (state.status === 'playoffs') {
    const { data: pRounds } = await supabase
      .from('global_league_rounds').select('id, status, round_type')
      .eq('season_id', state.season_id).eq('round_type', 'playoff');
    const allFinished = (pRounds ?? []).length > 0 && (pRounds ?? []).every(r => r.status === 'finished');
    if (allFinished) {
      const { data: teamsData } = await supabase.from('global_league_teams').select('*');
      const teams = (teamsData as TeamRow[]) ?? [];
      const distributed = distributeIntoDivisions(teams);
      const { rounds, fixtures } = generateLeagueRoundsAndFixtures(distributed, state.season_id, now, slots, slotDurationMin);
      await supabase.from('global_league_teams').upsert(distributed as any, { onConflict: 'id' });
      if (rounds.length > 0) await supabase.from('global_league_rounds').upsert(rounds as any, { onConflict: 'id' });
      if (fixtures.length > 0) await supabase.from('global_league_fixtures').upsert(fixtures as any, { onConflict: 'id' });
      await supabase.from('global_league_state').update({
        status: 'active', current_playoff_round: null,
        current_league_round: rounds.length > 0 ? 1 : null,
      }).eq('id', 'current');
      return new Response(JSON.stringify({
        ok: true, step: 'transition-to-league',
        rounds: rounds.length, fixtures: fixtures.length,
      }), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  // 3. SEASON-ENDED → SOFT promo/rele (carry-over)
  if (state.status === 'active') {
    const { data: lRounds } = await supabase
      .from('global_league_rounds').select('id, status, round_type')
      .eq('season_id', state.season_id).eq('round_type', 'league');
    const allFinished = (lRounds ?? []).length > 0 && (lRounds ?? []).every(r => r.status === 'finished');
    if (allFinished) {
      const { data: teamsData } = await supabase.from('global_league_teams').select('*');
      const teams = (teamsData as TeamRow[]) ?? [];
      const reorganized = applyPromotionRelegationSoft(teams, promoPct, relePct);
      const newSeasonId = `season_${now}`;
      await supabase.from('global_league_events').delete().neq('id', '');
      await supabase.from('global_league_fixtures').delete().neq('id', '');
      await supabase.from('global_league_rounds').delete().neq('id', '');
      await supabase.from('global_league_teams').upsert(reorganized as any, { onConflict: 'id' });
      await supabase.from('global_league_state').update({
        season_id: newSeasonId,
        season_name: `OLEFOOT LIGA — ${newSeasonId}`,
        status: 'waiting_teams',
        current_playoff_round: null, current_league_round: null,
      }).eq('id', 'current');
      return new Response(JSON.stringify({
        ok: true, step: 'soft-season-end', newSeasonId,
        carryOver: 'season points preserved within competition',
      }), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  // 4. PROCESSA RODADA PENDENTE
  const { data: pending, error: pendingErr } = await supabase
    .from('global_league_rounds').select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_kickoff_ms', now)
    .order('scheduled_kickoff_ms', { ascending: true })
    .limit(1);
  if (pendingErr) {
    return new Response(JSON.stringify({ ok: false, step: 'fetch-pending', error: pendingErr.message }), { status: 500 });
  }
  if (!pending || pending.length === 0) {
    const nextKickoff = nextSlotAlignedKickoff(now, slots, slotDurationMin);
    return new Response(JSON.stringify({
      ok: true, step: 'idle', reason: 'no-pending-rounds',
      status: state.status, currentDay: today,
      nextSlotKickoffUtc: new Date(nextKickoff).toISOString(),
      msUntilNext: nextKickoff - now,
      slots, slotDurationMin,
      competitionId: state.competition_id,
      competitionEndsAtUtc: new Date(competitionEndsMs).toISOString(),
      competitionEndsInMs: competitionEndsMs - now,
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const round = pending[0] as RoundRow;
  const isPlayoff = round.round_type === 'playoff';
  await supabase.from('global_league_rounds').update({ status: 'live', actual_kickoff_ms: now }).eq('id', round.id);

  const { data: fixtures, error: fxErr } = await supabase
    .from('global_league_fixtures').select('*').eq('round_id', round.id);
  if (fxErr || !fixtures) {
    return new Response(JSON.stringify({ ok: false, step: 'fetch-fixtures', error: fxErr?.message }), { status: 500 });
  }
  const teamIds = new Set<string>();
  for (const fx of fixtures as FixtureRow[]) { teamIds.add(fx.home_team_id); teamIds.add(fx.away_team_id); }
  const { data: preTeams } = await supabase.from('global_league_teams').select('*').in('id', Array.from(teamIds));
  const teamById = new Map<string, TeamRow>();
  for (const t of (preTeams as TeamRow[] | null) ?? []) teamById.set(t.id, t);

  const fixturesUpdated: FixtureRow[] = [];
  const eventsToInsert: any[] = [];
  const teamDelta = new Map<string, { gf: number; ga: number }>();
  const newInjuries = new Map<string, { modifier: number; rounds: number }>();

  for (const fx of fixtures as FixtureRow[]) {
    const home = teamById.get(fx.home_team_id);
    const away = teamById.get(fx.away_team_id);
    const effH = home ? effectiveOverall(home) : fx.home_overall;
    const effA = away ? effectiveOverall(away) : fx.away_overall;
    const sim = simulateFixture(fx, effH, effA, now);
    fixturesUpdated.push({ ...fx, score_home: sim.score_home, score_away: sim.score_away, status: 'finished', kickoff_ms: now, finished_at_ms: now + SIM_DURATION_MS });
    for (const ev of sim.events) eventsToInsert.push(ev);
    const ha = teamDelta.get(fx.home_team_id) ?? { gf: 0, ga: 0 }; ha.gf += sim.score_home; ha.ga += sim.score_away; teamDelta.set(fx.home_team_id, ha);
    const aa = teamDelta.get(fx.away_team_id) ?? { gf: 0, ga: 0 }; aa.gf += sim.score_away; aa.ga += sim.score_home; teamDelta.set(fx.away_team_id, aa);
    if (sim.injured_side) {
      const injuredId = sim.injured_side === 'home' ? fx.home_team_id : fx.away_team_id;
      const modifier = -(2 + Math.floor(Math.random() * 3));
      const rounds = 1 + Math.floor(Math.random() * 2);
      const existing = newInjuries.get(injuredId);
      newInjuries.set(injuredId, {
        modifier: existing && existing.modifier < modifier ? existing.modifier : modifier,
        rounds: existing && existing.rounds > rounds ? existing.rounds : rounds,
      });
    }
  }
  if (fixturesUpdated.length > 0) await supabase.from('global_league_fixtures').upsert(fixturesUpdated as any, { onConflict: 'id' });
  if (eventsToInsert.length > 0) await supabase.from('global_league_events').upsert(eventsToInsert as any, { onConflict: 'id' });
  if (teamById.size > 0) {
    const updated = Array.from(teamById.values()).map((t) => {
      const d = teamDelta.get(t.id);
      let next = d ? updateTeamRow(t, d.gf, d.ga, isPlayoff) : t;
      if (next.injury_rounds_remaining > 0) {
        const remaining = next.injury_rounds_remaining - 1;
        next = { ...next, injury_rounds_remaining: remaining, injury_modifier: remaining === 0 ? 0 : next.injury_modifier };
      }
      const fresh = newInjuries.get(next.id);
      if (fresh) {
        next = {
          ...next,
          injury_modifier: next.injury_modifier < fresh.modifier ? next.injury_modifier : fresh.modifier,
          injury_rounds_remaining: next.injury_rounds_remaining > fresh.rounds ? next.injury_rounds_remaining : fresh.rounds,
        };
      }
      return next;
    });
    await supabase.from('global_league_teams').upsert(updated as any, { onConflict: 'id' });
  }
  await supabase.from('global_league_rounds').update({ status: 'finished', finished_at_ms: now + SIM_DURATION_MS }).eq('id', round.id);
  const stateUpdate: Record<string, unknown> = {};
  if (isPlayoff) stateUpdate.current_playoff_round = round.round_number + 1;
  else stateUpdate.current_league_round = round.round_number + 1;
  await supabase.from('global_league_state').update(stateUpdate).eq('id', 'current');

  return new Response(JSON.stringify({
    ok: true, step: 'process-round',
    roundId: round.id, type: round.round_type,
    fixtures: fixturesUpdated.length, events: eventsToInsert.length,
    nextRound: round.round_number + 1, currentDay: today,
    competitionEndsInMs: competitionEndsMs - now,
  }), { headers: { 'Content-Type': 'application/json' } });
});
