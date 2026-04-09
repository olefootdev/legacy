/**
 * Spatial orientation toward goal: every offensive decision references the
 * goal the team is attacking (derived from side + half), never raw coordinates.
 *
 * Provides GoalContext — a pure struct injected into the agent's decision
 * context — plus xG estimation and line-of-sight scoring.
 */

import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import { getAttackingGoalX, getSideAttackDir, depthFromOwnGoal } from './fieldZones';
import type { TeamSide, MatchHalf } from './fieldZones';
import type { AgentSnapshot } from '@/simulation/InteractionResolver';
import {
  XG_BASE,
  XG_FINISHING_WEIGHT,
  XG_MENTAL_WEIGHT,
  XG_CLOSE_BONUS,
  XG_MID_BONUS,
  XG_FAR_PENALTY,
  XG_ANGLE_PENALTY,
  XG_OPP_PENALTY,
  XG_BLOCK_PENALTY,
  XG_PRESSURE_MAX_PENALTY,
  XG_STAMINA_THRESHOLD,
  XG_STAMINA_PENALTY,
  XG_CONFIDENCE_WEIGHT,
  XG_MIN,
  XG_MAX,
  LOS_CONE_HALF_ANGLE,
  LOS_BLOCK_RADIUS,
} from './xgTuning';

// ---------------------------------------------------------------------------
// Goal context — injected into agent decision
// ---------------------------------------------------------------------------

export interface GoalContext {
  /** Center of the attacked goal line (x, z). */
  targetGoalX: number;
  targetGoalZ: number;
  /** +1 (attack east) or -1 (attack west). */
  attackUnitX: 1 | -1;
  /** Euclidean distance from carrier/self to goal center. */
  distToGoal: number;
  /** Angle in radians from carrier to goal center (0 = head-on). */
  angleToGoal: number;
  /** 0–1: how clear the line of sight to goal is (1 = unobstructed). */
  lineOfSightScore: number;
  /** 0–1: progress toward attacked goal (0 = own goal line, 1 = opponent goal line). */
  progressToGoal: number;
}

// ---------------------------------------------------------------------------
// Build helpers
// ---------------------------------------------------------------------------

export function buildGoalContext(
  selfX: number,
  selfZ: number,
  side: TeamSide,
  half: MatchHalf,
  opponents: readonly AgentSnapshot[],
): GoalContext {
  const attackUnitX = getSideAttackDir(side, half);
  const targetGoalX = getAttackingGoalX(side, half);
  const targetGoalZ = FIELD_WIDTH / 2;

  const dx = targetGoalX - selfX;
  const dz = targetGoalZ - selfZ;
  const distToGoal = Math.hypot(dx, dz);
  const angleToGoal = Math.abs(Math.atan2(dz, dx));
  const progress = computeProgressToGoal(selfX, side, half);
  const los = computeLineOfSight(selfX, selfZ, targetGoalX, targetGoalZ, opponents);

  return {
    targetGoalX,
    targetGoalZ,
    attackUnitX,
    distToGoal,
    angleToGoal,
    lineOfSightScore: los,
    progressToGoal: progress,
  };
}

/**
 * 0–1 scalar: how far along the pitch the position is toward the attacked goal.
 * 0 = standing on own goal line, 1 = standing on opponent goal line.
 */
export function computeProgressToGoal(x: number, side: TeamSide, half: MatchHalf): number {
  const depth = depthFromOwnGoal(x, side, half);
  return Math.max(0, Math.min(1, depth / FIELD_LENGTH));
}

/**
 * 0–1: line of sight to goal. 1 = no opponents blocking the shot line,
 * 0 = heavily blocked. Uses a narrow cone from shooter to goal center.
 */
export function computeLineOfSight(
  selfX: number,
  selfZ: number,
  goalX: number,
  goalZ: number,
  opponents: readonly AgentSnapshot[],
): number {
  const dx = goalX - selfX;
  const dz = goalZ - selfZ;
  const dist = Math.hypot(dx, dz);
  if (dist < 1) return 1;

  const ux = dx / dist;
  const uz = dz / dist;

  let blockers = 0;
  for (const o of opponents) {
    const ox = o.x - selfX;
    const oz = o.z - selfZ;
    const proj = ox * ux + oz * uz;
    if (proj < 0 || proj > dist) continue;
    const perpDist = Math.abs(ox * uz - oz * ux);
    if (perpDist < LOS_BLOCK_RADIUS) blockers++;
  }

  return Math.max(0, 1 - blockers * 0.28);
}

// ---------------------------------------------------------------------------
// Enhanced xG estimation
// ---------------------------------------------------------------------------

/**
 * Estimate shot xG for a given position and context.
 * Pure function — no side effects, tuneable via xgTuning.ts.
 */
export function estimateShotXG(
  shooter: AgentSnapshot,
  ballX: number,
  ballZ: number,
  goalCtx: GoalContext,
  opponents: readonly AgentSnapshot[],
): number {
  const { distToGoal, angleToGoal, lineOfSightScore } = goalCtx;

  const fin = shooter.finalizacao / 100;
  const mental = ((shooter.mentalidade ?? 70) + (shooter.confianca ?? 70)) / 200;
  let xg = XG_BASE + fin * XG_FINISHING_WEIGHT + mental * XG_MENTAL_WEIGHT;

  // Distance bands
  if (distToGoal < 12) xg += XG_CLOSE_BONUS;
  else if (distToGoal < 20) xg += XG_MID_BONUS;
  else if (distToGoal > 30) xg += XG_FAR_PENALTY;

  // Angle penalty (wide angles reduce chance)
  if (angleToGoal > Math.PI * 0.35) xg += XG_ANGLE_PENALTY;

  // Line of sight
  xg += (lineOfSightScore - 0.5) * 0.06;

  // Nearby opponents
  let nearOppCount = 0;
  for (const o of opponents) {
    if (Math.hypot(o.x - ballX, o.z - ballZ) < 4) nearOppCount++;
  }
  xg += nearOppCount * XG_OPP_PENALTY;

  // Pressure
  const press = nearestPressure01(ballX, ballZ, opponents);
  xg *= 1 - press * (XG_PRESSURE_MAX_PENALTY - mental * 0.1);

  // Confidence runtime
  const confRun = shooter.confidenceRuntime ?? 1;
  xg *= (1 - XG_CONFIDENCE_WEIGHT) + confRun * XG_CONFIDENCE_WEIGHT;

  // Stamina
  const st = shooter.stamina ?? 85;
  if (st < XG_STAMINA_THRESHOLD) xg *= XG_STAMINA_PENALTY + st / 500;

  return Math.max(XG_MIN, Math.min(XG_MAX, xg));
}

/**
 * Estimate expected xG if the ball were at a given position (for pass-target evaluation).
 * Lighter than full estimateShotXG — approximates based on distance and angle only.
 */
export function estimatePositionalXG(
  x: number,
  z: number,
  side: TeamSide,
  half: MatchHalf,
  finalizacao: number,
): number {
  const goalX = getAttackingGoalX(side, half);
  const goalZ = FIELD_WIDTH / 2;
  const dist = Math.hypot(goalX - x, goalZ - z);
  const angle = Math.abs(Math.atan2(goalZ - z, goalX - x));

  const fin = finalizacao / 100;
  let xg = XG_BASE + fin * XG_FINISHING_WEIGHT * 0.5;
  if (dist < 12) xg += XG_CLOSE_BONUS;
  else if (dist < 20) xg += XG_MID_BONUS;
  else if (dist > 30) xg += XG_FAR_PENALTY;
  if (angle > Math.PI * 0.35) xg += XG_ANGLE_PENALTY;

  return Math.max(XG_MIN, Math.min(XG_MAX, xg));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nearestPressure01(x: number, z: number, opponents: readonly AgentSnapshot[]): number {
  let minD = Infinity;
  for (const o of opponents) {
    const d = Math.hypot(o.x - x, o.z - z);
    if (d < minD) minD = d;
  }
  if (!Number.isFinite(minD)) return 0;
  return Math.max(0, Math.min(1, (4.8 - minD) / 4.8));
}
