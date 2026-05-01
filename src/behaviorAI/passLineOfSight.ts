/**
 * 4.2 — Pass Line of Sight
 * Evaluates pass corridor quality accounting for defender velocity.
 */

import type { AgentSnapshot } from '@/simulation/InteractionResolver';

/**
 * Computes a line-of-sight score for a pass from carrier to target.
 * Considers defender positions AND their velocity (projected intercept point).
 * Returns 0–1: 1 = fully open, 0 = completely blocked.
 */
export function passLineOfSightScore(
  carrier: AgentSnapshot,
  target: AgentSnapshot,
  opponents: AgentSnapshot[],
  ballSpeed = 18, // m/s
): number {
  const dx = target.x - carrier.x;
  const dz = target.z - carrier.z;
  const passDistance = Math.sqrt(dx * dx + dz * dz);

  if (passDistance < 0.01) return 1;

  // Unit vector along pass line
  const ux = dx / passDistance;
  const uz = dz / passDistance;

  let minScore = 1;

  for (const opp of opponents) {
    // Vector from carrier to opponent
    const ox = opp.x - carrier.x;
    const oz = opp.z - carrier.z;

    // Project opponent onto pass line
    const proj = ox * ux + oz * uz;

    // Only consider opponents between carrier and target (with small margin)
    if (proj < 0 || proj > passDistance + 1) continue;

    // Perpendicular distance from opponent to pass line
    const perpX = ox - proj * ux;
    const perpZ = oz - proj * uz;
    const perpDist = Math.sqrt(perpX * perpX + perpZ * perpZ);

    // Time for ball to reach this point along the pass line
    const timeToBallAtProj = proj / ballSpeed;

    // Project opponent's future position using their speed (simplified: assume they move toward pass line)
    // We use speed as a scalar — actual direction unknown, so we reduce effective perpDist
    const reachDist = opp.speed * timeToBallAtProj;
    const effectivePerpDist = Math.max(0, perpDist - reachDist);

    // Blocking radius: ~1.5m for a player's reach/body width
    const blockRadius = 1.5;

    if (effectivePerpDist < blockRadius) {
      // Fully blocked
      const blockScore = effectivePerpDist / blockRadius;
      minScore = Math.min(minScore, blockScore);
    }
  }

  return Math.max(0, Math.min(1, minScore));
}

/**
 * Adjusts pass success probability based on line-of-sight score.
 * If score < 0.2, cancels the pass (returns 0).
 * Otherwise multiplies baseProb by the score.
 */
export function adjustPassSuccessProb(
  baseProb: number,
  losScore: number,
): number {
  if (losScore < 0.2) return 0;
  return Math.max(0, Math.min(1, baseProb * losScore));
}
