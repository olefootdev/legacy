// Status de fixture alinhado com o check constraint da tabela global_league_fixtures.
// A tabela aceita: scheduled | live | finished
// 'failed' é tratado internamente mas persistido como 'scheduled' para permitir retry.
export type FixtureStatus = 'scheduled' | 'live' | 'finished';
export type LeagueStatus = 'waiting_teams' | 'playoffs' | 'active' | 'season_ended';

export interface TeamRow {
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
  registered_at?: string;
}

export interface RoundRow {
  id: string;
  season_id: string;
  round_number: number;
  round_type: 'playoff' | 'league';
  phase: string | null;
  status: 'scheduled' | 'live' | 'finished';
  scheduled_kickoff_ms: number;
  actual_kickoff_ms: number | null;
  finished_at_ms: number | null;
}

export interface FixtureRow {
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
  current_minute: number;
  status: FixtureStatus;
  kickoff_ms: number | null;
  finished_at_ms: number | null;
}

export interface StateRow {
  id: string;
  season_id: string;
  season_name: string;
  status: LeagueStatus;
  current_playoff_round: number | null;
  current_league_round: number | null;
  min_teams_required: number;
  teams_per_division: number;
  promotion_percentage: number;
  relegation_percentage: number;
  match_slots: string[];
  slot_duration_min: number;
  current_olefoot_day: string;
  competition_started_at: string;
  competition_duration_days: number;
  competition_id: string;
}

export interface CycleResult {
  ok: boolean;
  step: string;
  roundId?: string;
  fixtures?: number;
  events?: number;
  rounds?: number;
  error?: string;
  skipped?: boolean;
  reason?: string;
}
