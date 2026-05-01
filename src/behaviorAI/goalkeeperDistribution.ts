/**
 * 4.7 — Goalkeeper Distribution
 * GK scans defense before distributing: prefers short pass to unmarked CB.
 */

import type { AgentSnapshot } from '@/simulation/InteractionResolver';
import { FIELD_LENGTH } from '@/simulation/field';

export type GKDistributionChoice = 'short_pass' | 'long_kick' | 'hold';

interface DistributionCandidate {
  agent: AgentSnapshot;
  score: number;
}

/**
 * GK utility: scans teammates for best distribution option.
 * Prefers short pass to unmarked defender; falls back to long kick or hold.
 */
export function decideGoalkeeperDistribution(
  gk: AgentSnapshot,
  teammates: AgentSnapshot[],
  opponents: AgentSnapshot[],
  attackDir: 1 | -1,
  threatLevel: number,
  rng01: () => number,
): { choice: GKDistributionChoice; targetId?: string } {
  // Under high threat, GK may just clear long
  if (threatLevel > 0.75 && rng01() < 0.6) {
    return { choice: 'long_kick' };
  }

  const shortPassCandidates: DistributionCandidate[] = [];
  const longKickCandidates: DistributionCandidate[] = [];

  for (const tm of teammates) {
    if (tm.id === gk.id) continue;

    const dx = tm.x - gk.x;
    const dz = tm.z - gk.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Find nearest opponent to this teammate
    let nearestOppDist = Infinity;
    for (const opp of opponents) {
      const odx = opp.x - tm.x;
      const odz = opp.z - tm.z;
      const od = Math.sqrt(odx * odx + odz * odz);
      if (od < nearestOppDist) nearestOppDist = od;
    }

    // Is this teammate moving toward the opponent's half?
    const isProgressing =
      attackDir === 1 ? tm.x > gk.x : tm.x < gk.x;

    // Short pass: within 25m, teammate has space (>3m from nearest opp)
    if (dist <= 25 && nearestOppDist > 3) {
      const score =
        nearestOppDist * 0.4 + // more space = better
        (isProgressing ? 5 : 0) + // progressing = bonus
        (dist < 15 ? 3 : 0); // closer = safer
      shortPassCandidates.push({ agent: tm, score });
    }

    // Long kick: beyond 30m, in attacking half
    const inAttackingHalf =
      attackDir === 1 ? tm.x > FIELD_LENGTH * 0.5 : tm.x < FIELD_LENGTH * 0.5;
    if (dist > 30 && inAttackingHalf) {
      const score = nearestOppDist * 0.2 + (dist > 50 ? 2 : 0);
      longKickCandidates.push({ agent: tm, score });
    }
  }

  // Sort by score descending
  shortPassCandidates.sort((a, b) => b.score - a.score);
  longKickCandidates.sort((a, b) => b.score - a.score);

  // Prefer short pass if available
  if (shortPassCandidates.length > 0) {
    const best = shortPassCandidates[0];
    // Add some randomness: 80% chance to pick best, 20% second best
    const pick =
      shortPassCandidates.length > 1 && rng01() < 0.2
        ? shortPassCandidates[1]
        : best;
    return { choice: 'short_pass', targetId: pick.agent.id };
  }

  // Fall back to long kick
  if (longKickCandidates.length > 0) {
    return { choice: 'long_kick', targetId: longKickCandidates[0].agent.id };
  }

  // No good option: hold
  return { choice: 'hold' };
}
