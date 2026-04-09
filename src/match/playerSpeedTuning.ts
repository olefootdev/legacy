import type { AgentMode } from '@/agents/yukaAgents';

/** Virtual m/s on pitch (see `FIELD_LENGTH` in `field.ts`). */
export const SPEED_WALK_BASE = 3.0;
export const SPEED_RUN_BASE = 3.85;
/** Walk: `v_walk = SPEED_WALK_BASE * lerp(1, SPEED_WALK_MAX_MULT, speedAttr01)`. */
export const SPEED_WALK_MAX_MULT = 2.0;
/** Run: `v_run = SPEED_RUN_BASE * lerp(1, SPEED_RUN_MAX_MULT, speedAttr01)`. */
export const SPEED_RUN_MAX_MULT = 5.0;
/** Hard cap on `Vehicle.maxSpeed` for integrator stability. */
export const V_MAX_ABSOLUTE = 19.0;

/** First-order smoothing time constant for walk↔run blend (higher = snappier). */
export const LOCOMOTION_RUN_BLEND_SMOOTH = 9.0;

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
  const fromStamina = 0.6 + s * 0.4;
  const fit = 0.94 + f * 0.12;
  return Math.max(0.52, Math.min(1, fromStamina * fit));
}

export function locomotionWalkSpeed(speedAttr01: number, fatigueMul: number): number {
  const v01 = clamp01(speedAttr01);
  const mult = 1 + (SPEED_WALK_MAX_MULT - 1) * v01;
  return SPEED_WALK_BASE * mult * fatigueMul;
}

export function locomotionRunSpeed(speedAttr01: number, fatigueMul: number): number {
  const v01 = clamp01(speedAttr01);
  const mult = 1 + (SPEED_RUN_MAX_MULT - 1) * v01;
  return SPEED_RUN_BASE * mult * fatigueMul;
}

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
};

/**
 * Target run blend [0,1] from steering weights and match intent.
 * Simulation applies smoothing over dt before blending walk/run caps.
 */
export function targetRunBlendFromSteering(ctx: LocomotionSteeringContext): number {
  const { mode, pursuitWeight, distToBall, teamHasBall, isCarrier } = ctx;
  if (mode === 'reforming') {
    return clamp01(0.07 + Math.min(1, distToBall / 48) * 0.14);
  }
  if (isCarrier) {
    return clamp01(0.4 + pursuitWeight * 0.35 + (distToBall > 24 ? 0.14 : 0));
  }
  if (teamHasBall) {
    return clamp01(0.12 + pursuitWeight * 0.22 + Math.min(0.12, distToBall / 220));
  }
  let b = pursuitWeight * 1.82;
  if (mode === 'pressing' && distToBall < 26) b += 0.3;
  if (distToBall < 11) b += 0.24;
  else if (distToBall < 21) b += 0.11;
  return clamp01(b);
}

export function smoothRunBlend(prev: number, target: number, dt: number): number {
  const k = LOCOMOTION_RUN_BLEND_SMOOTH;
  const a = 1 - Math.exp(-k * dt);
  return prev * (1 - a) + target * a;
}
