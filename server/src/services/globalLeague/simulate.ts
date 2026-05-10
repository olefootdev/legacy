import type { FixtureRow, TeamRow } from './types.js';

function poissonGoals(expected: number): number {
  const L = Math.exp(-expected);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L && k < 8);
  return k - 1;
}

export function effectiveOverall(team: TeamRow): number {
  const suspMod = (team.suspension_rounds_remaining ?? 0) > 0 ? -5 : 0;
  const injMod = team.injury_rounds_remaining > 0 ? team.injury_modifier : 0;
  return Math.max(40, team.overall + injMod + suspMod);
}

export interface SimResult {
  score_home: number;
  score_away: number;
  events: Array<{
    id: string; fixture_id: string; event_type: string;
    minute: number; side: 'home' | 'away'; text: string;
    highlight: boolean; timestamp_ms: number;
  }>;
  injured_side: 'home' | 'away' | null;
  home_yellow: boolean;
  away_yellow: boolean;
}

export function simulateFixture(
  fx: FixtureRow,
  effHome: number,
  effAway: number,
  kickoffMs: number,
): SimResult {
  const diff = (effHome + 3) - effAway;
  const homeGoals = poissonGoals(Math.max(0.2, 1.4 + diff / 22));
  const awayGoals = poissonGoals(Math.max(0.2, 1.4 - diff / 22));
  const events: SimResult['events'] = [];

  const placeGoal = (side: 'home' | 'away', i: number, total: number) => {
    const minute = Math.max(1, Math.min(90,
      Math.floor((90 / (total + 1)) * (i + 1) + (Math.random() - 0.5) * 8)));
    const name = side === 'home' ? fx.home_team_name : fx.away_team_name;
    events.push({
      id: `evt_${fx.id}_${side}_g${i}_${kickoffMs}`,
      fixture_id: fx.id, event_type: 'goal', minute, side,
      text: `⚽ GOL! ${name} marca!`, highlight: true,
      timestamp_ms: kickoffMs + minute * 1000,
    });
  };
  for (let i = 0; i < homeGoals; i++) placeGoal('home', i, homeGoals);
  for (let i = 0; i < awayGoals; i++) placeGoal('away', i, awayGoals);

  let home_yellow = false, away_yellow = false;
  if (Math.random() < 0.15) {
    home_yellow = true;
    const minute = Math.floor(10 + Math.random() * 80);
    events.push({ id: `evt_${fx.id}_home_yc_${kickoffMs}`, fixture_id: fx.id,
      event_type: 'yellow_card', minute, side: 'home',
      text: `🟡 Cartão amarelo — ${fx.home_team_name}`, highlight: false,
      timestamp_ms: kickoffMs + minute * 1000 });
  }
  if (Math.random() < 0.15) {
    away_yellow = true;
    const minute = Math.floor(10 + Math.random() * 80);
    events.push({ id: `evt_${fx.id}_away_yc_${kickoffMs}`, fixture_id: fx.id,
      event_type: 'yellow_card', minute, side: 'away',
      text: `🟡 Cartão amarelo — ${fx.away_team_name}`, highlight: false,
      timestamp_ms: kickoffMs + minute * 1000 });
  }

  let injured_side: 'home' | 'away' | null = null;
  if (Math.random() < 0.08) {
    injured_side = Math.random() < 0.5 ? 'home' : 'away';
    const minute = Math.floor(10 + Math.random() * 80);
    events.push({ id: `evt_${fx.id}_${injured_side}_inj_${kickoffMs}`,
      fixture_id: fx.id, event_type: 'injury', minute, side: injured_side,
      text: '🚑 Jogador lesionado', highlight: false,
      timestamp_ms: kickoffMs + minute * 1000 });
  }

  events.sort((a, b) => a.minute - b.minute);
  return { score_home: homeGoals, score_away: awayGoals, events, injured_side, home_yellow, away_yellow };
}

export function updateTeamRow(
  team: TeamRow, gf: number, ga: number, isPlayoff: boolean,
): TeamRow {
  const isWin = gf > ga, isDraw = gf === ga;
  const points = isWin ? 3 : isDraw ? 1 : 0;
  const result: 'W' | 'D' | 'L' = isWin ? 'W' : isDraw ? 'D' : 'L';
  const allTime = {
    all_time_points: (team.all_time_points ?? 0) + points,
    all_time_matches_played: (team.all_time_matches_played ?? 0) + 1,
    all_time_wins: (team.all_time_wins ?? 0) + (isWin ? 1 : 0),
    all_time_draws: (team.all_time_draws ?? 0) + (isDraw ? 1 : 0),
    all_time_losses: (team.all_time_losses ?? 0) + (!isWin && !isDraw ? 1 : 0),
    all_time_goals_for: (team.all_time_goals_for ?? 0) + gf,
    all_time_goals_against: (team.all_time_goals_against ?? 0) + ga,
  };
  if (isPlayoff) {
    return { ...team, ...allTime,
      playoff_points: team.playoff_points + points,
      playoff_matches_played: team.playoff_matches_played + 1,
      playoff_wins: team.playoff_wins + (isWin ? 1 : 0),
      playoff_draws: team.playoff_draws + (isDraw ? 1 : 0),
      playoff_losses: team.playoff_losses + (!isWin && !isDraw ? 1 : 0),
      playoff_goals_for: team.playoff_goals_for + gf,
      playoff_goals_against: team.playoff_goals_against + ga,
    };
  }
  return { ...team, ...allTime,
    points: team.points + points, matches_played: team.matches_played + 1,
    wins: team.wins + (isWin ? 1 : 0), draws: team.draws + (isDraw ? 1 : 0),
    losses: team.losses + (!isWin && !isDraw ? 1 : 0),
    goals_for: team.goals_for + gf, goals_against: team.goals_against + ga,
    goal_difference: team.goal_difference + (gf - ga),
    recent_form: [...(team.recent_form ?? []), result].slice(-5),
  };
}
