/**
 * 4.4 — Pressing Trap
 * Trigger-based pressing (not distance-based). Shared team state.
 */

import { FIELD_WIDTH } from '@/simulation/field';

export type PressingTrigger =
  | 'bad_pass'
  | 'back_to_goal_reception'
  | 'ball_in_flank'
  | 'none';

export interface TeamPressingState {
  side: 'home' | 'away';
  active: boolean;
  trigger: PressingTrigger;
  activatedAt: number; // simTime
  /** Maximum duration of the pressing trap in seconds */
  durationSec: number;
}

export function createTeamPressingState(side: 'home' | 'away'): TeamPressingState {
  return {
    side,
    active: false,
    trigger: 'none',
    activatedAt: 0,
    durationSec: 8,
  };
}

/**
 * Detects if a pressing trigger has been activated.
 * badPassThreshold: successProb < 0.35 = bad pass.
 * carrierFacingGoal: false = back to goal.
 * ballZ: position along width axis.
 */
export function detectPressingTrigger(
  lastPassSuccessProb: number,
  carrierFacingGoal: boolean,
  ballZ: number,
  fieldWidth = FIELD_WIDTH,
): PressingTrigger {
  // Bad pass: low success probability
  if (lastPassSuccessProb < 0.35) {
    return 'bad_pass';
  }

  // Carrier has back to goal — vulnerable to press
  if (!carrierFacingGoal) {
    return 'back_to_goal_reception';
  }

  // Ball in flank: within 15% of either touchline
  const flankThreshold = fieldWidth * 0.15;
  if (ballZ < flankThreshold || ballZ > fieldWidth - flankThreshold) {
    return 'ball_in_flank';
  }

  return 'none';
}

export function activatePressingTrap(
  state: TeamPressingState,
  trigger: PressingTrigger,
  simTime: number,
): void {
  if (trigger === 'none') return;
  state.active = true;
  state.trigger = trigger;
  state.activatedAt = simTime;
}

export function tickPressingTrap(state: TeamPressingState, simTime: number): void {
  if (!state.active) return;
  if (simTime - state.activatedAt >= state.durationSec) {
    state.active = false;
    state.trigger = 'none';
  }
}

export function isPressingTrapActive(
  state: TeamPressingState,
  simTime: number,
): boolean {
  if (!state.active) return false;
  return simTime - state.activatedAt < state.durationSec;
}
