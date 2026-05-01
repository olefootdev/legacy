/**
 * 4.3 — First Touch Errors
 * Humanized reception errors: ball "squirts" based on technique and ball speed.
 */

/**
 * Computes a positional offset applied to the ball after reception.
 * Higher technique (drible 0-100) → smaller error.
 * Higher ball speed → larger error.
 * Returns { dx, dz } in meters.
 */
export function computeFirstTouchError(
  technique: number,   // drible 0-100
  ballSpeed: number,   // m/s
  rng01: () => number,
): { dx: number; dz: number } {
  // Normalize technique: 0 = worst, 1 = best
  const techNorm = Math.max(0, Math.min(1, technique / 100));

  // Base error magnitude: poor technique + fast ball = bigger error
  // Max error ~3m at technique=0, speed=30; ~0.1m at technique=100, speed=5
  const speedFactor = Math.min(1, ballSpeed / 25);
  const techFactor = 1 - techNorm;
  const maxError = 3.0;
  const errorMag = maxError * techFactor * speedFactor;

  if (errorMag < 0.05) return { dx: 0, dz: 0 };

  // Random direction for the error
  const angle = rng01() * Math.PI * 2;
  const magnitude = errorMag * (0.3 + rng01() * 0.7); // vary magnitude

  return {
    dx: Math.cos(angle) * magnitude,
    dz: Math.sin(angle) * magnitude,
  };
}

/**
 * Returns true if the player loses control of the ball on reception.
 * Probability is inversely proportional to technique and directly to ball speed.
 */
export function doesLooseControl(
  technique: number,
  ballSpeed: number,
  rng01: () => number,
): boolean {
  const techNorm = Math.max(0, Math.min(1, technique / 100));
  const speedFactor = Math.min(1, ballSpeed / 30);

  // Base probability: 0% at perfect technique, up to ~40% at zero technique + max speed
  const baseProbability = (1 - techNorm) * speedFactor * 0.4;

  // Minimum floor: even elite players can miscontrol at high speed
  const probability = Math.max(0, baseProbability - techNorm * 0.05);

  return rng01() < probability;
}
