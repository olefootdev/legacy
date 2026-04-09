import type { DecisionContext, PreReceptionIntent, PreReceptionResult, ContextReading, OnBallAction } from './types';
import { buildContextReading } from './ContextScanner';

/**
 * Pre-reception: what the player does before the ball arrives.
 * Determines body orientation, scanning, and anticipated action.
 */
export function resolvePreReception(ctx: DecisionContext): PreReceptionResult {
  const reading = buildContextReading(ctx);
  const profile = ctx.profile;

  const receiveFree = reading.pressure.intensity === 'none' || reading.pressure.intensity === 'low';
  const intent = choosePreReceptionIntent(reading, profile, receiveFree);
  const bodyAngle = computeBodyAngle(ctx, reading, intent);
  const anticipated = anticipateAction(reading, profile, receiveFree);

  return { intent, bodyAngle, receiveFree, anticipatedAction: anticipated };
}

function choosePreReceptionIntent(
  reading: ContextReading,
  profile: DecisionContext['profile'],
  receiveFree: boolean,
): PreReceptionIntent {
  if (receiveFree) {
    if (profile.verticality > 0.6 && reading.space.canConductForward) {
      return 'adjust_body_forward';
    }
    if (profile.firstTouchPlay > 0.55 && reading.bestTeammate?.isForward) {
      return 'prepare_first_touch';
    }
    if (reading.space.canConductForward) {
      return 'attack_space';
    }
    return 'scan_shoulder';
  }

  if (reading.pressure.intensity === 'extreme') {
    if (profile.firstTouchPlay > 0.5 && reading.bestTeammate) {
      return 'signal_return';
    }
    return 'adjust_body_safety';
  }

  if (reading.pressure.intensity === 'high') {
    if (profile.composure > 0.65) {
      return 'evade_marker';
    }
    return 'adjust_body_safety';
  }

  if (reading.pressure.opponentsInZone >= 2) {
    return 'decelerate';
  }

  return 'approach_pass';
}

function computeBodyAngle(
  ctx: DecisionContext,
  reading: ContextReading,
  intent: PreReceptionIntent,
): number {
  const attackAngle = ctx.attackDir === 1 ? 0 : Math.PI;
  const toBall = Math.atan2(ctx.ballZ - ctx.self.z, ctx.ballX - ctx.self.x);

  switch (intent) {
    case 'adjust_body_forward':
    case 'attack_space':
      return attackAngle;
    case 'adjust_body_safety':
    case 'decelerate':
      return toBall;
    case 'evade_marker': {
      const awayFromPressure = Math.atan2(
        -reading.pressure.pressureDirection.z,
        -reading.pressure.pressureDirection.x,
      );
      return awayFromPressure;
    }
    case 'prepare_first_touch':
    case 'signal_return':
      return reading.bestTeammate
        ? Math.atan2(
            reading.bestTeammate.snapshot.z - ctx.self.z,
            reading.bestTeammate.snapshot.x - ctx.self.x,
          )
        : toBall;
    default:
      return (attackAngle + toBall) / 2;
  }
}

function anticipateAction(
  reading: ContextReading,
  profile: DecisionContext['profile'],
  receiveFree: boolean,
): OnBallAction | null {
  if (!receiveFree && profile.firstTouchPlay > 0.6 && reading.bestTeammate) {
    const t = reading.bestTeammate.snapshot;
    return { type: 'short_pass_safety', option: {
      targetId: t.id, targetX: t.x, targetZ: t.z,
      distance: reading.bestTeammate.distance,
      successProb: 0.7, isForward: reading.bestTeammate.isForward, isLong: false,
      progressionGain: 0, spaceAtTarget: 5, linesBroken: 0,
    }};
  }

  if (receiveFree && reading.space.canConductForward && profile.dribbleTendency > 0.5) {
    return {
      type: 'aggressive_carry',
      targetX: reading.attackDirection === 1
        ? Math.min(105, reading.attackDirection * 10 + 0) // placeholder
        : 0,
      targetZ: 0,
    };
  }

  return null;
}
