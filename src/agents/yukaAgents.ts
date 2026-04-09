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
import { clampToPitch } from '@/simulation/field';

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
}

function makeVehicle(maxSpeed: number): Vehicle {
  const v = new Vehicle();
  v.maxSpeed = maxSpeed;
  v.maxForce = 140;
  v.boundingRadius = 1.1;
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
  vehicle.steering.add(wander);
  vehicle.steering.add(arrive);
  return { id, slotId, side, role, vehicle, arrive, separation, pursuit, wander, obstacle };
}

export function setArriveTarget(binding: AgentBinding, x: number, z: number, mode: AgentMode) {
  binding.arrive.target.set(x, 0, z);
  binding.arrive.deceleration = mode === 'reforming' ? 1.6 : 2.8;
  binding.arrive.weight = mode === 'reforming' ? 1.35 : 1;
  binding.separation.weight = mode === 'reforming' ? 0.35 : 0.9;
}

/**
 * Steering weights by phase and possession context.
 *
 * KEY RULE: when the team HAS the ball, players must NEVER pursue it.
 * They follow their off-ball decision target (arrive) and maintain spread
 * (separation). Only the defending team pursues the ball.
 */
export function applySteeringForPhase(
  binding: AgentBinding,
  ballVehicle: Vehicle,
  others: GameEntity[],
  mode: AgentMode,
  distToBall: number,
  teamHasBall: boolean,
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

  binding.obstacle.weight = 0.32;

  // ATTACKING: team with ball — ZERO pursuit, strong separation to maintain shape
  if (teamHasBall) {
    binding.pursuit.weight = 0;
    binding.wander.weight = 0.02;
    binding.arrive.weight = 1;
    binding.separation.weight = 1.0;
    return;
  }

  // DEFENDING: team without ball — pursuit the ball carrier to press
  if (mode === 'pressing' && distToBall < 24) {
    binding.pursuit.weight = 0.48;
    binding.wander.weight = 0;
    binding.arrive.weight = 0.72;
    binding.separation.weight = 0.95;
    return;
  }

  if (distToBall < 13) {
    binding.pursuit.weight = 0.28;
  } else if (distToBall < 22) {
    binding.pursuit.weight = 0.12;
  } else {
    binding.pursuit.weight = 0;
  }

  binding.wander.weight = distToBall > 26 ? 0.05 : 0.025;
  binding.arrive.weight = 1;
  binding.separation.weight = 0.88;
}

export function rebuildNeighbors(team: AgentBinding[]) {
  const R = 7.5;
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
  const c = clampToPitch(binding.vehicle.position.x, binding.vehicle.position.z, 0.9);
  binding.vehicle.position.x = c.x;
  binding.vehicle.position.z = c.z;
}
