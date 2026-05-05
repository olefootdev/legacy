import type { Vec2 } from './AgentTypes';

// What an agent can read from the world — intentionally minimal.
// No team shape, no score.

export interface AgentPerception {
  ballPosition: Vec2;
  ownPosition: Vec2;
  goalPosition: Vec2;           // opponent goal center (normalized)
  nearestTeammateDist: number;  // distance to closest teammate
  nearestOpponentDist: number;  // distance to closest opponent
  teamHasBall: boolean;
  hasBall: boolean;             // this agent is the ball carrier
}

export function distanceTo(a: Vec2, b: Vec2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Build perception snapshot for an agent each tick.
export function buildPerception(
  ownPosition: Vec2,
  ballPosition: Vec2,
  goalPosition: Vec2,
  teammatePositions: Vec2[],
  opponentPositions: Vec2[],
  teamHasBall: boolean,
  hasBall: boolean,
): AgentPerception {
  let nearestTeammate = Infinity;
  for (const pos of teammatePositions) {
    const d = distanceTo(ownPosition, pos);
    if (d > 0.01 && d < nearestTeammate) nearestTeammate = d; // exclude self
  }

  let nearestOpponent = Infinity;
  for (const pos of opponentPositions) {
    const d = distanceTo(ownPosition, pos);
    if (d < nearestOpponent) nearestOpponent = d;
  }

  return {
    ballPosition,
    ownPosition,
    goalPosition,
    nearestTeammateDist: nearestTeammate === Infinity ? 100 : nearestTeammate,
    nearestOpponentDist: nearestOpponent === Infinity ? 100 : nearestOpponent,
    teamHasBall,
    hasBall,
  };
}
