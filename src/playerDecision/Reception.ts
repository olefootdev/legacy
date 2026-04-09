import type { DecisionContext, ReceptionType, ReceptionResult, PressureReading } from './types';
import { scanPressure } from './ContextScanner';

/**
 * Reception / ball control phase.
 * Determines how the player receives the ball: clean, oriented, fumble, etc.
 * Returns the type of reception, whether it succeeded, and how long it takes.
 */
export function resolveReception(ctx: DecisionContext): ReceptionResult {
  const pressure = scanPressure(ctx.self, ctx.opponents);
  const profile = ctx.profile;
  const drible = ctx.self.drible / 100;
  const composure = profile.composure;

  const receptionType = chooseReceptionType(pressure, profile, drible, ctx);
  const success = rollReceptionSuccess(receptionType, pressure, drible, composure);
  const duration = receptionDuration(receptionType, pressure, success);
  const errorDisplacement = success
    ? { dx: 0, dz: 0 }
    : rollFumbleDisplacement(pressure);

  return { type: receptionType, success, durationSec: duration, errorDisplacement };
}

function chooseReceptionType(
  pressure: PressureReading,
  profile: DecisionContext['profile'],
  drible: number,
  ctx: DecisionContext,
): ReceptionType {
  if (pressure.intensity === 'extreme') {
    if (profile.firstTouchPlay > 0.55 && Math.random() < profile.firstTouchPlay) {
      return 'first_touch_pass';
    }
    if (drible > 0.7 && profile.composure > 0.6 && Math.random() < 0.3) {
      return 'turn_after_control';
    }
    return Math.random() < 0.5 ? 'cushion_protect' : 'body_shield';
  }

  if (pressure.intensity === 'high') {
    if (profile.firstTouchPlay > 0.6 && Math.random() < 0.4) {
      return 'first_touch_pass';
    }
    if (profile.composure > 0.65 && Math.random() < 0.35) {
      return 'oriented_strong_side';
    }
    return 'cushion_protect';
  }

  if (pressure.intensity === 'medium') {
    const r = Math.random();
    if (r < 0.25 && profile.verticality > 0.5) return 'oriented_forward';
    if (r < 0.45) return 'oriented_strong_side';
    if (r < 0.6 && profile.firstTouchPlay > 0.5) return 'first_touch_pass';
    return 'clean_hold';
  }

  // Low or no pressure — always orient forward or let run, never freeze
  if (profile.verticality > 0.6 && Math.random() < 0.5) return 'oriented_forward';
  if (profile.dribbleTendency > 0.6 && Math.random() < 0.3) return 'let_run';

  const r = Math.random();
  if (r < 0.45) return 'oriented_forward';
  if (r < 0.65) return 'let_run';
  return 'clean_forward';
}

function rollReceptionSuccess(
  type: ReceptionType,
  pressure: PressureReading,
  drible: number,
  composure: number,
): boolean {
  let baseSuccess: number;
  switch (type) {
    case 'clean_forward':
    case 'clean_hold':
      baseSuccess = 0.92;
      break;
    case 'oriented_forward':
    case 'oriented_strong_side':
      baseSuccess = 0.85;
      break;
    case 'cushion_protect':
    case 'body_shield':
      baseSuccess = 0.78;
      break;
    case 'let_run':
      baseSuccess = 0.82;
      break;
    case 'first_touch_pass':
    case 'first_touch_shot':
      baseSuccess = 0.72;
      break;
    case 'turn_after_control':
      baseSuccess = 0.68;
      break;
    case 'freeze_assess':
      baseSuccess = 0.92;
      break;
    default:
      baseSuccess = 0.8;
  }

  const pressurePenalty =
    pressure.intensity === 'extreme' ? 0.2
    : pressure.intensity === 'high' ? 0.12
    : pressure.intensity === 'medium' ? 0.05
    : 0;

  const skill = drible * 0.15 + composure * 0.1;
  const prob = Math.max(0.15, Math.min(0.98, baseSuccess - pressurePenalty + skill));
  return Math.random() < prob;
}

function receptionDuration(
  type: ReceptionType,
  pressure: PressureReading,
  success: boolean,
): number {
  // Fumble: brief stumble, then player recovers and moves
  if (!success) return 0.15 + Math.random() * 0.1;

  // Reception is part of continuous movement — durations are minimal.
  // The player is already moving before, during, and after the touch.
  let base: number;
  switch (type) {
    case 'first_touch_pass':
    case 'first_touch_shot':
      base = 0.03;
      break;
    case 'let_run':
    case 'oriented_forward':
      base = 0.05;
      break;
    case 'clean_forward':
      base = 0.07;
      break;
    case 'oriented_strong_side':
      base = 0.08;
      break;
    case 'turn_after_control':
      base = 0.10;
      break;
    case 'cushion_protect':
    case 'body_shield':
      base = 0.10;
      break;
    case 'clean_hold':
    default:
      base = 0.07;
  }

  // Under pressure, reception is even faster (snap decision)
  if (pressure.intensity === 'extreme' || pressure.intensity === 'high') {
    base *= 0.7;
  }

  return base + Math.random() * 0.03;
}

function rollFumbleDisplacement(pressure: PressureReading): { dx: number; dz: number } {
  const mag = pressure.intensity === 'extreme' ? 3 + Math.random() * 3
    : pressure.intensity === 'high' ? 2 + Math.random() * 2
    : 1 + Math.random() * 2;
  const angle = Math.random() * Math.PI * 2;
  return { dx: Math.cos(angle) * mag, dz: Math.sin(angle) * mag };
}
