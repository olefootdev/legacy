import type { OnBallAction, OffBallAction, DecisionOutcome, DecisionResult, ContextReading, PlayerProfile } from './types';

/**
 * After a decision is made and execution begins, resolve the outcome.
 * Determines quality of execution and whether errors occur.
 */
export function resolveOnBallOutcome(
  action: OnBallAction,
  reading: ContextReading,
  profile: PlayerProfile,
  attrs: { passe: number; drible: number; finalizacao: number; velocidade: number },
): DecisionResult {
  const quality = rollExecutionQuality(action, reading, profile, attrs);
  const outcome = determineOutcome(action, quality, reading, profile);
  return { action, outcome, executionQuality: quality };
}

export function resolveOffBallOutcome(
  action: OffBallAction,
  reading: ContextReading,
  profile: PlayerProfile,
): DecisionResult {
  const quality = 0.6 + profile.workRate * 0.3 + Math.random() * 0.1;
  return { action, outcome: quality > 0.7 ? 'success' : 'deceleration', executionQuality: quality };
}

// ---------------------------------------------------------------------------
// Execution quality
// ---------------------------------------------------------------------------

function rollExecutionQuality(
  action: OnBallAction,
  reading: ContextReading,
  profile: PlayerProfile,
  attrs: { passe: number; drible: number; finalizacao: number; velocidade: number },
): number {
  let base = 0.6;

  switch (action.type) {
    case 'short_pass_safety':
    case 'lateral_pass':
      base = 0.7 + (attrs.passe / 100) * 0.2;
      break;
    case 'vertical_pass':
    case 'through_ball':
    case 'switch_play':
      base = 0.55 + (attrs.passe / 100) * 0.25 + profile.vision * 0.1;
      break;
    case 'long_ball':
      base = 0.45 + (attrs.passe / 100) * 0.3;
      break;
    case 'one_two':
      base = 0.5 + (attrs.passe / 100) * 0.2 + profile.firstTouchPlay * 0.15;
      break;
    case 'simple_carry':
      base = 0.75 + (attrs.drible / 100) * 0.15;
      break;
    case 'aggressive_carry':
    case 'progressive_dribble':
      base = 0.55 + (attrs.drible / 100) * 0.25 + profile.dribbleTendency * 0.1;
      break;
    case 'beat_marker':
    case 'cut_inside':
    case 'turn_on_marker':
      base = 0.4 + (attrs.drible / 100) * 0.35 + profile.composure * 0.1;
      break;
    case 'shoot':
    case 'shoot_long_range':
      base = 0.5 + (attrs.finalizacao / 100) * 0.3;
      break;
    case 'low_cross':
    case 'high_cross':
      base = 0.5 + (attrs.passe / 100) * 0.25;
      break;
    case 'hold_ball':
    case 'shield_ball':
      base = 0.65 + profile.composure * 0.2;
      break;
    case 'clearance':
      base = 0.7 + (attrs.passe / 100) * 0.1;
      break;
    default:
      base = 0.6;
  }

  // Pressure penalty
  const pressurePenalty =
    reading.pressure.intensity === 'extreme' ? 0.2
    : reading.pressure.intensity === 'high' ? 0.1
    : reading.pressure.intensity === 'medium' ? 0.04
    : 0;

  base -= pressurePenalty;
  base += profile.composure * 0.05;
  base += (Math.random() - 0.5) * 0.15;

  return Math.max(0.05, Math.min(0.98, base));
}

// ---------------------------------------------------------------------------
// Outcome determination
// ---------------------------------------------------------------------------

function determineOutcome(
  action: OnBallAction,
  quality: number,
  reading: ContextReading,
  profile: PlayerProfile,
): DecisionOutcome {
  if (quality > 0.8) {
    if (isProgressiveAction(action) && reading.space.canConductForward) return 'advantage_created';
    if (quality > 0.9) return 'acceleration';
    return 'success';
  }

  if (quality > 0.55) return 'success';

  if (quality > 0.35) {
    if (reading.pressure.intensity === 'extreme') return 'dangerous_loss';
    return 'technical_error';
  }

  if (quality > 0.2) {
    if (reading.fieldZone === 'def_third' || reading.fieldZone === 'own_box') return 'dangerous_loss';
    return 'reading_error';
  }

  return 'intercepted';
}

function isProgressiveAction(action: OnBallAction): boolean {
  return action.type === 'vertical_pass'
    || action.type === 'through_ball'
    || action.type === 'progressive_dribble'
    || action.type === 'aggressive_carry'
    || action.type === 'long_ball'
    || action.type === 'enter_box';
}
