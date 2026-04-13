import type { DecisionContext, PreReceptionIntent, PreReceptionResult, ContextReading, OnBallAction } from './types';
import type { AgentSnapshot } from '@/simulation/InteractionResolver';
import { buildContextReading, isReceivingBackToGoalShaped } from './ContextScanner';
import { passTargetThreatDepth01 } from '@/simulation/InteractionResolver';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';

function countTeammatesNearPoint(
  teammates: readonly AgentSnapshot[],
  excludeId: string,
  px: number,
  pz: number,
  radius: number,
): number {
  let n = 0;
  for (const t of teammates) {
    if (t.id === excludeId) continue;
    if (Math.hypot(t.x - px, t.z - pz) < radius) n++;
  }
  return n;
}

/**
 * Pre-reception: what the player does before the ball arrives.
 * Determines body orientation, scanning, and anticipated action.
 */
export function resolvePreReception(ctx: DecisionContext): PreReceptionResult {
  const reading = buildContextReading(ctx);
  const profile = ctx.profile;

  const receiveFree = reading.pressure.intensity === 'none' || reading.pressure.intensity === 'low';
  const backToGoalShaped = isReceivingBackToGoalShaped(ctx, reading);
  const crowdNearBall = countTeammatesNearPoint(ctx.teammates, ctx.self.id, ctx.ballX, ctx.ballZ, 11) >= 2;
  let intent = choosePreReceptionIntent(reading, profile, receiveFree, backToGoalShaped, crowdNearBall);
  const pt = ctx.prethinking?.prethinkingIntent;
  if (receiveFree && pt) {
    if (pt === 'receber_e_girar' || pt === 'passe_rapido') {
      if (intent === 'scan_shoulder' || intent === 'approach_pass') {
        intent = reading.space.canConductForward ? 'adjust_body_forward' : intent;
      }
      if (pt === 'passe_rapido' && profile.firstTouchPlay > 0.42 && reading.bestTeammate?.isForward) {
        intent = 'prepare_first_touch';
      }
    }
    if (pt === 'proteger_bola' && (reading.pressure.intensity === 'high' || reading.pressure.intensity === 'extreme')) {
      intent = 'adjust_body_safety';
    }
  }
  const bodyAngle = computeBodyAngle(ctx, reading, intent, backToGoalShaped);
  const anticipated = anticipateAction(reading, profile, receiveFree);

  return { intent, bodyAngle, receiveFree, anticipatedAction: anticipated };
}

function choosePreReceptionIntent(
  reading: ContextReading,
  profile: DecisionContext['profile'],
  receiveFree: boolean,
  backToGoalShaped: boolean,
  crowdNearBall: boolean,
): PreReceptionIntent {
  if (crowdNearBall && receiveFree) {
    return 'attack_space';
  }

  if (backToGoalShaped) {
    if (receiveFree || reading.pressure.intensity === 'medium') {
      if (profile.firstTouchPlay > 0.48 && reading.bestTeammate?.isForward) return 'prepare_first_touch';
      return reading.space.canConductForward ? 'attack_space' : 'adjust_body_forward';
    }
  }

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
  backToGoalShaped: boolean,
): number {
  const attackAngle = ctx.attackDir === 1 ? 0 : Math.PI;
  const toBall = Math.atan2(ctx.ballZ - ctx.self.z, ctx.ballX - ctx.self.x);

  if (backToGoalShaped && intent !== 'adjust_body_safety' && intent !== 'decelerate' && intent !== 'evade_marker') {
    return attackAngle;
  }

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
    const ad = reading.attackDirection;
    const gx = ad === 1 ? FIELD_LENGTH : 0;
    return {
      type: 'short_pass_safety',
      option: {
        targetId: t.id,
        targetX: t.x,
        targetZ: t.z,
        distance: reading.bestTeammate.distance,
        successProb: 0.7,
        isForward: reading.bestTeammate.isForward,
        isLong: false,
        progressionGain: 0,
        spaceAtTarget: 5,
        linesBroken: 0,
        threatDepth01: passTargetThreatDepth01(t.x, ad),
        distToOppGoal: Math.hypot(gx - t.x, FIELD_WIDTH / 2 - t.z),
        sectorVacancy01: 0.5,
      },
    };
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
