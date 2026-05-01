/**
 * 4.11 — Angular Inertia
 * Limits heading change rate based on speed and agility.
 * Prevents instant direction reversals; enforces realistic turn radius.
 */

/**
 * Computes minimum turn radius in meters based on speed and agility.
 * Higher speed + lower agility = larger turn radius.
 */
export function computeTurnRadius(
  speed: number,   // m/s
  agility: number, // 0-100
): number {
  if (speed < 0.1) return 0;

  // Agility norm: 0 = sluggish, 1 = elite
  const agilityNorm = Math.max(0, Math.min(1, agility / 100));

  // Base radius: at full speed (10 m/s) with zero agility → ~8m radius
  // At full agility → ~1m radius
  const baseRadius = speed * speed / (9.81 * (0.3 + agilityNorm * 0.7));

  return Math.max(0.3, baseRadius);
}

/**
 * Clamps heading change per frame based on speed and agility.
 * currentHeading, desiredHeading: radians (atan2 convention).
 * Returns new heading clamped to max turn rate.
 */
export function clampHeadingChange(
  currentHeading: number,
  desiredHeading: number,
  speed: number,
  agility: number,
  dt: number, // seconds
): number {
  if (speed < 0.1) {
    // Stationary: can rotate freely
    return desiredHeading;
  }

  const turnRadius = computeTurnRadius(speed, agility);

  // Max angular velocity (rad/s) = speed / turnRadius
  const maxAngularVel = speed / Math.max(0.1, turnRadius);

  // Max heading change this frame
  const maxDelta = maxAngularVel * dt;

  // Compute angular difference (shortest path)
  let delta = desiredHeading - currentHeading;

  // Normalize to [-π, π]
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;

  // Clamp
  const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, delta));

  return currentHeading + clampedDelta;
}

/**
 * Derives agility from existing player attributes.
 * velocidade contributes 60%, drible 40%.
 */
export function deriveAgility(velocidade: number, drible: number): number {
  return Math.max(0, Math.min(100, velocidade * 0.6 + drible * 0.4));
}
