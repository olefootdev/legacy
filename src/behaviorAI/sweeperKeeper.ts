/**
 * 4.6 — Sweeper Keeper
 * GK reads space behind a high defensive line and positions accordingly.
 */

import type { AgentSnapshot } from '@/simulation/InteractionResolver';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';

/**
 * Computes the sweeper keeper's expanded position based on defensive line depth.
 * defensiveLine: X coordinate of the defensive line (meters).
 * attackDir: 1 = home attacks toward +X (away GK is near X=105).
 */
export function computeSweeperKeeperPosition(
  gk: AgentSnapshot,
  defensiveLine: number,
  attackDir: 1 | -1,
  ballX: number,
  ballZ: number,
  threatLevel: number, // 0-1
): { x: number; z: number } {
  // GK's own goal line
  const goalLineX = attackDir === 1 ? 0 : FIELD_LENGTH;

  // Space behind defensive line (between GK goal line and defensive line)
  const spaceDepth =
    attackDir === 1
      ? defensiveLine - goalLineX
      : goalLineX - defensiveLine;

  // How far GK can advance: up to 40% of the space behind the line
  // More threat = GK stays deeper; less threat = can push out more
  const advanceFraction = (1 - threatLevel) * 0.4;
  const advanceDistance = spaceDepth * advanceFraction;

  // GK advances toward the defensive line
  const targetX =
    attackDir === 1
      ? goalLineX + advanceDistance
      : goalLineX - advanceDistance;

  // Lateral positioning: track ball Z but stay near center
  const ballZInfluence = 0.3;
  const centerZ = FIELD_WIDTH / 2;
  const targetZ = centerZ + (ballZ - centerZ) * ballZInfluence;

  return {
    x: Math.max(0, Math.min(FIELD_LENGTH, targetX)),
    z: Math.max(2, Math.min(FIELD_WIDTH - 2, targetZ)),
  };
}

/**
 * Returns true if the GK should leave the area to intercept a through ball.
 * Checks if ball trajectory will reach behind the defensive line before an outfield player.
 */
export function shouldSweeperKeeperIntercept(
  gk: AgentSnapshot,
  ballX: number,
  ballZ: number,
  ballVx: number,
  ballVz: number,
  defensiveLine: number,
  attackDir: 1 | -1,
): boolean {
  // Ball must be moving toward GK's goal
  const movingTowardGoal =
    attackDir === 1 ? ballVx < 0 : ballVx > 0;

  if (!movingTowardGoal) return false;

  // Ball must be behind the defensive line (in the space the GK covers)
  const ballBehindLine =
    attackDir === 1
      ? ballX < defensiveLine
      : ballX > defensiveLine;

  if (!ballBehindLine) return false;

  // Estimate time for ball to reach GK's current X
  const dxBallToGk = gk.x - ballX;
  if (Math.abs(ballVx) < 0.1) return false;
  const timeToBall = dxBallToGk / ballVx;

  if (timeToBall < 0 || timeToBall > 4) return false;

  // Predicted ball Z at intercept
  const predictedZ = ballZ + ballVz * timeToBall;

  // GK can reach if within ~8m laterally
  const lateralDist = Math.abs(predictedZ - gk.z);
  const gkReachRadius = 8;

  // Ball speed: only intercept if ball is slow enough to reach
  const ballSpeed = Math.sqrt(ballVx * ballVx + ballVz * ballVz);
  const gkSpeed = gk.speed > 0 ? gk.speed : 6;

  const distToIntercept = Math.sqrt(
    dxBallToGk * dxBallToGk + (predictedZ - gk.z) * (predictedZ - gk.z),
  );

  const gkCanReach = distToIntercept / gkSpeed <= timeToBall;

  return lateralDist < gkReachRadius && gkCanReach && ballSpeed < 15;
}
