import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import type { MatchTruthPhase } from '@/bridge/matchTruthSchema';
import type { PossessionSide } from '@/engine/types';
import {
  MIN_DIST_CORNER_THROW_M,
  MIN_DIST_GOAL_KICK_M,
} from '@/simulation/StructuralEvent';

/** Posições fixas por jogador (slot id) em mundo, para bola parada. */
export type PresetMap = Map<string, { x: number; z: number }>;

function presetThrowInHome(ballX: number, ballZ: number): PresetMap {
  const m = new Map<string, { x: number; z: number }>();
  const nearX = Math.min(FIELD_LENGTH - 8, Math.max(8, ballX));
  const nearZ = Math.min(FIELD_WIDTH - 4, Math.max(4, ballZ));
  m.set('gol', { x: 6, z: FIELD_WIDTH / 2 });
  m.set('zag1', { x: 14, z: FIELD_WIDTH * 0.35 });
  m.set('zag2', { x: 14, z: FIELD_WIDTH * 0.65 });
  m.set('le', { x: 22, z: 8 });
  m.set('ld', { x: 22, z: FIELD_WIDTH - 8 });
  m.set('vol', { x: 28, z: FIELD_WIDTH / 2 });
  m.set('mc1', { x: 36, z: FIELD_WIDTH * 0.35 });
  m.set('mc2', { x: 36, z: FIELD_WIDTH * 0.65 });
  m.set('pe', { x: Math.min(nearX + 5, 85), z: Math.min(nearZ + 12, FIELD_WIDTH - 6) });
  m.set('pd', { x: Math.min(nearX + 5, 85), z: Math.max(nearZ - 12, 6) });
  m.set('ata', { x: Math.min(nearX + 12, 92), z: FIELD_WIDTH / 2 });
  return m;
}

function presetCornerHome(): PresetMap {
  const m = new Map<string, { x: number; z: number }>();
  m.set('gol', { x: 5, z: FIELD_WIDTH / 2 });
  m.set('zag1', { x: 12, z: 18 });
  m.set('zag2', { x: 12, z: FIELD_WIDTH - 18 });
  m.set('le', { x: 20, z: 10 });
  m.set('ld', { x: 20, z: FIELD_WIDTH - 10 });
  m.set('vol', { x: 26, z: FIELD_WIDTH / 2 });
  m.set('mc1', { x: 34, z: 22 });
  m.set('mc2', { x: 34, z: FIELD_WIDTH - 22 });
  m.set('pe', { x: 88, z: 8 });
  m.set('pd', { x: 88, z: FIELD_WIDTH - 8 });
  m.set('ata', { x: 96, z: FIELD_WIDTH / 2 });
  return m;
}

/**
 * Goal kick: GK deep in area; short triangle (zag1, zag2, vol) + lateral outlets (le, ld)
 * + midfield split (mc1/mc2) + forward pins — collective build-up shape.
 */
function presetGoalKickHome(): PresetMap {
  const m = new Map<string, { x: number; z: number }>();
  const gkx = 3.5;
  const gkz = FIELD_WIDTH / 2;
  m.set('gol', { x: gkx, z: gkz });
  // Short triangle around GK channel
  m.set('zag1', { x: 12, z: FIELD_WIDTH * 0.28 });
  m.set('zag2', { x: 12, z: FIELD_WIDTH * 0.72 });
  m.set('vol', { x: 16, z: gkz });
  // Lateral escape hatches
  m.set('le', { x: 20, z: 9 });
  m.set('ld', { x: 20, z: FIELD_WIDTH - 9 });
  // Midfield split for second line
  m.set('mc1', { x: 32, z: FIELD_WIDTH * 0.38 });
  m.set('mc2', { x: 32, z: FIELD_WIDTH * 0.62 });
  // Wing pins + CF reference higher (conditional depth)
  m.set('pe', { x: 44, z: 12 });
  m.set('pd', { x: 44, z: FIELD_WIDTH - 12 });
  m.set('ata', { x: 52, z: gkz });
  return m;
}

export function applyFormationPreset(
  phase: Extract<MatchTruthPhase, 'throw_in' | 'corner_kick' | 'goal_kick'>,
  ballX: number,
  ballZ: number,
): PresetMap {
  switch (phase) {
    case 'throw_in':
      return presetThrowInHome(ballX, ballZ);
    case 'corner_kick':
      return presetCornerHome();
    case 'goal_kick':
      return presetGoalKickHome();
    default:
      return new Map();
  }
}

/** Visitante: espelho grosseiro no eixo X */
export function mirrorPresetToAway(home: PresetMap): PresetMap {
  const m = new Map<string, { x: number; z: number }>();
  for (const [k, v] of home) {
    m.set(k, { x: FIELD_LENGTH - v.x, z: v.z });
  }
  return m;
}

function clonePreset(map: PresetMap): PresetMap {
  const m = new Map<string, { x: number; z: number }>();
  for (const [k, v] of map) m.set(k, { ...v });
  return m;
}

/**
 * Push each position radially outward from ball until at least minDist (opponent spacing).
 */
export function enforceMinDistFromBall(
  map: PresetMap,
  ballX: number,
  ballZ: number,
  minDist: number,
): PresetMap {
  const out = clonePreset(map);
  for (const [slot, pos] of out) {
    const dx = pos.x - ballX;
    const dz = pos.z - ballZ;
    const d = Math.hypot(dx, dz);
    if (d < 0.01 || d >= minDist) continue;
    const scale = (minDist + 0.35) / d;
    const nx = ballX + dx * scale;
    const nz = ballZ + dz * scale;
    out.set(slot, {
      x: Math.min(FIELD_LENGTH - 3, Math.max(3, nx)),
      z: Math.min(FIELD_WIDTH - 3, Math.max(3, nz)),
    });
  }
  return out;
}

function minDistForPhase(phase: Extract<MatchTruthPhase, 'throw_in' | 'corner_kick' | 'goal_kick'>): number {
  if (phase === 'goal_kick') return MIN_DIST_GOAL_KICK_M;
  return MIN_DIST_CORNER_THROW_M;
}

/**
 * Build home and away slot maps for structural set-piece repositioning.
 * Restarting team uses enhanced preset; opponents get mirrored baseline + min distance from ball.
 */
export function buildSetPieceTeamMaps(
  phase: Extract<MatchTruthPhase, 'throw_in' | 'corner_kick' | 'goal_kick'>,
  ballX: number,
  ballZ: number,
  restartingSide: PossessionSide,
  restartingPresetHomeCoords: PresetMap,
): { home: PresetMap; away: PresetMap } {
  const minD = minDistForPhase(phase);
  const mirrorAway = mirrorPresetToAway(restartingPresetHomeCoords);

  if (restartingSide === 'home') {
    const home = clonePreset(restartingPresetHomeCoords);
    let away = clonePreset(mirrorAway);
    away = enforceMinDistFromBall(away, ballX, ballZ, minD);
    return { home, away };
  }

  // Away restarts: away uses mirrored preset (their build-up in own half from sim coords)
  const away = clonePreset(mirrorAway);
  let home = clonePreset(restartingPresetHomeCoords);
  home = enforceMinDistFromBall(home, ballX, ballZ, minD);
  return { home, away };
}
