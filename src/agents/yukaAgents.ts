import {
  ArriveBehavior,
  ObstacleAvoidanceBehavior,
  PursuitBehavior,
  SeparationBehavior,
  Vector3,
  Vehicle,
  WanderBehavior,
  type GameEntity,
} from 'yuka';
import { clampToPitch, FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import { YUKA_BOUNDING_RADIUS_M, YUKA_SEPARATION_NEIGHBOR_RADIUS_M } from '@/match/tacticalSpacingTuning';
import {
  fuzzifyDistance,
  fuzzifyFatigue,
  fuzzifyRole,
  evaluateFuzzySteering,
} from './fuzzySteeringModule';

export type AgentMode = 'reforming' | 'in_play' | 'pressing';

export interface AgentBinding {
  id: string;
  slotId: string;
  side: 'home' | 'away';
  role: string;
  vehicle: Vehicle;
  arrive: ArriveBehavior;
  separation: SeparationBehavior;
  pursuit: PursuitBehavior;
  wander: WanderBehavior;
  obstacle: ObstacleAvoidanceBehavior;
  /**
   * Smoothed body facing on XZ (rad), aligned with `MatchTruthPlayer.heading` / `facingYaw`.
   * Updated after physics — not snapped each frame to velocity noise.
   */
  bodyYaw: number;
}

function makeVehicle(maxSpeed: number): Vehicle {
  const v = new Vehicle();
  v.maxSpeed = maxSpeed;
  v.maxForce = 140;
  v.boundingRadius = YUKA_BOUNDING_RADIUS_M;
  v.mass = 1;
  v.updateOrientation = false;
  return v;
}

export function createAgentBinding(
  id: string,
  slotId: string,
  side: 'home' | 'away',
  role: string,
  startX: number,
  startZ: number,
  maxSpeed = 16,
): AgentBinding {
  const vehicle = makeVehicle(maxSpeed);
  vehicle.position.set(startX, 0, startZ);
  vehicle.velocity.set(0, 0, 0);
  const target = new Vector3(startX, 0, startZ);
  const arrive = new ArriveBehavior(target, 2.2, 0.4);
  arrive.weight = 1;
  const separation = new SeparationBehavior();
  separation.weight = 0.85;
  const pursuit = new PursuitBehavior(null, 0.65);
  pursuit.weight = 0;
  const wander = new WanderBehavior();
  wander.weight = 0;
  const obstacle = new ObstacleAvoidanceBehavior([]);
  obstacle.weight = 0;
  vehicle.steering.add(obstacle);
  vehicle.steering.add(separation);
  vehicle.steering.add(pursuit);
  vehicle.steering.add(arrive);
  return {
    id,
    slotId,
    side,
    role,
    vehicle,
    arrive,
    separation,
    pursuit,
    wander,
    obstacle,
    bodyYaw: 0,
  };
}

const BODY_YAW_MAX_TURN_RAD_PER_SEC = 5.2;
const BODY_YAW_SPEED_BLEND = 0.22;

function wrapAnglePi(a: number): number {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

/**
 * Integrate smoothed facing: velocity when moving; movement intent (arrive target) when slow.
 * Convention matches historical snapshot: `Math.atan2(vx, vz)` for motion-driven facing.
 */
export function stepAgentBodyYaw(binding: AgentBinding, dt: number): void {
  const vx = binding.vehicle.velocity.x;
  const vz = binding.vehicle.velocity.z;
  const speed = Math.hypot(vx, vz);
  const px = binding.vehicle.position.x;
  const pz = binding.vehicle.position.z;
  const tx = binding.arrive.target.x;
  const tz = binding.arrive.target.z;
  const desiredMotion = Math.atan2(vx, vz);
  const desiredIntent = Math.atan2(tx - px, tz - pz);
  const w = Math.min(1, speed / BODY_YAW_SPEED_BLEND);
  let desired = desiredIntent;
  if (w > 0.02) {
    desired = desiredMotion * w + desiredIntent * (1 - w);
  }
  const delta = wrapAnglePi(desired - binding.bodyYaw);
  const maxStep = BODY_YAW_MAX_TURN_RAD_PER_SEC * dt;
  binding.bodyYaw += Math.max(-maxStep, Math.min(maxStep, delta));
  binding.bodyYaw = wrapAnglePi(binding.bodyYaw);
}

export function setArriveTarget(binding: AgentBinding, x: number, z: number, mode: AgentMode) {
  binding.arrive.target.set(x, 0, z);
  binding.arrive.deceleration = mode === 'reforming' ? 1.6 : 2.8;
  binding.arrive.weight = mode === 'reforming' ? 1.35 : 1;
  binding.separation.weight = mode === 'reforming' ? 0.35 : 0.9;
}

/**
 * Steering weights by phase and possession context.
 * Neighbor radius / bounding radius: `@/match/tacticalSpacingTuning` (aligned with test2d repulsion).
 *
 * KEY RULE: when the team HAS the ball, players must NEVER pursue it.
 * They follow their off-ball decision target (arrive) and maintain spread
 * (separation). Only the defending team pursues the ball.
 *
 * ZONE AWARENESS: defenders respect their tactical zone — zagueiros don't chase
 * the ball into midfield, laterais don't abandon their wing.
 */
export function applySteeringForPhase(
  binding: AgentBinding,
  ballVehicle: Vehicle,
  others: GameEntity[],
  mode: AgentMode,
  distToBall: number,
  teamHasBall: boolean,
  ballX?: number,
  playerX?: number,
  stamina01 = 1,
) {
  binding.pursuit.evader = ballVehicle;
  binding.obstacle.obstacles = others;

  if (mode === 'reforming') {
    binding.pursuit.weight = 0;
    binding.wander.weight = 0;
    binding.obstacle.weight = 0.25;
    binding.arrive.weight = 1.35;
    binding.separation.weight = 0.4;
    return;
  }

  binding.obstacle.weight = 0.15;

  // Guarda-redes: sem perseguição à bola através do campo — só chega com arrive ao alvo seguro.
  if (binding.role === 'gk' || binding.slotId === 'gol') {
    binding.pursuit.weight = 0;
    binding.wander.weight = 0;
    // `mode` já exclui `reforming` (ramo acima devolve cedo).
    binding.arrive.weight = 1;
    binding.separation.weight = 0.95;
    return;
  }

  // ATTACKING: team with ball — arrive domina; separação mais leve evita “dança”
  // com o alvo tático quando vários apoios convergem ao mesmo corredor.
  if (teamHasBall) {
    binding.pursuit.weight = 0;
    binding.wander.weight = 0;
    binding.arrive.weight = 1;
    binding.separation.weight = 0.74;
    return;
  }

  const forwardLine = binding.slotId === 'ata' || binding.slotId === 'pe' || binding.slotId === 'pd';
  const defensiveLine = binding.slotId === 'zag1' || binding.slotId === 'zag2' || binding.slotId === 'zag3';
  const lateralLine = binding.slotId === 'le' || binding.slotId === 'ld';

  // ZONE AWARENESS: hard constraints remain — defenders don't chase into opposing third
  const ballInDefensiveThird = ballX !== undefined && ballX < 38;
  if (defensiveLine && !ballInDefensiveThird && distToBall > 15) {
    binding.pursuit.weight = 0;
    binding.arrive.weight = 1.2;
    binding.separation.weight = 0.92;
    return;
  }

  // Fuzzy evaluation for smooth weight transitions (replaces binary IF/ELSE chains)
  const fuzzyDist = fuzzifyDistance(distToBall);
  const fuzzyFat = fuzzifyFatigue(1 - stamina01);
  const fuzzyRole = fuzzifyRole(defensiveLine, forwardLine, lateralLine);
  const fuzzy = evaluateFuzzySteering(fuzzyDist, fuzzyFat, fuzzyRole, teamHasBall);

  // Pressing mode amplifies pursuit from fuzzy output
  if (mode === 'pressing') {
    binding.pursuit.weight = fuzzy.pursuitWeight;
    binding.arrive.weight = fuzzy.arriveWeight;
    binding.separation.weight = fuzzy.separationWeight;
  } else {
    // In-play (not pressing): dampen pursuit to light levels
    binding.pursuit.weight = fuzzy.pursuitWeight * 0.4;
    binding.arrive.weight = fuzzy.arriveWeight;
    binding.separation.weight = fuzzy.separationWeight;
  }
}

export function rebuildNeighbors(team: AgentBinding[]) {
  const R = YUKA_SEPARATION_NEIGHBOR_RADIUS_M;
  const R2 = R * R;
  for (const a of team) {
    a.vehicle.neighbors.length = 0;
    for (const b of team) {
      if (a === b) continue;
      if (a.vehicle.position.squaredDistanceTo(b.vehicle.position) < R2) {
        a.vehicle.neighbors.push(b.vehicle);
      }
    }
  }
}

export function stepVehicle(binding: AgentBinding, dt: number) {
  binding.vehicle.update(dt);
  binding.vehicle.position.y = 0;
  binding.vehicle.velocity.y = 0;
  const pos = binding.vehicle.position;
  const vel = binding.vehicle.velocity;

  // Guard: if position became NaN (e.g. from corrupted arrive.target), reset to center
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z)) {
    pos.x = Number.isFinite(pos.x) ? pos.x : FIELD_LENGTH / 2;
    pos.z = Number.isFinite(pos.z) ? pos.z : FIELD_WIDTH / 2;
    vel.x = 0;
    vel.z = 0;
    return;
  }

  const c = clampToPitch(pos.x, pos.z, 0.9);
  if (c.x !== pos.x) {
    vel.x *= -0.3;
    pos.x = c.x;
  }
  if (c.z !== pos.z) {
    vel.z *= -0.3;
    pos.z = c.z;
  }
}
