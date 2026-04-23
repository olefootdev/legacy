import type { AgentMode } from '@/agents/yukaAgents';

/** Virtual m/s on pitch (see `FIELD_LENGTH` in `field.ts`). */
export const SPEED_WALK_BASE = 2.35;
/** Corrida leve (jog): entre marcha e sprint. */
export const SPEED_JOG_BASE = 3.08;
/** Corrida acelerada (sprint): onde o atributo velocidade mais separa jogadores. */
export const SPEED_SPRINT_BASE = 4.38;

/** Walk: `v_walk = SPEED_WALK_BASE * lerp(1, SPEED_WALK_MAX_MULT, speedAttr01)`. */
export const SPEED_WALK_MAX_MULT = 1.74;
/** Jog: escala moderada com o atributo. */
export const SPEED_JOG_MAX_MULT = 2.52;
/** Sprint: escala forte — quem tem mais velocidade ganha corridas claras no teto. */
export const SPEED_SPRINT_MAX_MULT = 5.05;

/** @deprecated Use SPEED_SPRINT_BASE — mantido para scripts/testes legados. */
export const SPEED_RUN_BASE = SPEED_SPRINT_BASE;
/** @deprecated Use SPEED_SPRINT_MAX_MULT */
export const SPEED_RUN_MAX_MULT = SPEED_SPRINT_MAX_MULT;

/** Hard cap on `Vehicle.maxSpeed` for integrator stability. */
export const V_MAX_ABSOLUTE = 19.0;

/**
 * effort01 smoothing (0 = andar dominante, 1 = sprint dominante).
 * Valor mais alto = a intenção de esforço cola mais rápido ao alvo.
 */
export const LOCOMOTION_RUN_BLEND_SMOOTH = 10.5;

/** Até este esforço (0–1) interpola andar → corrida leve; acima, corrida leve → sprint. */
export const LOCOMOTION_JOG_PHASE_END = 0.43;

export function normalizeSpeedAttr01(velocidade: number): number {
  const c = Math.max(0, Math.min(100, velocidade));
  return c / 100;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Global fatigue on locomotion from stamina + physique (fisico).
 * Low stamina reduces speed; higher fisico mitigates the penalty slightly.
 */
export function fatigueSpeedMultiplier(stamina01: number, fisico01: number): number {
  const s = clamp01(stamina01);
  const f = clamp01(fisico01);
  const fromStamina = 0.52 + s * 0.48;
  const fit = 0.92 + f * 0.16;
  return Math.max(0.42, Math.min(1, fromStamina * fit));
}

export function locomotionWalkSpeed(speedAttr01: number, fatigueMul: number): number {
  const v01 = clamp01(speedAttr01);
  const mult = 1 + (SPEED_WALK_MAX_MULT - 1) * v01;
  return SPEED_WALK_BASE * mult * fatigueMul;
}

export function locomotionJogSpeed(speedAttr01: number, fatigueMul: number): number {
  const v01 = clamp01(speedAttr01);
  const mult = 1 + (SPEED_JOG_MAX_MULT - 1) * v01;
  return SPEED_JOG_BASE * mult * fatigueMul;
}

/** Teto de corrida acelerada (sprint). */
export function locomotionSprintSpeed(speedAttr01: number, fatigueMul: number): number {
  const v01 = clamp01(speedAttr01);
  const mult = 1 + (SPEED_SPRINT_MAX_MULT - 1) * v01;
  return SPEED_SPRINT_BASE * mult * fatigueMul;
}

/** Alias histórico: “run” = sprint. */
export function locomotionRunSpeed(speedAttr01: number, fatigueMul: number): number {
  return locomotionSprintSpeed(speedAttr01, fatigueMul);
}

/**
 * Mapa andar → corrida leve → sprint a partir do esforço desejado [0,1].
 */
export function blendThreeLocomotionCaps(
  walkSpeed: number,
  jogSpeed: number,
  sprintSpeed: number,
  effort01: number,
): number {
  const t = clamp01(effort01);
  const end = LOCOMOTION_JOG_PHASE_END;
  if (t <= end) {
    const u = end > 1e-6 ? t / end : 0;
    return walkSpeed + (jogSpeed - walkSpeed) * u;
  }
  const u = (t - end) / (1 - end);
  return jogSpeed + (sprintSpeed - jogSpeed) * u;
}

/** Dois níveis (retrocompat). Preferir `blendThreeLocomotionCaps`. */
export function blendWalkRunMaxSpeed(
  walkSpeed: number,
  runSpeed: number,
  runBlend01: number,
): number {
  const b = clamp01(runBlend01);
  return walkSpeed * (1 - b) + runSpeed * b;
}

export function clampVehicleMaxSpeed(v: number): number {
  return Math.min(V_MAX_ABSOLUTE, Math.max(0.2, v));
}

export type LocomotionSteeringContext = {
  mode: AgentMode;
  pursuitWeight: number;
  arriveWeight: number;
  distToBall: number;
  teamHasBall: boolean;
  isCarrier: boolean;
  /**
   * 0 = longe do golo adversário, 1 = zona final (mesma convenção que nx no eixo de ataque).
   * Opcional: ausente = 0.
   */
  attackProximity01?: number;
  /** 0–1: com fadiga, reduz a inclinação a correr (caminhada relativa mais alta). */
  stamina01?: number;
  /**
   * Bola solta ou em voo: eleva esforço para disputas e chegadas à bola.
   * Só deve ser true quando o motor está nesses modos.
   */
  looseOrFlightBall?: boolean;
  /**
   * Em `reforming`: jogador disciplinado longe do alvo Arrive corre de volta ao corredor;
   * sem isto o teto de esforço fica baixo (mais “caminhada”) — útil para quem é taticamente caótico.
   */
  urgeShapeReturn?: boolean;
  /** Distância ao `arrive.target` (m) — opcional, para escalar corrida de regresso à forma. */
  distToArriveTargetM?: number;
};

/**
 * Target effort [0,1] from steering weights and match intent.
 * Simulation applies smoothing over dt before blending walk/jog/sprint caps.
 */
export function targetRunBlendFromSteering(ctx: LocomotionSteeringContext): number {
  const { mode, pursuitWeight, distToBall, teamHasBall, isCarrier } = ctx;
  const ap = clamp01(ctx.attackProximity01 ?? 0);
  const st = clamp01(ctx.stamina01 ?? 1);
  const stRunMul = 0.84 + st * 0.16;
  const chaseBall = Boolean(ctx.looseOrFlightBall);

  if (mode === 'reforming') {
    let base = (0.05 + Math.min(1, distToBall / 48) * 0.12) * stRunMul;
    if (ctx.urgeShapeReturn) {
      const farSlot01 = clamp01(ctx.distToArriveTargetM ? Math.min(1, ctx.distToArriveTargetM / 55) : 0.5);
      base = Math.max(base, (0.26 + farSlot01 * 0.38) * stRunMul);
    }
    return clamp01(base);
  }
  if (isCarrier) {
    const sprintToGoal = ap * 0.40;
    return clamp01(
      (0.52 + pursuitWeight * 0.34 + (distToBall > 24 ? 0.1 : 0) + sprintToGoal) * stRunMul,
    );
  }
  if (teamHasBall) {
    const supportBurst = ap * 0.26;
    // Sem posse na própria chuteira: apoio curva menos — poupa fadiga quando o portador já segura a jogada.
    const closeSupport = distToBall < 28 ? 0.05 + (1 - distToBall / 28) * 0.11 : 0;
    const farShapeWalk = distToBall > 50 ? -0.035 - Math.min(0.07, (distToBall - 50) / 240) : 0;
    return clamp01(
      (0.15 + pursuitWeight * 0.32 + Math.min(0.14, distToBall / 180) + supportBurst + closeSupport + farShapeWalk)
        * stRunMul,
    );
  }

  let b = pursuitWeight * 2.2;
  if (mode === 'pressing' && distToBall < 28) b += 0.42;
  if (distToBall < 11) b += 0.38;
  else if (distToBall < 21) b += 0.18;
  else if (distToBall < 34) b += 0.08;

  if (chaseBall && distToBall < 46) {
    b += Math.max(0, 1 - distToBall / 50) * 0.58;
  }

  b *= stRunMul;
  return clamp01(b);
}

export function smoothRunBlend(prev: number, target: number, dt: number): number {
  const k = LOCOMOTION_RUN_BLEND_SMOOTH;
  const a = 1 - Math.exp(-k * dt);
  return prev * (1 - a) + target * a;
}

/**
 * 5 tiers de locomoção. Mapeia o `effort` (0–1) já suavizado do jogador + estado
 * de lesão em campo para um rótulo narrativo discreto, consumido pela UI e animação.
 */
export type LocomotionTier =
  | 'caminhando_lento'   // 1 — lesionado em campo, mal se move
  | 'caminhando_normal'  // 2 — deslocamento em modo espera/organização
  | 'correndo_pouco'     // 3 — trote, suporte tático
  | 'correndo_normal'    // 4 — corrida
  | 'muito_veloz';       // 5 — arranque / sprint

/**
 * Derivação estável: lesionado em campo (outForMatches > 0) força tier 1 independente
 * do esforço; caso contrário classifica por faixa de effort.
 */
export function classifyLocomotionTier(
  effort01: number,
  injuredOnPitch: boolean,
): LocomotionTier {
  if (injuredOnPitch) return 'caminhando_lento';
  const e = clamp01(effort01);
  if (e < 0.10) return 'caminhando_lento';
  if (e < 0.35) return 'caminhando_normal';
  if (e < 0.55) return 'correndo_pouco';
  if (e < 0.80) return 'correndo_normal';
  return 'muito_veloz';
}

export const LOCOMOTION_TIER_LABEL_PT: Record<LocomotionTier, string> = {
  caminhando_lento: 'Caminhando lento',
  caminhando_normal: 'Caminhando',
  correndo_pouco: 'Correndo pouco',
  correndo_normal: 'Correndo',
  muito_veloz: 'Muito veloz',
};

/** Multiplicador adicional aplicado ao `maxSpeed` quando o jogador está lesionado em campo. */
export const INJURED_ON_PITCH_SPEED_MULT = 0.42;
