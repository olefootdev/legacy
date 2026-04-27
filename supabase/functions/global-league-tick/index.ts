// deno-lint-ignore-file no-explicit-any
// Olefoot — global-league-tick
// Edge Function chamada periodicamente por pg_cron (default: a cada 1min).
// verify_jwt=false: a função é um webhook idempotente; o único efeito possível
// é avançar uma rodada que já estava agendada. Auth real para escrita no DB
// vem do SUPABASE_SERVICE_ROLE_KEY (env do projeto, não exposto).
//
// Verifica se há rodadas com scheduled_kickoff_ms <= now e status='scheduled',
// simula seus fixtures, persiste eventos + placares, atualiza estatísticas dos
// times e marca a rodada como finished.

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
  current_minute?: number;
  status: string;
  kickoff_ms?: number | null;
  finished_at_ms?: number | null;
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
  injury_modifier: number;
  injury_rounds_remaining: number;
}

function effectiveOverall(team: TeamRow): number {
  const mod = team.injury_rounds_remaining > 0 ? team.injury_modifier : 0;
  return Math.max(40, team.overall + mod);
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

function simulateFixture(
  fixture: FixtureRow,
  effHomeOverall: number,
  effAwayOverall: number,
  kickoffMs: number,
) {
  const homeAdvantage = 3;
  const diff = (effHomeOverall + homeAdvantage) - effAwayOverall;
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
  let injured_side: 'home' | 'away' | null = null;
  if (Math.random() < 0.08) {
    injured_side = Math.random() < 0.5 ? 'home' : 'away';
    const minute = Math.floor(10 + Math.random() * 80);
    events.push({
      id: `evt_${fixture.id}_${injured_side}_inj_${kickoffMs}`,
      fixture_id: fixture.id,
      event_type: 'injury',
      minute,
      side: injured_side,
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
    injured_side,
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

  // 4. Pre-fetch dos times participantes (precisamos do overall efetivo com lesões)
  const teamIds = new Set<string>();
  for (const fx of fixtures as FixtureRow[]) {
    teamIds.add(fx.home_team_id);
    teamIds.add(fx.away_team_id);
  }
  const { data: preTeams } = await supabase
    .from('global_league_teams')
    .select('*')
    .in('id', Array.from(teamIds));
  const teamById = new Map<string, TeamRow>();
  for (const t of (preTeams as TeamRow[] | null) ?? []) teamById.set(t.id, t);

  // 5. Simula
  const fixturesUpdated: FixtureRow[] = [];
  const eventsToInsert: Record<string, unknown>[] = [];
  const teamDelta = new Map<string, { gf: number; ga: number }>();
  const newInjuries = new Map<string, { modifier: number; rounds: number }>();

  for (const fx of fixtures as FixtureRow[]) {
    const home = teamById.get(fx.home_team_id);
    const away = teamById.get(fx.away_team_id);
    const effHome = home ? effectiveOverall(home) : fx.home_overall;
    const effAway = away ? effectiveOverall(away) : fx.away_overall;

    const sim = simulateFixture(fx, effHome, effAway, now);
    // Importante: spread completo. upsert com Partial falha porque o INSERT path
    // do ON CONFLICT precisa de todos os NOT NULL (round_id, home_team_id, etc).
    fixturesUpdated.push({
      ...fx,
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

    if (sim.injured_side) {
      const injuredId = sim.injured_side === 'home' ? fx.home_team_id : fx.away_team_id;
      const modifier = -(2 + Math.floor(Math.random() * 3)); // -2, -3 ou -4
      const rounds = 1 + Math.floor(Math.random() * 2);     // 1 ou 2
      const existing = newInjuries.get(injuredId);
      newInjuries.set(injuredId, {
        modifier: existing && existing.modifier < modifier ? existing.modifier : modifier,
        rounds: existing && existing.rounds > rounds ? existing.rounds : rounds,
      });
    }
  }

  // 6. Persiste fixtures + events
  if (fixturesUpdated.length > 0) {
    await supabase.from('global_league_fixtures').upsert(fixturesUpdated as any, { onConflict: 'id' });
  }
  if (eventsToInsert.length > 0) {
    await supabase.from('global_league_events').upsert(eventsToInsert as any, { onConflict: 'id' });
  }

  // 7. Atualiza estatísticas + decremento de lesões pré-existentes + aplica novas lesões
  if (teamById.size > 0) {
    const updated = Array.from(teamById.values()).map((t) => {
      const d = teamDelta.get(t.id);
      let next = d ? updateTeamRow(t, d.gf, d.ga, isPlayoff) : t;

      // Decrementa lesão que estava ativa entrando neste tick
      if (next.injury_rounds_remaining > 0) {
        const remaining = next.injury_rounds_remaining - 1;
        next = {
          ...next,
          injury_rounds_remaining: remaining,
          injury_modifier: remaining === 0 ? 0 : next.injury_modifier,
        };
      }

      // Aplica nova lesão sofrida nesta rodada (toma o pior modifier + maior duração)
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

  // 8. Marca rodada como finished
  await supabase
    .from('global_league_rounds')
    .update({ status: 'finished', finished_at_ms: now + SIM_DURATION_MS })
    .eq('id', round.id);

  // 9. Atualiza state singleton (current_*_round)
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
