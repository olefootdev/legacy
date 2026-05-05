/**
 * /agents/fieldKnowledge/TerritoryRules.ts
 *
 * Spatial intelligence functions — the "brain" that answers agent queries.
 *
 * SOFT territory model:
 *   - slightly outside primary → allow movement (support expansion)
 *   - deeply outside territory → redirect toward recovery
 *   - team has ball → allow support zone expansion
 *   - team defending → restrict to primary + own half
 *
 * All functions are pure — no side effects, no mutation.
 */

import type { Vec2 } from '../core/AgentTypes';
import type {
  FieldZone,
  PositionTerritory,
  TerritoryGameState,
  TerritoryValidation,
  FieldKnowledge,
} from './FieldKnowledge';
import { FIELD_ZONES, getZoneIdForPoint, isPointInZone } from './FieldZones';

// ── Point-in-zone queries ─────────────────────────────────────────────────────

export function getZoneForCoordinate(x: number, y: number): FieldZone | undefined {
  const id = getZoneIdForPoint(x, y);
  return FIELD_ZONES[id];
}

export function isPointInsideZone(point: Vec2, zoneId: string): boolean {
  return isPointInZone(point.x, point.y, zoneId);
}

export function isPointInsidePrimaryTerritory(
  territory: PositionTerritory,
  point: Vec2,
): boolean {
  return territory.primaryZoneIds.some((id) => isPointInZone(point.x, point.y, id));
}

export function isPointInsideSupportTerritory(
  territory: PositionTerritory,
  point: Vec2,
): boolean {
  return territory.supportZoneIds.some((id) => isPointInZone(point.x, point.y, id));
}

export function isPointForbidden(
  territory: PositionTerritory,
  point: Vec2,
): boolean {
  return territory.forbiddenZoneIds.some((id) => isPointInZone(point.x, point.y, id));
}

// ── Distance from territory ───────────────────────────────────────────────────

/**
 * Returns the distance from a point to the nearest primary zone boundary.
 * Negative = inside, positive = outside.
 */
function distanceOutsidePrimary(territory: PositionTerritory, point: Vec2): number {
  let minDist = Infinity;
  for (const id of territory.primaryZoneIds) {
    const z = FIELD_ZONES[id];
    if (!z) continue;
    // If inside, distance is negative (how deep inside)
    if (point.x >= z.xMin && point.x <= z.xMax && point.y >= z.yMin && point.y <= z.yMax) {
      return -1; // inside primary
    }
    // Distance to nearest edge of zone
    const dx = Math.max(z.xMin - point.x, 0, point.x - z.xMax);
    const dy = Math.max(z.yMin - point.y, 0, point.y - z.yMax);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// ── Recovery logic ────────────────────────────────────────────────────────────

export function shouldRecoverPosition(
  territory: PositionTerritory,
  currentPos: Vec2,
  gameState: TerritoryGameState,
): boolean {
  // If in primary zone, never force recovery
  if (isPointInsidePrimaryTerritory(territory, currentPos)) return false;

  // If in support zone and team has ball, allow it
  if (gameState.teamHasBall && isPointInsideSupportTerritory(territory, currentPos)) return false;

  // If in forbidden zone, always recover
  if (isPointForbidden(territory, currentPos)) return true;

  // If outside primary by more than softBoundaryRadius, recover
  const dist = distanceOutsidePrimary(territory, currentPos);
  return dist > territory.softBoundaryRadius * 0.4;
}

export function getRecoveryTarget(
  territory: PositionTerritory,
  _gameState: TerritoryGameState,
): Vec2 {
  return { ...territory.recoveryPoint };
}

// ── Ball responsibility ───────────────────────────────────────────────────────

export function isBallInResponsibilityZone(
  territory: PositionTerritory,
  ballPosition: Vec2,
): boolean {
  // Ball is in responsibility if it's in primary or support zone
  return (
    isPointInsidePrimaryTerritory(territory, ballPosition) ||
    isPointInsideSupportTerritory(territory, ballPosition)
  );
}

// ── Target clamping (soft intelligence) ──────────────────────────────────────

/**
 * Validates and adjusts a movement target based on territory rules.
 *
 * Soft model:
 *   - target in primary → allow
 *   - target in support + team has ball → allow
 *   - target in support + team defending → redirect to primary boundary
 *   - target in forbidden → redirect to recovery
 *   - target outside all zones but within softBoundaryRadius → allow (soft expansion)
 *   - target deeply outside → redirect to recovery
 */
export function clampTargetToAllowedTerritory(
  territory: PositionTerritory,
  currentPos: Vec2,
  target: Vec2,
  gameState: TerritoryGameState,
): Vec2 {
  // Always allow primary zone targets
  if (isPointInsidePrimaryTerritory(territory, target)) return target;

  // Support zone: allow when team has ball, redirect when defending
  if (isPointInsideSupportTerritory(territory, target)) {
    if (gameState.teamHasBall) return target;
    // Defending: blend target toward recovery (50% pull)
    return {
      x: (target.x + territory.recoveryPoint.x) / 2,
      y: (target.y + territory.recoveryPoint.y) / 2,
    };
  }

  // Forbidden zone: redirect to recovery
  if (isPointForbidden(territory, target)) {
    return { ...territory.recoveryPoint };
  }

  // Outside all zones: check soft boundary
  const dist = distanceOutsidePrimary(territory, target);
  if (dist <= territory.softBoundaryRadius * 0.5) {
    // Soft expansion allowed — slight pull toward recovery
    const pull = dist / (territory.softBoundaryRadius * 0.5);
    return {
      x: target.x + (territory.recoveryPoint.x - target.x) * pull * 0.3,
      y: target.y + (territory.recoveryPoint.y - target.y) * pull * 0.3,
    };
  }

  // Deeply outside: redirect to recovery
  return { ...territory.recoveryPoint };
}

// ── Full validation ───────────────────────────────────────────────────────────

export function validateAgentTarget(
  knowledge: FieldKnowledge,
  currentPos: Vec2,
  proposedTarget: Vec2,
  gameState: TerritoryGameState,
): TerritoryValidation {
  const { territory } = knowledge;
  const currentZoneId = getZoneIdForPoint(currentPos.x, currentPos.y);

  const isInPrimary  = isPointInsidePrimaryTerritory(territory, currentPos);
  const isInSupport  = isPointInsideSupportTerritory(territory, currentPos);
  const isForbidden  = isPointForbidden(territory, currentPos);
  const isOutOfTerritory = !isInPrimary && !isInSupport;

  const shouldRecover = shouldRecoverPosition(territory, currentPos, gameState);
  const recoveryTarget = getRecoveryTarget(territory, gameState);

  const adjustedTarget = shouldRecover
    ? recoveryTarget
    : clampTargetToAllowedTerritory(territory, currentPos, proposedTarget, gameState);

  return {
    isInPrimary,
    isInSupport,
    isForbidden,
    isOutOfTerritory,
    currentZoneId,
    shouldRecover,
    recoveryTarget,
    adjustedTarget,
  };
}
