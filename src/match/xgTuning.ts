/**
 * Centralized xG estimation and line-of-sight constants.
 * Adjustable without touching logic in goalContext.ts or OnBallDecision.ts.
 */

import { GOAL_INNER_WIDTH_IFAB_M, GOAL_INNER_WIDTH_M } from '@/simulation/field';

/**
 * Só em `ActionResolver` (golo/defesa após remate). A decisão da IA usa `evaluateShot` sem este factor;
 * assim a boca maior não aumenta a conversão quase linearmente com a largura.
 */
export const XG_RESOLUTION_GOAL_MOUTH_DAMP =
  GOAL_INNER_WIDTH_M <= GOAL_INNER_WIDTH_IFAB_M
    ? 1
    : Math.sqrt(GOAL_INNER_WIDTH_IFAB_M / GOAL_INNER_WIDTH_M);

// ---------------------------------------------------------------------------
// xG estimation
// ---------------------------------------------------------------------------

/** Base xG before any modifiers. Aumentado 50% para mais gols: 0.04 → 0.06 */
export const XG_BASE = 0.06;
/** Weight of finalizacao (0–1 normalized) on xG. Aumentado 25%: 0.20 → 0.25 */
export const XG_FINISHING_WEIGHT = 0.25;
/** Weight of mental composite (mentalidade+confianca avg, 0–1) on xG. Aumentado 50%: 0.04 → 0.06 */
export const XG_MENTAL_WEIGHT = 0.06;

/** Bonus for shots < 12m from goal. Aumentado 33%: 0.12 → 0.16 */
export const XG_CLOSE_BONUS = 0.16;
/** Bonus for shots 12–20m from goal. Aumentado 50%: 0.06 → 0.09 */
export const XG_MID_BONUS = 0.09;
/** Penalty for shots > 30m from goal. Reduzido 25%: -0.04 → -0.03 */
export const XG_FAR_PENALTY = -0.03;
/** Penalty for wide angle (> 0.35π radians). Reduzido 33%: -0.06 → -0.04 */
export const XG_ANGLE_PENALTY = -0.04;
/** Penalty per nearby opponent (< 4m). Reduzido 30%: -0.028 → -0.02 */
export const XG_OPP_PENALTY = -0.02;
/** Penalty per line-of-sight blocker. Reduzido 33%: -0.03 → -0.02 */
export const XG_BLOCK_PENALTY = -0.02;

/** Max fraction of xG removed by pressure (before mental offset). Reduzido 27%: 0.22 → 0.16 */
export const XG_PRESSURE_MAX_PENALTY = 0.16;
/** Stamina threshold below which xG is penalized. Reduzido: 45 → 35 */
export const XG_STAMINA_THRESHOLD = 35;
/** Stamina penalty multiplier base (+ stamina/500). Reduzido: 0.88 → 0.92 */
export const XG_STAMINA_PENALTY = 0.92;
/** Weight of confidenceRuntime on xG multiplier. Aumentado 43%: 0.14 → 0.20 */
export const XG_CONFIDENCE_WEIGHT = 0.20;

/** Floor and ceiling for final xG value. Teto aumentado 32%: 0.38 → 0.50 */
export const XG_MIN = 0.01;
export const XG_MAX = 0.50;

// ---------------------------------------------------------------------------
// Line-of-sight
// ---------------------------------------------------------------------------

/** Half-angle of the shot cone for line-of-sight check (radians). */
export const LOS_CONE_HALF_ANGLE = 0.12;
/** Perpendicular distance (m) within which an opponent counts as a blocker. */
export const LOS_BLOCK_RADIUS = 2.0;

// ---------------------------------------------------------------------------
// Pass xG-delta scoring
// ---------------------------------------------------------------------------

/** Weight of xG improvement in pass/carry scoring (0–1). */
export const PASS_XG_DELTA_WEIGHT = 0.18;
/** Minimum xG-delta to consider a pass as "goal-seeking" (below this, no bonus). */
export const PASS_XG_DELTA_MIN_THRESHOLD = 0.005;
