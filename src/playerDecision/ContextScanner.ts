import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import type { AgentSnapshot } from '@/simulation/InteractionResolver';
import type {
  PressureReading,
  SpaceReading,
  TeammateOption,
  FieldZone,
  TeamPhase,
  ContextReading,
  DecisionContext,
} from './types';
import { computeProgressToGoal, computeLineOfSight } from '@/match/goalContext';
import type { TeamSide, MatchHalf } from '@/match/fieldZones';

// ---------------------------------------------------------------------------
// Pressure
// ---------------------------------------------------------------------------

export function scanPressure(
  self: AgentSnapshot,
  opponents: AgentSnapshot[],
): PressureReading {
  let nearestDist = Infinity;
  let nearestSpeed = 0;
  let pressX = 0;
  let pressZ = 0;
  let inZone = 0;

  const ZONE_RADIUS = 8;

  for (const o of opponents) {
    const dx = o.x - self.x;
    const dz = o.z - self.z;
    const d = Math.hypot(dx, dz);
    if (d < nearestDist) {
      nearestDist = d;
      nearestSpeed = o.speed;
    }
    if (d < ZONE_RADIUS) {
      inZone++;
      if (d > 0.1) {
        pressX += dx / d;
        pressZ += dz / d;
      }
    }
  }

  const len = Math.hypot(pressX, pressZ);
  if (len > 0.01) { pressX /= len; pressZ /= len; }

  let intensity: PressureReading['intensity'];
  if (nearestDist > 10) intensity = 'none';
  else if (nearestDist > 6) intensity = 'low';
  else if (nearestDist > 3) intensity = 'medium';
  else if (nearestDist > 1.5) intensity = 'high';
  else intensity = 'extreme';

  // Closing speed: how fast the nearest opponent is moving.
  // If they're within dangerous range and running, they're approaching.
  const closingSpeed = nearestDist < 12 ? nearestSpeed : 0;

  return {
    nearestOpponentDist: nearestDist,
    opponentsInZone: inZone,
    pressureDirection: { x: pressX, z: pressZ },
    intensity,
    closingSpeed,
  };
}

// ---------------------------------------------------------------------------
// Space
// ---------------------------------------------------------------------------

export function scanSpace(
  self: AgentSnapshot,
  opponents: AgentSnapshot[],
  attackDir: 1 | -1,
): SpaceReading {
  const SCAN_DEPTH = 15;
  const SCAN_WIDTH = 10;

  let forwardClear = SCAN_DEPTH;
  let leftClear = SCAN_WIDTH;
  let rightClear = SCAN_WIDTH;

  for (const o of opponents) {
    const dx = (o.x - self.x) * attackDir;
    const dz = o.z - self.z;
    const dist = Math.hypot(o.x - self.x, dz);

    if (dx > 0 && dx < SCAN_DEPTH && Math.abs(dz) < 4) {
      forwardClear = Math.min(forwardClear, dx);
    }
    if (dz < 0 && Math.abs(dx) < 5 && dist < SCAN_WIDTH) {
      leftClear = Math.min(leftClear, Math.abs(dz));
    }
    if (dz > 0 && Math.abs(dx) < 5 && dist < SCAN_WIDTH) {
      rightClear = Math.min(rightClear, Math.abs(dz));
    }
  }

  return {
    forwardSpaceDepth: forwardClear,
    lateralSpaceLeft: leftClear,
    lateralSpaceRight: rightClear,
    canConductForward: forwardClear > 6,
    canConductLateral: leftClear > 5 || rightClear > 5,
  };
}

// ---------------------------------------------------------------------------
// Teammate evaluation
// ---------------------------------------------------------------------------

function angleBetween(ax: number, az: number, bx: number, bz: number): number {
  return Math.atan2(bz - az, bx - ax);
}

export function scanTeammates(
  self: AgentSnapshot,
  teammates: AgentSnapshot[],
  opponents: AgentSnapshot[],
  attackDir: 1 | -1,
): TeammateOption[] {
  const result: TeammateOption[] = [];

  for (const t of teammates) {
    if (t.id === self.id) continue;
    const dx = t.x - self.x;
    const dz = t.z - self.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5 || dist > 55) continue;

    const angle = angleBetween(self.x, self.z, t.x, t.z);
    const isForward = (attackDir === 1 && dx > 2) || (attackDir === -1 && dx < -2);

    let closestOppToTarget = Infinity;
    for (const o of opponents) {
      closestOppToTarget = Math.min(closestOppToTarget, Math.hypot(o.x - t.x, o.z - t.z));
    }
    const isOpen = closestOppToTarget > 4;

    let quality = 0.5;
    if (isOpen) quality += 0.2;
    if (isForward) quality += 0.15;
    if (dist < 15) quality += 0.1;
    if (dist > 35) quality -= 0.1;
    quality = Math.max(0, Math.min(1, quality));

    result.push({ snapshot: t, distance: dist, angle, isForward, isOpen, quality });
  }

  return result.sort((a, b) => b.quality - a.quality);
}

// ---------------------------------------------------------------------------
// Field zone
// ---------------------------------------------------------------------------

export function identifyFieldZone(x: number, attackDir: 1 | -1): FieldZone {
  const nx = attackDir === 1 ? x / FIELD_LENGTH : 1 - x / FIELD_LENGTH;

  if (nx < 0.08) return 'own_box';
  if (nx < 0.25) return 'def_third';
  if (nx < 0.38) return 'def_mid';
  if (nx < 0.62) return 'mid';
  if (nx < 0.75) return 'att_mid';
  if (nx < 0.92) return 'att_third';
  return 'opp_box';
}

// ---------------------------------------------------------------------------
// Team phase detection
// ---------------------------------------------------------------------------

export function detectTeamPhase(
  ballX: number,
  attackDir: 1 | -1,
  possession: 'home' | 'away' | null,
  selfSide: 'home' | 'away',
  carrierId: string | null,
): TeamPhase {
  const hasPossession = possession === selfSide;
  const nx = attackDir === 1 ? ballX / FIELD_LENGTH : 1 - ballX / FIELD_LENGTH;

  if (!hasPossession) {
    return carrierId ? 'transition_def' : 'transition_att';
  }

  if (nx < 0.35) return 'buildup';
  if (nx < 0.6) return 'progression';
  return 'attack';
}

// ---------------------------------------------------------------------------
// Full context scan
// ---------------------------------------------------------------------------

export function buildContextReading(ctx: DecisionContext): ContextReading {
  const pressure = scanPressure(ctx.self, ctx.opponents);
  const space = scanSpace(ctx.self, ctx.opponents, ctx.attackDir);
  const availableTeammates = scanTeammates(ctx.self, ctx.teammates, ctx.opponents, ctx.attackDir);
  const bestTeammate = availableTeammates.length > 0 ? availableTeammates[0]! : null;
  const fieldZone = identifyFieldZone(ctx.self.x, ctx.attackDir);
  const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
  const goalZ = FIELD_WIDTH / 2;
  const dx = goalX - ctx.self.x;
  const dz = goalZ - ctx.self.z;
  const distToGoal = Math.hypot(dx, dz);
  const angleToGoal = Math.abs(Math.atan2(dz, dx));

  const side = (ctx.self.side ?? ctx.possession ?? 'home') as TeamSide;
  const half = (ctx.clockHalf ?? 1) as MatchHalf;
  const progressToGoal = computeProgressToGoal(ctx.self.x, side, half);
  const lineOfSightScore = computeLineOfSight(ctx.self.x, ctx.self.z, goalX, goalZ, ctx.opponents);

  return {
    pressure,
    space,
    availableTeammates,
    bestTeammate,
    fieldZone,
    teamPhase: ctx.teamPhase,
    attackDirection: ctx.attackDir,
    distToGoal,
    angleToGoal,
    lineOfSightScore,
    progressToGoal,
    scoreDiff: ctx.scoreDiff,
    minute: ctx.minute,
    mentality: ctx.mentality,
    threatLevel: ctx.threatLevel,
    threatTrend: ctx.threatTrend,
  };
}
