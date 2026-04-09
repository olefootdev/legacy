/**
 * Progressão OLEFOOT — alinhado a docs/ECONOMIA_EXP_BRO.md
 * - Ranking mundial: só exp_balance (gastos reduzem).
 * - Nível do manager (1–25): exp_lifetime_earned (não cai ao gastar).
 */

export type MissionKind = 'onboarding' | 'daily' | 'weekly' | 'achievement' | 'special';

/** Troféu exibido na Sala de Troféus (perfil) ao resgatar a missão. */
export interface MissionTrophyMeta {
  id: string;
  name: string;
  description?: string;
}

/** Telemetria de progresso de missões (telas, partida, loja, resgates). */
export type MissionEvent =
  | 'session_login'
  | 'screen_home'
  | 'screen_team'
  | 'screen_wallet'
  | 'screen_city'
  | 'screen_transfer'
  | 'screen_store'
  | 'match_started'
  | 'match_completed'
  | 'match_won'
  | 'goal_scored'
  | 'lineup_saved'
  | 'structure_upgraded'
  | 'store_purchase'
  | 'transfer_listed'
  | 'training_session'
  | 'fast_match_completed'
  /** Resgate de missão — usado pela semanal “Gerente dedicado”. */
  | 'mission_claimed';

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  kind: MissionKind;
  /** EXP concedido ao resgatar (entra em balance + lifetime) */
  rewardExp: number;
  targetCount: number;
  /** Eventos que incrementam progresso (via trackMissionEvent) */
  trackEvents: readonly MissionEvent[];
  /**
   * `sum` (padrão): cada evento soma +1 (ou `amount`).
   * `distinct`: conta no máximo 1 por tipo de evento listado em trackEvents (ex.: visitar Transfer e Cidade).
   */
  progressMode?: 'sum' | 'distinct';
  /** Missões com troféu aparecem no perfil quando resgatadas (onboarding, achievement, special). */
  trophy?: MissionTrophyMeta;
}

export interface MissionRuntimeState {
  progress: number;
  claimed: boolean;
  /** Eventos já contados no modo distinct (neste ciclo de reset) */
  distinctDone?: string[];
}

export interface ProgressionState {
  /** Saldo gastável — entra no ranking */
  expBalance: number;
  /** Total de EXP ganho no histórico — define nível 1–25; não diminui em compras */
  expLifetimeEarned: number;
  /** Chave do último reset diário (YYYY-MM-DD local) */
  dailyResetKey: string;
  /** Chave da última semana ISO (ex.: 2026-W14) */
  weeklyResetKey: string;
  /** Progresso por id de missão */
  missions: Record<string, MissionRuntimeState>;
}
