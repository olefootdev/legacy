declare module 'yuka' {
  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    copy(v: Vector3): this;
    squaredDistanceTo(v: Vector3): number;
    length(): number;
    normalize(): this;
    add(v: Vector3): this;
    sub(v: Vector3): this;
    multiplyScalar(s: number): this;
    divideScalar(s: number): this;
    subVectors(a: Vector3, b: Vector3): this;
  }

  export class Vehicle {
    mass: number;
    maxForce: number;
    maxSpeed: number;
    boundingRadius: number;
    updateOrientation: boolean;
    position: Vector3;
    velocity: Vector3;
    neighbors: GameEntity[];
    steering: SteeringManager;
    update(delta: number): this;
    getSpeed(): number;
    getSpeedSquared(): number;
  }

  export type GameEntity = Vehicle;

  export class SteeringManager {
    behaviors: SteeringBehavior[];
    add(behavior: SteeringBehavior): this;
    calculate(delta: number, result: Vector3): Vector3;
  }

  export class SteeringBehavior {
    active: boolean;
    weight: number;
  }

  export class ArriveBehavior extends SteeringBehavior {
    target: Vector3;
    deceleration: number;
    tolerance: number;
    constructor(target?: Vector3, deceleration?: number, tolerance?: number);
  }

  export class SeparationBehavior extends SteeringBehavior {
    constructor();
    calculate(vehicle: Vehicle, force: Vector3, delta?: number): Vector3;
  }

  export class PursuitBehavior extends SteeringBehavior {
    evader: Vehicle | null;
    predictionFactor: number;
    constructor(evader?: Vehicle | null, predictionFactor?: number);
  }

  export class WanderBehavior extends SteeringBehavior {
    constructor();
  }

  export class ObstacleAvoidanceBehavior extends SteeringBehavior {
    obstacles: GameEntity[];
    constructor(obstacles?: GameEntity[]);
  }
}
