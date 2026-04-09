import { Mesh, Vector3 } from '@babylonjs/core';
import { FIELD_LENGTH, FIELD_WIDTH } from './formation433';

export type MatchVisualState = 'BOLA_VIVA' | 'LATERAL' | 'ESCANTEIO' | 'TIRO_DE_META';

interface RestartPosition {
  ball: { x: number; z: number };
  /** Indexes of nearby players that should reposition (0-based). */
  nearbyPlayerPositions: { id: string; x: number; z: number }[];
}

const HALF_L = FIELD_LENGTH / 2;
const HALF_W = FIELD_WIDTH / 2;

/**
 * Compute restart positions for a given visual state.
 * The positions are deterministic but can vary slightly for visual interest.
 */
export function computeRestartPositions(
  state: MatchVisualState,
  playerIds: string[],
): RestartPosition {
  switch (state) {
    case 'LATERAL': {
      // Throw-in: ball near touchline at ~1/3 field, nearby players cluster
      const bx = FIELD_LENGTH * 0.35;
      const bz = 0.5; // near north touchline
      const thrower = playerIds[3]; // arbitrary player
      const nearby = [
        { id: thrower ?? 'p0', x: bx, z: bz + 1.5 },
        { id: playerIds[4] ?? 'p1', x: bx + 5, z: bz + 6 },
        { id: playerIds[5] ?? 'p2', x: bx - 4, z: bz + 8 },
        { id: playerIds[8] ?? 'p3', x: bx + 2, z: bz + 12 },
      ];
      return { ball: { x: bx, z: bz }, nearbyPlayerPositions: nearby };
    }

    case 'ESCANTEIO': {
      // Corner kick: ball at corner flag, attackers in/near box
      const bx = FIELD_LENGTH - 0.5;
      const bz = 0.5;
      const nearby = [
        { id: playerIds[7] ?? 'p0', x: bx - 1, z: bz + 2 },   // taker
        { id: playerIds[9] ?? 'p1', x: bx - 10, z: HALF_W - 3 }, // near post
        { id: playerIds[10] ?? 'p2', x: bx - 12, z: HALF_W + 4 }, // far post
        { id: playerIds[8] ?? 'p3', x: bx - 8, z: HALF_W },      // penalty spot
        { id: playerIds[6] ?? 'p4', x: bx - 18, z: HALF_W + 2 }, // edge of box
      ];
      return { ball: { x: bx, z: bz }, nearbyPlayerPositions: nearby };
    }

    case 'TIRO_DE_META': {
      // Goal kick: ball in 6-yard box, GK nearby, team pushed up
      const bx = 5.5;
      const bz = HALF_W + 3;
      const nearby = [
        { id: playerIds[0] ?? 'p0', x: 3, z: HALF_W },         // GK
        { id: playerIds[1] ?? 'p1', x: 18, z: HALF_W - 12 },   // CB left
        { id: playerIds[2] ?? 'p2', x: 18, z: HALF_W + 12 },   // CB right
        { id: playerIds[3] ?? 'p3', x: 22, z: 8 },              // LB
        { id: playerIds[4] ?? 'p4', x: 22, z: FIELD_WIDTH - 8 }, // RB
      ];
      return { ball: { x: bx, z: bz }, nearbyPlayerPositions: nearby };
    }

    case 'BOLA_VIVA':
    default: {
      return { ball: { x: HALF_L, z: HALF_W }, nearbyPlayerPositions: [] };
    }
  }
}

/**
 * Smoothly lerp a mesh position to a target over time.
 * Returns true when the mesh is within tolerance of the target.
 */
export function lerpMeshToTarget(
  mesh: Mesh,
  targetX: number,
  targetZ: number,
  targetY: number,
  dt: number,
  speed = 4.0,
): boolean {
  const tx = targetX;
  const tz = targetZ;
  const ty = targetY;
  const k = Math.min(1, dt * speed);
  mesh.position.x += (tx - mesh.position.x) * k;
  mesh.position.z += (tz - mesh.position.z) * k;
  mesh.position.y += (ty - mesh.position.y) * k;
  const dx = tx - mesh.position.x;
  const dz = tz - mesh.position.z;
  return Math.abs(dx) < 0.1 && Math.abs(dz) < 0.1;
}

/**
 * Demo ball orbit for BOLA_VIVA state.
 * Returns the ball position for this frame.
 */
export function demoBallOrbit(elapsed: number): { x: number; z: number; y: number } {
  const t = elapsed * 0.4;
  const rx = 18;
  const rz = 12;
  return {
    x: HALF_L + Math.cos(t) * rx + Math.sin(t * 0.7) * 6,
    z: HALF_W + Math.sin(t) * rz + Math.cos(t * 1.3) * 4,
    y: 0.34 + Math.abs(Math.sin(t * 2.1)) * 0.8,
  };
}
