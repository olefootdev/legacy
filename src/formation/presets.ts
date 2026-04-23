import { OUTSIDE_WEST_PENALTY_MIN_X_M } from '@/match/fieldZones';
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

/**
 * Escanteio — atacante (HOME ataca, corner em x≈FIELD_LENGTH).
 * Aglomera ~70% do time dentro da grande área do adversário (x ≥ 88.5) com 3-4
 * bem na pequena área (x ≥ 99.5) prontos pro cabeceio. Cobrador na bandeirinha,
 * 1 segurança no meio-campo pra contra-ataque, GR na própria meta.
 */
function presetCornerHome(ballZ: number): PresetMap {
  const m = new Map<string, { x: number; z: number }>();
  const nearSide = ballZ < FIELD_WIDTH / 2;
  // Cobrador o mais perto possível da bandeirinha.
  const takerZ = nearSide ? 2 : FIELD_WIDTH - 2;
  const GOAL_Z = FIELD_WIDTH / 2;

  m.set('gol', { x: 5, z: GOAL_Z });                   // GR protege contra-ataque
  m.set('zag2', { x: 48, z: GOAL_Z });                  // Segurança no meio-campo
  m.set('le', { x: FIELD_LENGTH - 1.5, z: takerZ });    // Cobrador do canto
  m.set('vol', { x: 82, z: GOAL_Z });                   // Rebote na entrada da área
  // Grande área + borda da pequena área (8 jogadores dentro da grande área):
  m.set('ld', { x: 91, z: nearSide ? 16 : FIELD_WIDTH - 16 }); // Curta alternativa
  m.set('mc1', { x: 94, z: GOAL_Z - 10 });
  m.set('mc2', { x: 94, z: GOAL_Z + 10 });
  m.set('zag1', { x: 99, z: GOAL_Z });                  // Referência zagueiro-surpresa
  m.set('pe', { x: 101, z: GOAL_Z - 6 });               // Primeiro pau
  m.set('pd', { x: 101, z: GOAL_Z + 6 });               // Segundo pau
  m.set('ata', { x: 103, z: GOAL_Z });                  // Na pequena área, referência central
  return m;
}

/**
 * Escanteio — defensor (HOME defende, corner do AWAY entra do lado x≈0).
 * Todos na própria grande área (x ≤ 16.5) marcando; GR na linha, 2 homens na pequena
 * área protegendo traves, 1 segurança adiantado pra sair em contra-ataque.
 */
function presetCornerDefendingHome(ballZ: number): PresetMap {
  const m = new Map<string, { x: number; z: number }>();
  const nearSide = ballZ < FIELD_WIDTH / 2;
  const GOAL_Z = FIELD_WIDTH / 2;

  m.set('gol', { x: 1.2, z: GOAL_Z });                  // Na linha
  m.set('zag1', { x: 5.5, z: GOAL_Z - 3 });             // Primeiro pau
  m.set('zag2', { x: 5.5, z: GOAL_Z + 3 });             // Segundo pau
  // Marcação homem-a-homem + zona na grande área (8 dentro):
  m.set('le', { x: 6, z: nearSide ? 4 : FIELD_WIDTH - 4 }); // Primeiro poste curto
  m.set('ld', { x: 9, z: GOAL_Z - 10 });
  m.set('mc1', { x: 9, z: GOAL_Z + 10 });
  m.set('vol', { x: 12, z: GOAL_Z });                   // Miolo da área
  m.set('mc2', { x: 14, z: GOAL_Z - 8 });
  m.set('pe', { x: 14, z: GOAL_Z + 8 });
  m.set('pd', { x: 17, z: GOAL_Z });                    // Entrada da área (rebote)
  m.set('ata', { x: 42, z: GOAL_Z });                   // Lançado pra contra-ataque
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
  /** Jogadores de campo fora da grande área (GR repõe com organização). */
  const out = OUTSIDE_WEST_PENALTY_MIN_X_M;
  // Segunda linha encostada à linha da grande área (triângulo curto fora da área)
  m.set('zag1', { x: out + 0.35, z: FIELD_WIDTH * 0.28 });
  m.set('zag2', { x: out + 0.35, z: FIELD_WIDTH * 0.72 });
  m.set('vol', { x: out + 4.5, z: gkz });
  // Laterais um pouco mais à frente
  m.set('le', { x: out + 7.5, z: 9 });
  m.set('ld', { x: out + 7.5, z: FIELD_WIDTH - 9 });
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
      return presetCornerHome(ballZ);
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

  // Escanteio: defensor tem preset PRÓPRIO (aglomera na sua área), não é espelho do atacante.
  if (phase === 'corner_kick') {
    const attackerAsHome = clonePreset(restartingPresetHomeCoords);
    const defenderAsHome = presetCornerDefendingHome(ballZ);

    if (restartingSide === 'home') {
      // HOME ataca (x alto), AWAY defende a própria área (x alto = mirror do defendingHome)
      const away = enforceMinDistFromBall(
        mirrorPresetToAway(defenderAsHome),
        ballX,
        ballZ,
        minD,
      );
      return { home: attackerAsHome, away };
    }

    // AWAY ataca (x baixo = mirror do atacante), HOME defende a própria área (x baixo)
    const away = mirrorPresetToAway(attackerAsHome);
    const home = enforceMinDistFromBall(defenderAsHome, ballX, ballZ, minD);
    return { home, away };
  }

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
