/**
 * 4.10 — Set Piece Routines
 * Corner kick choreography: decoy runners to near post open space at far post.
 */

import type { AgentSnapshot } from '@/simulation/InteractionResolver';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';

export interface CornerRoutineWaypoint {
  agentId: string;
  targetX: number;
  targetZ: number;
  role: 'decoy_near_post' | 'target_far_post' | 'second_ball' | 'taker';
  /** 0-1: when to start moving (0=immediately, 1=when ball leaves) */
  timing: number;
}

/**
 * Computes corner routine waypoints for the attacking team.
 * Decoy runners go to near post to drag defenders, opening far post for the target.
 */
export function computeCornerRoutine(
  taker: AgentSnapshot,
  teammates: AgentSnapshot[],
  cornerSide: 'left' | 'right',
  attackDir: 1 | -1,
): CornerRoutineWaypoint[] {
  const waypoints: CornerRoutineWaypoint[] = [];

  // Goal line X: where the corner is being taken from
  const goalLineX = attackDir === 1 ? FIELD_LENGTH : 0;

  // Near post Z: closer to the corner flag
  // Far post Z: opposite side of goal
  const goalCenterZ = FIELD_WIDTH / 2;
  const goalHalfWidth = 5; // ~half of goal width in meters

  let nearPostZ: number;
  let farPostZ: number;

  if (cornerSide === 'left') {
    // Corner on left (low Z) → near post is low Z, far post is high Z
    nearPostZ = goalCenterZ - goalHalfWidth;
    farPostZ = goalCenterZ + goalHalfWidth;
  } else {
    // Corner on right (high Z) → near post is high Z, far post is low Z
    nearPostZ = goalCenterZ + goalHalfWidth;
    farPostZ = goalCenterZ - goalHalfWidth;
  }

  // Near post X: just inside the goal area
  const nearPostX =
    attackDir === 1
      ? goalLineX - 5.5
      : goalLineX + 5.5;

  // Far post X: slightly deeper into the box
  const farPostX =
    attackDir === 1
      ? goalLineX - 9
      : goalLineX + 9;

  // Second ball position: edge of penalty area
  const secondBallX =
    attackDir === 1
      ? goalLineX - 16.5
      : goalLineX + 16.5;

  // Taker waypoint
  waypoints.push({
    agentId: taker.id,
    targetX: taker.x,
    targetZ: taker.z,
    role: 'taker',
    timing: 0,
  });

  // Sort teammates by distance to goal (closest first) to assign roles
  const sorted = [...teammates]
    .filter((t) => t.id !== taker.id)
    .sort((a, b) => {
      const da = Math.abs(a.x - goalLineX);
      const db = Math.abs(b.x - goalLineX);
      return da - db;
    });

  let decoyCount = 0;
  let targetAssigned = false;
  let secondBallAssigned = false;

  for (const tm of sorted) {
    if (!targetAssigned) {
      // Best header / tallest player → far post target
      waypoints.push({
        agentId: tm.id,
        targetX: farPostX,
        targetZ: farPostZ,
        role: 'target_far_post',
        timing: 0.7, // wait for ball to be struck
      });
      targetAssigned = true;
    } else if (decoyCount < 2) {
      // Decoy runners → near post (drag defenders)
      waypoints.push({
        agentId: tm.id,
        targetX: nearPostX,
        targetZ: nearPostZ + (decoyCount === 0 ? -1.5 : 1.5),
        role: 'decoy_near_post',
        timing: 0.3, // start early to draw defenders
      });
      decoyCount++;
    } else if (!secondBallAssigned) {
      // Second ball runner → edge of box
      waypoints.push({
        agentId: tm.id,
        targetX: secondBallX,
        targetZ: goalCenterZ,
        role: 'second_ball',
        timing: 0.5,
      });
      secondBallAssigned = true;
    } else {
      break; // enough roles assigned
    }
  }

  return waypoints;
}
