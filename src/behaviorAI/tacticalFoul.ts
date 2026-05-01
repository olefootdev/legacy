/**
 * 4.5 — Tactical Foul
 * Defender evaluates whether to commit a tactical foul.
 */

import type { AgentSnapshot } from '@/simulation/InteractionResolver';

export interface FoulDecision {
  shouldFoul: boolean;
  reason: string;
  /** Yellow card risk 0-1 */
  yellowCardRisk: number;
}

/**
 * Defender evaluates: last man? already has yellow card?
 * Decides between fouling vs letting the attacker through.
 */
export function evaluateTacticalFoul(
  defender: AgentSnapshot & { yellowCards?: number },
  attacker: AgentSnapshot,
  isLastDefender: boolean,
  distToGoal: number,
  defenderMarcacao: number, // 0-100
  rng01: () => number,
): FoulDecision {
  const yellowCards = defender.yellowCards ?? 0;
  const hasYellow = yellowCards >= 1;

  // Base willingness to foul: scales with marcacao
  const marcacaoNorm = Math.max(0, Math.min(1, defenderMarcacao / 100));

  // Distance factor: closer to goal = more desperate
  // distToGoal in meters; 0 = on goal line, 105 = far end
  const distFactor = Math.max(0, 1 - distToGoal / 40);

  // Yellow card risk: last man + close to goal = red card territory
  let yellowCardRisk = distFactor * 0.5;
  if (isLastDefender && distToGoal < 20) {
    yellowCardRisk = Math.min(1, yellowCardRisk + 0.4);
  }

  // If already has yellow, heavily penalize fouling
  const yellowPenalty = hasYellow ? 0.7 : 0;

  // Attacker speed advantage: faster attacker = more reason to foul
  const speedAdvantage = Math.max(0, attacker.speed - defender.speed);
  const speedFactor = Math.min(0.3, speedAdvantage / 10);

  // Compute foul probability
  let foulProb =
    marcacaoNorm * 0.4 +
    distFactor * 0.4 +
    speedFactor -
    yellowPenalty;

  foulProb = Math.max(0, Math.min(1, foulProb));

  const shouldFoul = rng01() < foulProb;

  let reason = 'no foul needed';
  if (shouldFoul) {
    if (isLastDefender && distToGoal < 20) {
      reason = 'last defender — tactical stop near goal';
    } else if (speedAdvantage > 2) {
      reason = 'attacker too fast — tactical foul to reset';
    } else {
      reason = 'tactical foul to break counter';
    }
  } else if (hasYellow) {
    reason = 'already on yellow — avoiding second booking';
  }

  return { shouldFoul, reason, yellowCardRisk };
}
