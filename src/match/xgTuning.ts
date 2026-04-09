/**
 * Centralized xG estimation and line-of-sight constants.
 * Adjustable without touching logic in goalContext.ts or OnBallDecision.ts.
 */

// ---------------------------------------------------------------------------
// xG estimation
// ---------------------------------------------------------------------------

/** Base xG before any modifiers. */
export const XG_BASE = 0.04;
/** Weight of finalizacao (0–1 normalized) on xG. */
export const XG_FINISHING_WEIGHT = 0.20;
/** Weight of mental composite (mentalidade+confianca avg, 0–1) on xG. */
export const XG_MENTAL_WEIGHT = 0.04;

/** Bonus for shots < 12m from goal. */
export const XG_CLOSE_BONUS = 0.12;
/** Bonus for shots 12–20m from goal. */
export const XG_MID_BONUS = 0.06;
/** Penalty for shots > 30m from goal. */
export const XG_FAR_PENALTY = -0.04;
/** Penalty for wide angle (> 0.35π radians). */
export const XG_ANGLE_PENALTY = -0.06;
/** Penalty per nearby opponent (< 4m). */
export const XG_OPP_PENALTY = -0.028;
/** Penalty per line-of-sight blocker. */
export const XG_BLOCK_PENALTY = -0.03;

/** Max fraction of xG removed by pressure (before mental offset). */
export const XG_PRESSURE_MAX_PENALTY = 0.22;
/** Stamina threshold below which xG is penalized. */
export const XG_STAMINA_THRESHOLD = 45;
/** Stamina penalty multiplier base (+ stamina/500). */
export const XG_STAMINA_PENALTY = 0.88;
/** Weight of confidenceRuntime on xG multiplier. */
export const XG_CONFIDENCE_WEIGHT = 0.14;

/** Floor and ceiling for final xG value. */
export const XG_MIN = 0.01;
export const XG_MAX = 0.38;

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
