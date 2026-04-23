/**
 * SMARTFIELD Bridge — TypeScript consumer for the Python-generated field model.
 *
 * Loads the static snapshot exported by `smartfield_engine.py` and exposes
 * typed helpers that TacticalSimLoop, fieldZones, tacticalPositioning and
 * the live 2D match renderer can call.
 *
 * The Python engine (`smartfield_engine.py` + `smartfield_schema.py`) is the
 * authoritative source of tactical geometry.  At build time, running
 *   `python smartfield/smartfield_debug.py --snapshot`
 * re-generates `smartfield_snapshot.json` consumed here.
 */
import snapshotData from './smartfield_snapshot.json';

// ── Types ──────────────────────────────────────────────────────────

export interface SfPoint {
  x: number;
  z: number;
}

export interface SfRect {
  x_min: number;
  z_min: number;
  x_max: number;
  z_max: number;
}

export interface SfGoalDefinition {
  goal_line_x: number;
  near_post: SfPoint;
  far_post: SfPoint;
  center: SfPoint;
  mouth_rect: SfRect;
  six_yard_box: SfRect;
  penalty_box: SfRect;
  penalty_spot: SfPoint;
  near_post_zone: SfRect;
  far_post_zone: SfRect;
  central_channel: SfRect;
}

export interface SfZone {
  id: string;
  rect: SfRect;
  third: string;
  lane: string;
}

export interface SfAnchor {
  role: string;
  base_anchor: SfPoint;
  allowed_radius: number;
  support_zones: string[];
  defensive_zones: string[];
  attack_zones: string[];
  transition_zones: string[];
  pressure_zones: string[];
  forbidden_zones: string[];
  recovery_priority: number;
  role_intent_weights: Record<string, number>;
}

export interface SmartfieldSnapshot {
  field: { length: number; width: number; center: SfPoint; center_circle_radius: number };
  goals: { west: SfGoalDefinition; east: SfGoalDefinition };
  macro_zones: SfZone[];
  subzones: SfZone[];
  anchors: {
    home: Record<string, SfAnchor>;
    away: Record<string, SfAnchor>;
  };
  half: number;
  formation: string;
}

/**
 * Team phase aligned with the Python `TeamPhase` enum.
 * Maps 1:1 to the freedom-radius multipliers from `smartfield_engine.py`.
 */
export type SfTeamPhase =
  | 'organized_attack'
  | 'offensive_transition'
  | 'defensive_transition'
  | 'defensive_block'
  | 'high_press'
  | 'mid_block'
  | 'low_block'
  | 'set_piece';

// ── Data ───────────────────────────────────────────────────────────

const SF: SmartfieldSnapshot = snapshotData as SmartfieldSnapshot;

// ── Queries ────────────────────────────────────────────────────────

function rectContains(r: SfRect, x: number, z: number): boolean {
  return x >= r.x_min && x <= r.x_max && z >= r.z_min && z <= r.z_max;
}

/**
 * Find the macro zone containing a world position.
 * Integration: can augment `getZoneTags` in `fieldZones.ts`.
 */
export function sfGetZone(x: number, z: number): string | null {
  for (const zone of SF.macro_zones) {
    if (rectContains(zone.rect, x, z)) return zone.id;
  }
  return null;
}

/**
 * Return the full macro-zone definition (with rect, third, lane) for a world position.
 */
export function sfGetZoneDef(x: number, z: number): SfZone | null {
  for (const zone of SF.macro_zones) {
    if (rectContains(zone.rect, x, z)) return zone;
  }
  return null;
}

/**
 * Find the subzone (gameplay-oriented) containing a world position.
 * Integration: enriches `tacticalBallZoneForTeam` or action context.
 */
export function sfGetSubzone(x: number, z: number): string | null {
  for (const sub of SF.subzones) {
    if (rectContains(sub.rect, x, z)) return sub.id;
  }
  return null;
}

/**
 * Return the full subzone definition for a world position.
 */
export function sfGetSubzoneDef(x: number, z: number): SfZone | null {
  for (const sub of SF.subzones) {
    if (rectContains(sub.rect, x, z)) return sub;
  }
  return null;
}

/**
 * Goal context from a shooting position — near/far post, angle quality, distances.
 * Integration: enriches `goalContext.ts` / `ActionResolver` shot decisions.
 */
export function sfGetGoalContext(
  x: number,
  z: number,
  attackDir: 1 | -1,
): {
  distance: number;
  angleRad: number;
  angleQuality: 'excellent' | 'good' | 'tight' | 'very_tight';
  inPenaltyBox: boolean;
  inSixYard: boolean;
  closerPost: 'near' | 'far';
  nearPost: SfPoint;
  farPost: SfPoint;
  goalCenter: SfPoint;
} {
  const goal: SfGoalDefinition = attackDir === 1 ? SF.goals.east : SF.goals.west;
  const dx = goal.goal_line_x - x;
  const dz = goal.center.z - z;
  const dist = Math.hypot(dx, dz);
  const angleRad = dist > 0.01 ? Math.abs(Math.atan2(dz, dx)) : 0;

  let angleQuality: 'excellent' | 'good' | 'tight' | 'very_tight';
  if (angleRad < 0.15) angleQuality = 'excellent';
  else if (angleRad < 0.35) angleQuality = 'good';
  else if (angleRad < 0.6) angleQuality = 'tight';
  else angleQuality = 'very_tight';

  const npDist = Math.hypot(goal.near_post.x - x, goal.near_post.z - z);
  const fpDist = Math.hypot(goal.far_post.x - x, goal.far_post.z - z);

  return {
    distance: dist,
    angleRad,
    angleQuality,
    inPenaltyBox: rectContains(goal.penalty_box, x, z),
    inSixYard: rectContains(goal.six_yard_box, x, z),
    closerPost: npDist < fpDist ? 'near' : 'far',
    nearPost: goal.near_post,
    farPost: goal.far_post,
    goalCenter: goal.center,
  };
}

/**
 * Check if a ball position is between the goalposts at a goal line.
 * Integration: replaces ad-hoc checks in `ActionResolver` / `TacticalSimLoop`.
 */
export function sfIsBetweenPosts(x: number, z: number): boolean {
  for (const goal of [SF.goals.west, SF.goals.east]) {
    if (rectContains(goal.mouth_rect, x, z)) return true;
  }
  return false;
}

/**
 * Check which post sub-zone the ball/shot targets.
 * Integration: cross/finishing decisions in `OffBallDecision` / `ActionResolver`.
 */
export function sfGetPostZone(
  x: number,
  z: number,
  attackDir: 1 | -1,
): 'near_post' | 'far_post' | 'central' | 'outside' {
  const goal = attackDir === 1 ? SF.goals.east : SF.goals.west;
  if (rectContains(goal.near_post_zone, x, z)) return 'near_post';
  if (rectContains(goal.far_post_zone, x, z)) return 'far_post';
  if (rectContains(goal.central_channel, x, z)) return 'central';
  return 'outside';
}

/**
 * Tactical anchor for a role.
 * Integration: can feed `TacticalAnchor` blend in `tacticalAnchorBlend.ts`.
 */
export function sfGetAnchor(
  role: string,
  side: 'home' | 'away',
): SfAnchor | undefined {
  return SF.anchors[side]?.[role];
}

/**
 * All anchors for a side — used by the tactical overlay and positioning engine.
 */
export function sfGetAllAnchors(side: 'home' | 'away'): Record<string, SfAnchor> {
  return SF.anchors[side] ?? {};
}

/**
 * Shape correction: how far a player is from their role anchor.
 * Integration: `TacticalSimLoop.nudgeTowardOperative18` / `blendOffBallDestination`.
 */
export function sfShapeCorrection(
  playerX: number,
  playerZ: number,
  role: string,
  side: 'home' | 'away',
): { distFromAnchor: number; isOutOfShape: boolean; correctionDx: number; correctionDz: number } {
  const anchor = sfGetAnchor(role, side);
  if (!anchor) return { distFromAnchor: 0, isOutOfShape: false, correctionDx: 0, correctionDz: 0 };
  const dx = anchor.base_anchor.x - playerX;
  const dz = anchor.base_anchor.z - playerZ;
  const dist = Math.hypot(dx, dz);
  const isOut = dist > anchor.allowed_radius;
  let cdx = 0;
  let cdz = 0;
  if (isOut && dist > 0.01) {
    const strength = Math.min(1, (dist - anchor.allowed_radius) / anchor.allowed_radius);
    cdx = (dx / dist) * strength;
    cdz = (dz / dist) * strength;
  }
  return { distFromAnchor: dist, isOutOfShape: isOut, correctionDx: cdx, correctionDz: cdz };
}

// ── Phase-aware movement (mirrors Python `get_player_allowed_movement`) ──

const SF_PHASE_RADIUS_MULT: Record<SfTeamPhase, number> = {
  organized_attack: 1.2,
  offensive_transition: 1.3,
  defensive_transition: 0.7,
  defensive_block: 0.6,
  high_press: 1.1,
  mid_block: 0.75,
  low_block: 0.5,
  set_piece: 0.4,
};

/**
 * Effective freedom radius for a role given the current team phase.
 * Mirrors the Python `get_player_allowed_movement`.
 */
export function sfEffectiveRadius(role: string, side: 'home' | 'away', phase: SfTeamPhase): number {
  const anchor = sfGetAnchor(role, side);
  if (!anchor) return 14;
  return anchor.allowed_radius * (SF_PHASE_RADIUS_MULT[phase] ?? 1);
}

/**
 * Whether the player should urgently recover shape — true in defensive phases when out of position.
 */
export function sfShouldRecoverShape(
  playerX: number,
  playerZ: number,
  role: string,
  side: 'home' | 'away',
  phase: SfTeamPhase,
): boolean {
  const anchor = sfGetAnchor(role, side);
  if (!anchor) return false;
  const dist = Math.hypot(anchor.base_anchor.x - playerX, anchor.base_anchor.z - playerZ);
  const effectiveR = anchor.allowed_radius * (SF_PHASE_RADIUS_MULT[phase] ?? 1);
  const isOut = dist > effectiveR;
  return isOut && (phase === 'defensive_block' || phase === 'low_block' || phase === 'defensive_transition');
}

// ── Forbidden zone enforcement ──────────────────────────────────────

/**
 * Returns true if the position falls inside any of the role's forbidden zones.
 * The tactical engine should repel the player away from forbidden zones.
 */
export function sfIsInForbiddenZone(
  x: number,
  z: number,
  role: string,
  side: 'home' | 'away',
): boolean {
  const anchor = sfGetAnchor(role, side);
  if (!anchor || anchor.forbidden_zones.length === 0) return false;
  const subzone = sfGetSubzone(x, z);
  if (!subzone) return false;
  return anchor.forbidden_zones.includes(subzone);
}

/**
 * Compute a correction vector to push a player out of their forbidden zones.
 * Returns {0,0} if the player is not in a forbidden zone.
 */
export function sfForbiddenZoneRepulsion(
  x: number,
  z: number,
  role: string,
  side: 'home' | 'away',
): { dx: number; dz: number } {
  if (!sfIsInForbiddenZone(x, z, role, side)) return { dx: 0, dz: 0 };
  const anchor = sfGetAnchor(role, side);
  if (!anchor) return { dx: 0, dz: 0 };
  const ax = anchor.base_anchor.x;
  const az = anchor.base_anchor.z;
  const dx = ax - x;
  const dz = az - z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.01) return { dx: 0, dz: 0 };
  const strength = 0.6;
  return { dx: (dx / dist) * strength, dz: (dz / dist) * strength };
}

// ── Zone context for decision-making ────────────────────────────────

/**
 * Which tactical zones are relevant for this role in the current phase.
 * Returns the subzone IDs the player should be drawn toward.
 */
export function sfActiveZonesForRole(
  role: string,
  side: 'home' | 'away',
  phase: SfTeamPhase,
): string[] {
  const anchor = sfGetAnchor(role, side);
  if (!anchor) return [];
  switch (phase) {
    case 'organized_attack':
    case 'offensive_transition':
      return [...anchor.attack_zones, ...anchor.support_zones, ...anchor.transition_zones];
    case 'defensive_block':
    case 'low_block':
    case 'defensive_transition':
      return [...anchor.defensive_zones];
    case 'high_press':
      return [...anchor.pressure_zones, ...anchor.defensive_zones];
    case 'mid_block':
      return [...anchor.defensive_zones, ...anchor.pressure_zones];
    case 'set_piece':
      return [...anchor.defensive_zones];
    default:
      return [];
  }
}

/**
 * Compute a tactical attraction vector toward the nearest active zone center.
 * Used by tacticalPositioning to pull players toward role-appropriate areas.
 */
export function sfZoneAttractionVector(
  x: number,
  z: number,
  role: string,
  side: 'home' | 'away',
  phase: SfTeamPhase,
): { dx: number; dz: number; targetZoneId: string | null } {
  const activeZoneIds = sfActiveZonesForRole(role, side, phase);
  if (activeZoneIds.length === 0) return { dx: 0, dz: 0, targetZoneId: null };

  let bestDist = Infinity;
  let bestDx = 0;
  let bestDz = 0;
  let bestId: string | null = null;

  for (const sub of SF.subzones) {
    if (!activeZoneIds.includes(sub.id)) continue;
    const cx = (sub.rect.x_min + sub.rect.x_max) / 2;
    const cz = (sub.rect.z_min + sub.rect.z_max) / 2;
    const dx = cx - x;
    const dz = cz - z;
    const d = Math.hypot(dx, dz);
    if (d < bestDist) {
      bestDist = d;
      bestDx = d > 0.01 ? dx / d : 0;
      bestDz = d > 0.01 ? dz / d : 0;
      bestId = sub.id;
    }
  }

  const strength = Math.min(1, bestDist / 30);
  return { dx: bestDx * strength, dz: bestDz * strength, targetZoneId: bestId };
}

// ── Slot ↔ Smartfield role mapping ──────────────────────────────────

import type { FormationSchemeId } from '@/match-engine/types';
import { SCHEME_LINE_GROUPS } from '@/match-engine/formations/catalog';

const SLOT_TO_SF_ROLE: Record<string, string> = {
  gol: 'GK',
  zag1: 'RCB',
  zag2: 'LCB',
  le: 'LB',
  ld: 'RB',
  vol: 'DM',
  mc1: 'CM',
  mc2: 'AM',
  pe: 'LW',
  pd: 'RW',
  ata: 'ST',
};

/**
 * Formation-aware SF role mapping — when a slot moves line in a different
 * formation (e.g. `vol` → att in 4-4-2, `le` → mid in 3-5-2),
 * pick the SF anchor that matches the tactical position, not the default.
 */
const SF_ROLE_BY_LINE: Record<string, Record<string, string>> = {
  def: { gol: 'GK', zag1: 'RCB', zag2: 'LCB', le: 'LB', ld: 'RB', vol: 'DM' },
  mid: { vol: 'DM', mc1: 'CM', mc2: 'AM', pe: 'LW', pd: 'RW', le: 'LB', ld: 'RB' },
  att: { ata: 'ST', pe: 'LW', pd: 'RW', vol: 'ST', mc1: 'AM', mc2: 'AM' },
};

/**
 * Convert a slotId to a Smartfield RoleId, optionally considering the formation.
 * Without formation, falls back to the default 4-3-3 mapping.
 */
export function sfRoleFromSlot(slotId: string, formation?: FormationSchemeId): string {
  if (slotId === 'gol') return 'GK';
  if (!formation) return SLOT_TO_SF_ROLE[slotId] ?? 'CM';

  const groups = SCHEME_LINE_GROUPS[formation];
  let line: 'def' | 'mid' | 'att' = 'mid';
  if (groups.def.includes(slotId)) line = 'def';
  else if (groups.att.includes(slotId)) line = 'att';

  return SF_ROLE_BY_LINE[line]?.[slotId] ?? SLOT_TO_SF_ROLE[slotId] ?? 'CM';
}

/** Full snapshot for inspection / forwarding. */
export function sfSnapshot(): SmartfieldSnapshot {
  return SF;
}

// ── Goal kick / restart helpers ─────────────────────────────────────

/**
 * Ball placement for a goal kick: on the six-yard box line, at the correct end.
 * Uses smartfield goal definitions for pixel-perfect placement.
 */
export function sfGoalKickBallPosition(end: 'west' | 'east'): SfPoint {
  const goal = end === 'west' ? SF.goals.west : SF.goals.east;
  return {
    x: end === 'west'
      ? goal.six_yard_box.x_max
      : goal.six_yard_box.x_min,
    z: goal.center.z,
  };
}

/**
 * GK position during goal kick restart (slightly inside six-yard box).
 */
export function sfGoalKickGkPosition(end: 'west' | 'east'): SfPoint {
  const goal = end === 'west' ? SF.goals.west : SF.goals.east;
  return {
    x: end === 'west'
      ? goal.six_yard_box.x_max - 2.5
      : goal.six_yard_box.x_min + 2.5,
    z: goal.center.z,
  };
}

/**
 * Penalty spot position from smartfield data.
 */
export function sfPenaltySpot(end: 'west' | 'east'): SfPoint {
  const goal = end === 'west' ? SF.goals.west : SF.goals.east;
  return goal.penalty_spot;
}

/**
 * Center kickoff position from smartfield field data.
 */
export function sfCenterKickoffPosition(): SfPoint {
  return SF.field.center;
}
