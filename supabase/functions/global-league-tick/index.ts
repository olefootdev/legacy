// deno-lint-ignore-file no-explicit-any
// Olefoot — global-league-tick
// Edge Function chamada periodicamente por pg_cron (default: a cada 1min).
// Verifica se há rodadas com scheduled_kickoff_ms <= now e status='scheduled',
// simula seus fixtures, persiste eventos + placares, atualiza estatísticas dos
// times e marca a rodada como finished. Cria a próxima rodada se aplicável.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface FixtureRow {
  id: string;
  round_id: string;
  division: string;
  home_team_id: string;
  away_team_id: string;
  home_team_name: string;
  away_team_name: string;
  home_overall: number;
  away_overall: number;
  score_home: number;
  score_away: number;
  status: string;
}

interface RoundRow {
  id: string;
  season_id: string;
  round_number: number;
  round_type: 'playoff' | 'league';
  status: string;
  scheduled_kickoff_ms: number;
  actual_kickoff_ms: number | null;
  finished_at_ms: number | null;
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
}

const ROUND_INTERVAL_MS = 60 * 60 * 1000; // 1 hora entre rodadas
const SIM_DURATION_MS = 90_000;            // 90 "minutos" simulados

// ─── Simulador minimalista ──────────────────────────────────────────────

function poissonGoals(expected: number): number {
  // Distribuição aproximada de Poisson via método das séries
  const L = Math.exp(-expected);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L && k < 8);
  return k - 1;
}

function simulateFixture(fixture: FixtureRow, kickoffMs: number) {
  const homeAdvantage = 3;
  const diff = (fixture.home_overall + homeAdvantage) - fixture.away_overall;
  const homeExpected = Math.max(0.2, 1.4 + diff / 22);
  const awayExpected = Math.max(0.2, 1.4 - diff / 22);

  const homeGoals = poissonGoals(homeExpected);
  const awayGoals = poissonGoals(awayExpected);

  const events: Array<Record<string, unknown>> = [];

  const placeGoal = (side: 'home' | 'away', i: number, total: number) => {
    const minute = Math.max(1, Math.min(90, Math.floor((90 / (total + 1)) * (i + 1) + (Math.random() - 0.5) * 8)));
    const teamName = side === 'home' ? fixture.home_team_name : fixture.away_team_name;
    events.push({
      id: `evt_${fixture.id}_${side}_g${i}_${kickoffMs}`,
      fixture_id: fixture.id,
      event_type: 'goal',
      minute,
      side,
      text: `⚽ GOL! ${teamName} marca!`,
      highlight: true,
      timestamp_ms: kickoffMs + minute * 1000,
    });
  };

  for (let i = 0; i < homeGoals; i++) placeGoal('home', i, homeGoals);
  for (let i = 0; i < awayGoals; i++) placeGoal('away', i, awayGoals);

  // Cartões: ~1.4 por jogo, distribuição binomial simples
  const totalCards = Math.max(0, Math.round((Math.random() + Math.random()) * 1.5));
  for (let i = 0; i < totalCards; i++) {
    const side = Math.random() < 0.5 ? 'home' : 'away';
    const isRed = Math.random() < 0.08; // 8% chance vermelho
    const minute = Math.floor(15 + Math.random() * 75);
    events.push({
      id: `evt_${fixture.id}_${side}_card${i}_${kickoffMs}`,
      fixture_id: fixture.id,
      event_type: isRed ? 'red_card' : 'yellow_card',
      minute,
      side,
      text: isRed ? '🟥 Cartão vermelho!' : '🟨 Cartão amarelo',
      highlight: isRed,
      timestamp_ms: kickoffMs + minute * 1000,
    });
  }

  // Lesão: 8% chance por jogo
  if (Math.random() < 0.08) {
    const side = Math.random() < 0.5 ? 'home' : 'away';
    const minute = Math.floor(10 + Math.random() * 80);
    events.push({
      id: `evt_${fixture.id}_${side}_inj_${kickoffMs}`,
      fixture_id: fixture.id,
      event_type: 'injury',
      minute,
      side,
      text: '🚑 Jogador lesionado',
      highlight: false,
      timestamp_ms: kickoffMs + minute * 1000,
    });
  }

  events.sort((a, b) => (a.minute as number) - (b.minute as number));

  return {
    score_home: homeGoals,
    score_away: awayGoals,
    events,
  };
}

// ─── Atualização de estatísticas ───────────────────────────────────────

function updateTeamRow(team: TeamRow, goalsFor: number, goalsAgainst: number, isPlayoff: boolean): TeamRow {
  const isWin = goalsFor > goalsAgainst;
  const isDraw = goalsFor === goalsAgainst;
  const points = isWin ? 3 : isDraw ? 1 : 0;
  const result: 'W' | 'D' | 'L' = isWin ? 'W' : isDraw ? 'D' : 'L';

  if (isPlayoff) {
    return {
      ...team,
      playoff_points: team.playoff_points + points,
      playoff_matches_played: team.playoff_matches_played + 1,
      playoff_wins: team.playoff_wins + (isWin ? 1 : 0),
      playoff_draws: team.playoff_draws + (isDraw ? 1 : 0),
      playoff_losses: team.playoff_losses + (!isWin && !isDraw ? 1 : 0),
      playoff_goals_for: team.playoff_goals_for + goalsFor,
      playoff_goals_against: team.playoff_goals_against + goalsAgainst,
    };
  }

  const newForm = [...(team.recent_form ?? []), result].slice(-5);
  return {
    ...team,
    points: team.points + points,
    matches_played: team.matches_played + 1,
    wins: team.wins + (isWin ? 1 : 0),
    draws: team.draws + (isDraw ? 1 : 0),
    losses: team.losses + (!isWin && !isDraw ? 1 : 0),
    goals_for: team.goals_for + goalsFor,
    goals_against: team.goals_against + goalsAgainst,
    goal_difference: team.goal_difference + (goalsFor - goalsAgainst),
    recent_form: newForm,
  };
}

// ─── Handler ────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const now = Date.now();

  // 1. Próxima rodada agendada cuja hora chegou
  const { data: pending, error: pendingErr } = await supabase
    .from('global_league_rounds')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_kickoff_ms', now)
    .order('scheduled_kickoff_ms', { ascending: true })
    .limit(1);

  if (pendingErr) {
    return new Response(JSON.stringify({ ok: false, step: 'fetch-pending', error: pendingErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0, reason: 'no-pending-rounds', now }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const round = pending[0] as RoundRow;
  const isPlayoff = round.round_type === 'playoff';

  // 2. Marca rodada como live
  await supabase
    .from('global_league_rounds')
    .update({ status: 'live', actual_kickoff_ms: now })
    .eq('id', round.id);

  // 3. Busca fixtures pendentes
  const { data: fixtures, error: fxErr } = await supabase
    .from('global_league_fixtures')
    .select('*')
    .eq('round_id', round.id);
  if (fxErr || !fixtures) {
    return new Response(JSON.stringify({ ok: false, step: 'fetch-fixtures', error: fxErr?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 4. Simula
  const fixturesUpdated: Partial<FixtureRow>[] = [];
  const eventsToInsert: Record<string, unknown>[] = [];
  const teamDelta = new Map<string, { gf: number; ga: number }>();

  for (const fx of fixtures as FixtureRow[]) {
    const sim = simulateFixture(fx, now);
    fixturesUpdated.push({
      id: fx.id,
      score_home: sim.score_home,
      score_away: sim.score_away,
      status: 'finished',
      kickoff_ms: now,
      finished_at_ms: now + SIM_DURATION_MS,
    });
    for (const ev of sim.events) eventsToInsert.push(ev);

    const homeAcc = teamDelta.get(fx.home_team_id) ?? { gf: 0, ga: 0 };
    homeAcc.gf += sim.score_home;
    homeAcc.ga += sim.score_away;
    teamDelta.set(fx.home_team_id, homeAcc);

    const awayAcc = teamDelta.get(fx.away_team_id) ?? { gf: 0, ga: 0 };
    awayAcc.gf += sim.score_away;
    awayAcc.ga += sim.score_home;
    teamDelta.set(fx.away_team_id, awayAcc);
  }

  // 5. Persiste fixtures + events
  if (fixturesUpdated.length > 0) {
    await supabase.from('global_league_fixtures').upsert(fixturesUpdated as any, { onConflict: 'id' });
  }
  if (eventsToInsert.length > 0) {
    await supabase.from('global_league_events').upsert(eventsToInsert as any, { onConflict: 'id' });
  }

  // 6. Atualiza estatísticas dos times
  if (teamDelta.size > 0) {
    const ids = Array.from(teamDelta.keys());
    const { data: teamRows } = await supabase
      .from('global_league_teams')
      .select('*')
      .in('id', ids);

    if (teamRows) {
      const updated = (teamRows as TeamRow[]).map((t) => {
        const d = teamDelta.get(t.id);
        if (!d) return t;
        return updateTeamRow(t, d.gf, d.ga, isPlayoff);
      });
      await supabase.from('global_league_teams').upsert(updated as any, { onConflict: 'id' });
    }
  }

  // 7. Marca rodada como finished
  await supabase
    .from('global_league_rounds')
    .update({ status: 'finished', finished_at_ms: now + SIM_DURATION_MS })
    .eq('id', round.id);

  // 8. Atualiza state singleton (current_*_round)
  const stateUpdate: Record<string, unknown> = {};
  if (isPlayoff) {
    stateUpdate.current_playoff_round = round.round_number + 1;
  } else {
    stateUpdate.current_league_round = round.round_number + 1;
  }
  await supabase.from('global_league_state').update(stateUpdate).eq('id', 'current');

  return new Response(JSON.stringify({
    ok: true,
    roundId: round.id,
    type: round.round_type,
    fixtures: fixturesUpdated.length,
    events: eventsToInsert.length,
    nextRound: round.round_number + 1,
    intervalHint: ROUND_INTERVAL_MS,
  }), { headers: { 'Content-Type': 'application/json' } });
});
