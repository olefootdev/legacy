/**
 * Ranking mundial: apenas exp_balance (gastos reduzem saldo).
 * Nível do manager 1–25: exp_lifetime_earned (monotônico).
 */

export type MissionKind = 'onboarding' | 'daily' | 'weekly' | 'achievement';

export type MissionEventType =
  | 'session_login'
  | 'screen_home'
  | 'screen_team'
  | 'screen_wallet'
  | 'screen_city'
  | 'screen_transfer'
  | 'screen_store'
  | 'screen_missions'
  | 'match_completed'
  | 'fast_match_completed'
  | 'match_won'
  | 'goal_scored'
  | 'lineup_saved'
  | 'structure_upgraded'
  | 'store_purchase'
  | 'training_session'
  | 'mission_claimed';

export interface MissionDef {
  id: string;
  kind: MissionKind;
  title: string;
  description: string;
  targetCount: number;
  rewardExp: number;
  /** Evento que incrementa progresso (missão semanal escuta `mission_claimed`). */
  trackEvent: MissionEventType;
}

export interface MissionProgressState {
  progress: number;
  claimed: boolean;
}

export interface ProgressionPersistSlice {
  expBalance: number;
  expLifetimeEarned: number;
  missionProgress: Record<string, MissionProgressState>;
  lastDailyResetKey: string;
  lastWeeklyResetKey: string;
}
