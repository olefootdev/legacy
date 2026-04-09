/**
 * Pesos e tetos para resolução de ações contestadas + QA de posse.
 * Ver também matchSimulationTuning.ts (timing, fadiga).
 */

/** Teto mole após todos os modificadores — nenhuma ação contestada fica trivialmente 100% */
export const ACTION_SOFT_CAP_PASS = 0.94;
export const ACTION_SOFT_CAP_CROSS = 0.91;
export const ACTION_SOFT_CAP_DRIBBLE = 0.88;
export const ACTION_SOFT_CAP_SHOT_ON_TARGET = 0.82;

/** Baselines logísticos (antes de zona/pressão) — usados em ActionResolver */
export const ACTION_BASE_SUCCESS_PASS_SAFE = 0.78;
export const ACTION_BASE_SUCCESS_PASS_PROGRESSIVE = 0.58;
export const ACTION_BASE_SUCCESS_CROSS = 0.48;
export const ACTION_BASE_SUCCESS_DRIBBLE = 0.52;

/** Tetos de xG bruto (InteractionResolver / resolver) */
export const SHOT_XG_CAP = 0.38;
export const SHOT_P_ON_TARGET_CAP = 0.72;
export const SHOT_P_ON_TARGET_FLOOR = 0.06;

/** Zona: quanto cada tag altera score de decisão (multiplicador leve) */
export const ZONE_WEIGHT_OWN_BOX_CONSERVATIVE = 0.22;
export const ZONE_WEIGHT_ATTACKING_THIRD_SHOOT = 0.18;
export const ZONE_WEIGHT_WIDE_CROSS = 0.14;
export const ZONE_WEIGHT_CENTRAL_PROGRESSIVE = 0.1;

/** Passe interceptado: linha com adversário próximo */
export const PASS_INTERCEPT_LINE_DIST = 2.6;
export const PASS_INTERCEPT_PROB_CAP = 0.55;

/** Disputa curta (futuro); duração máxima sugerida em segundos de sim */
export const CONTEST_STATE_MAX_SEC = 0.35;

/** QA: se abaixo deste valor de mudanças/min, motor pode estar “preso” */
export const POSSESSION_QA_MIN_CHANGES_PER_MIN = 1.8;

/** Janela móvel em minutos de jogo para métrica de posse */
export const POSSESSION_QA_WINDOW_MINUTES = 4;
