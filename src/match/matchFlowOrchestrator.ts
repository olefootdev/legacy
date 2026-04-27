import type { MatchTruthPhase } from '@/bridge/matchTruthSchema';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';

/**
 * Central match-flow policy for test2d / TacticalSimLoop: when structural kickoff
 * anchors drive repositioning (post-goal), and soft clamping so tactical zone clamps
 * do not fight authored IFAB kickoff shapes.
 */
export function shouldApplyGoalRestartStructuralMap(
  truthPhase: MatchTruthPhase,
  hasGoalRestart: boolean,
): boolean {
  if (!hasGoalRestart) return false;
  return truthPhase === 'goal_restart' || truthPhase === 'kickoff';
}

/** Pitch bounds only — keeps slot targets aligned with `StructuralReorganization` / Arrive. */
export function structuralKickoffAnchorWorld(raw: { x: number; z: number }): { x: number; z: number } {
  return {
    x: Math.min(FIELD_LENGTH - 2, Math.max(2, raw.x)),
    z: Math.min(FIELD_WIDTH - 2, Math.max(2, raw.z)),
  };
}
