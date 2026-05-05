/**
 * /agents/core/OffsideTrap.ts
 *
 * Emergent offside trap — no central script.
 * Each CB independently decides to "step up" based on local perception.
 * When all CBs share the same rule, the line moves in unison — emergence.
 *
 * Rule (per paper):
 *   IF nearest opponent enters PRESS_RADIUS
 *   AND agent has defensive archetype
 *   AND team does NOT have ball
 *   → step up by STEP_DISTANCE toward midfield
 *
 * The "bondage" between CBs is implicit: they all share the same threshold,
 * so they react simultaneously to the same stimulus.
 */

import type { Vec2 } from './AgentTypes';

// How close an opponent must be to trigger the step-up (normalized units)
const PRESS_RADIUS = 22;

// How far the CB steps up toward midfield per tick
const STEP_DISTANCE = 3;

// Midfield line — CBs never step past this
const MIDFIELD_X = 48;

/**
 * Returns an adjusted target position for a CB applying the offside trap.
 * If the trap does not fire, returns the original baseTarget unchanged.
 */
export function applyOffsideTrap(
  ownPosition: Vec2,
  baseTarget: Vec2,
  nearestOpponentDist: number,
  teamHasBall: boolean,
  archetype: string,
): Vec2 {
  // Only defensive archetypes apply the trap
  if (archetype !== 'defensive') return baseTarget;

  // Only when team is out of possession
  if (teamHasBall) return baseTarget;

  // Only when an opponent is within press radius
  if (nearestOpponentDist > PRESS_RADIUS) return baseTarget;

  // Step up: move toward midfield, capped at MIDFIELD_X
  const stepUpX = Math.min(MIDFIELD_X, ownPosition.x + STEP_DISTANCE);
  return { x: stepUpX, y: baseTarget.y };
}

/**
 * Returns true if this agent should apply the offside trap logic.
 * Only CB_L and CB_R positions participate.
 */
export function isTrapEligible(position: string): boolean {
  return position === 'CB_L' || position === 'CB_R';
}
