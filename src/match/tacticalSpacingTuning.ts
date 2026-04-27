/**
 * Single source for off-ball spacing: Yuka separation neighborhood / radius
 * and test2d canvas repulsion (engine 0–100) stay numerically aligned in intent.
 *
 * `TEST2D_MIN_SPACING_ENGINE_UNITS` ↔ teammates repulsion in `computeTacticalPositions`;
 * `YUKA_*` ↔ `rebuildNeighbors` + `Vehicle.boundingRadius` in `yukaAgents`.
 */
export const YUKA_BOUNDING_RADIUS_M = 1.1;

/** Neighbor radius (m) for `SeparationBehavior` — only nearby teammates contribute. */
export const YUKA_SEPARATION_NEIGHBOR_RADIUS_M = 7.5;

/** Minimum center-to-center spacing (engine 0–100) before repulsion in tactical canvas. */
export const TEST2D_MIN_SPACING_ENGINE_UNITS = 9.4;

/** Repulsion blend per tick when `TEST2D_MIN_SPACING_ENGINE_UNITS` is violated. */
export const TEST2D_REPULSION_FORCE = 0.66;
