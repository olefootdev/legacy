import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import type { AgentSnapshot } from '@/simulation/InteractionResolver';

/**
 * GoalThreat: measures how close the attacking team is to creating a
 * clean goal-scoring opportunity. Range 0–1.
 *
 * The entire engine should orbit this value:
 *  - Attacking team: every decision tries to INCREASE threat
 *  - Defending team: every decision tries to DECREASE threat
 *
 * Factors:
 *  - ballZoneFactor: how close the ball is to the goal
 *  - openShooters: teammates in dangerous positions with space
 *  - defensiveCompactness: how organized the defense is between ball and goal
 *  - numericalBalance: attacking superiority in the danger zone
 *  - progressionMomentum: is the play moving forward?
 *  - carrierQuality: how skilled/composed the carrier is
 */
export interface GoalThreat {
  level: number;       // 0–1: overall threat
  trend: ThreatTrend;  // is threat rising, falling, or stable?
  factors: ThreatFactors;
}

export type ThreatTrend = 'rising' | 'stable' | 'falling';

export interface ThreatFactors {
  ballZone: number;           // 0–1: proximity to goal
  openShooters: number;       // 0–1: available finishers in danger zone
  defensiveDisorganization: number; // 0–1: how broken the defensive shape is
  numericalAdvantage: number; // 0–1: attacking superiority near the box
  progressionSpeed: number;   // 0–1: how fast the play is moving forward
  carrierDanger: number;      // 0–1: how dangerous the carrier is
}

export interface ThreatContext {
  ballX: number;
  ballZ: number;
  attackDir: 1 | -1;
  carrier: AgentSnapshot | null;
  attackers: AgentSnapshot[];
  defenders: AgentSnapshot[];
  /** Previous threat level for trend calculation */
  prevThreatLevel: number;
}

const GOAL_CZ = FIELD_WIDTH / 2;
const DANGER_ZONE_DEPTH = 25;    // meters from goal considered dangerous
const BOX_DEPTH = 16.5;
const BOX_WIDTH = 40.32;

/**
 * Compute the goal threat for the attacking team.
 * This is the central metric: football is a contest between
 * building and destroying chances.
 */
export function computeGoalThreat(ctx: ThreatContext): GoalThreat {
  const factors = computeFactors(ctx);

  const level = clamp01(
    factors.ballZone * 0.28 +
    factors.openShooters * 0.22 +
    factors.defensiveDisorganization * 0.18 +
    factors.numericalAdvantage * 0.12 +
    factors.progressionSpeed * 0.10 +
    factors.carrierDanger * 0.10,
  );

  const diff = level - ctx.prevThreatLevel;
  let trend: ThreatTrend;
  if (diff > 0.03) trend = 'rising';
  else if (diff < -0.03) trend = 'falling';
  else trend = 'stable';

  return { level, trend, factors };
}

function computeFactors(ctx: ThreatContext): ThreatFactors {
  const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
  const goalZ = GOAL_CZ;

  // -- Ball zone: 0 at own goal, 1 at opponent's box
  const distToGoal = Math.abs(goalX - ctx.ballX);
  const ballZone = clamp01(1 - distToGoal / FIELD_LENGTH);

  // -- Open shooters: teammates in the danger zone with space
  const dangerZoneX0 = ctx.attackDir === 1
    ? FIELD_LENGTH - DANGER_ZONE_DEPTH
    : 0;
  const dangerZoneX1 = ctx.attackDir === 1
    ? FIELD_LENGTH
    : DANGER_ZONE_DEPTH;

  let openShooters = 0;
  let attackersInZone = 0;

  for (const att of ctx.attackers) {
    const inZone = ctx.attackDir === 1
      ? att.x > dangerZoneX0
      : att.x < dangerZoneX1;
    if (!inZone) continue;
    attackersInZone++;

    let nearestDef = Infinity;
    for (const def of ctx.defenders) {
      nearestDef = Math.min(nearestDef, Math.hypot(def.x - att.x, def.z - att.z));
    }
    if (nearestDef > 3) openShooters += 0.5;
    if (nearestDef > 6) openShooters += 0.3;
    if (Math.abs(att.z - goalZ) < BOX_WIDTH / 2) openShooters += 0.2;
  }
  const openShootersFactor = clamp01(openShooters / 2);

  // -- Defensive compactness: how many defenders are between ball and goal
  let defendersInPath = 0;
  let totalDefInHalf = 0;
  for (const def of ctx.defenders) {
    const betweenBallAndGoal = ctx.attackDir === 1
      ? def.x > ctx.ballX && def.x < goalX
      : def.x < ctx.ballX && def.x > goalX;
    if (betweenBallAndGoal) {
      defendersInPath++;
      if (Math.abs(def.z - ctx.ballZ) < 15) totalDefInHalf++;
    }
  }
  // More defenders = more compact = less threat
  const defensiveDisorganization = clamp01(1 - defendersInPath / 6);

  // -- Numerical advantage in the danger zone
  let defendersInDangerZone = 0;
  for (const def of ctx.defenders) {
    const inZone = ctx.attackDir === 1
      ? def.x > dangerZoneX0
      : def.x < dangerZoneX1;
    if (inZone) defendersInDangerZone++;
  }
  const numericalAdvantage = clamp01((attackersInZone - defendersInDangerZone + 3) / 6);

  // -- Progression speed: is the ball moving toward the goal?
  let progressionSpeed = 0;
  if (ctx.carrier) {
    const carrierDistToGoal = Math.abs(goalX - ctx.carrier.x);
    const ballDistToGoal = Math.abs(goalX - ctx.ballX);
    progressionSpeed = clamp01(1 - carrierDistToGoal / FIELD_LENGTH);
    if (carrierDistToGoal < BOX_DEPTH) progressionSpeed = 1;
  }

  // -- Carrier danger: how dangerous the player with the ball is
  let carrierDanger = 0;
  if (ctx.carrier) {
    const distFromGoal = Math.hypot(goalX - ctx.carrier.x, goalZ - ctx.carrier.z);
    const positionDanger = clamp01(1 - distFromGoal / (FIELD_LENGTH * 0.6));
    const inBox = ctx.attackDir === 1
      ? ctx.carrier.x > FIELD_LENGTH - BOX_DEPTH && Math.abs(ctx.carrier.z - goalZ) < BOX_WIDTH / 2
      : ctx.carrier.x < BOX_DEPTH && Math.abs(ctx.carrier.z - goalZ) < BOX_WIDTH / 2;

    carrierDanger = positionDanger * 0.7;
    if (inBox) carrierDanger += 0.3;

    // Carrier skill modulates slightly
    const skill = (ctx.carrier.finalizacao + ctx.carrier.drible) / 200;
    carrierDanger = clamp01(carrierDanger + skill * 0.1);
  }

  return {
    ballZone,
    openShooters: openShootersFactor,
    defensiveDisorganization,
    numericalAdvantage,
    progressionSpeed,
    carrierDanger,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Quick utility: classify threat level into human-readable tiers
 * for use in decision logic without magic numbers.
 */
export type ThreatTier = 'dormant' | 'building' | 'dangerous' | 'critical';

export function classifyThreat(level: number): ThreatTier {
  if (level < 0.2) return 'dormant';
  if (level < 0.45) return 'building';
  if (level < 0.7) return 'dangerous';
  return 'critical';
}
