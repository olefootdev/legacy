import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import { findPassOptions, evaluateShot, nearestOpponentPressure01 } from '@/simulation/InteractionResolver';
import type { AgentSnapshot, PassOption } from '@/simulation/InteractionResolver';
import type {
  OnBallAction,
  ContextReading,
  DecisionContext,
  PlayerProfile,
  DecisionSpeed,
  FieldZone,
  PlayIntention,
} from './types';
import { buildContextReading } from './ContextScanner';
import { deriveFromReading } from './Intention';
import {
  mapRole,
  mapArchetype,
  extractAttributes,
  chooseAction,
  buildPlayerState,
  buildTeamTacticalContext,
  type ActionOption,
} from './collectiveIndividualDecision';
import { getZoneTags } from '@/match/fieldZones';
import { isShootMinEligible, shouldCountShootCandidate } from '@/match/shootEligibility';
import { estimatePositionalXG } from '@/match/goalContext';
import { PASS_XG_DELTA_WEIGHT, PASS_XG_DELTA_MIN_THRESHOLD } from '@/match/xgTuning';

// ---------------------------------------------------------------------------
// Decision timing
// ---------------------------------------------------------------------------

export function computeDecisionSpeed(
  reading: ContextReading,
  profile: PlayerProfile,
): DecisionSpeed {
  // URGENCY: near the goal or high threat = instant decisions
  if (reading.distToGoal < 20) return 'instant';
  if (reading.threatLevel > 0.6) return 'instant';
  if (reading.pressure.intensity === 'extreme') return 'instant';

  // APPROACH SENSE: opponent running at us — no time to think
  if (reading.pressure.closingSpeed > 8 && reading.pressure.nearestOpponentDist < 8) return 'instant';
  if (reading.pressure.closingSpeed > 5 && reading.pressure.nearestOpponentDist < 12) return 'fast';

  if (reading.distToGoal < 30 && reading.threatLevel > 0.4) return 'fast';
  if (reading.pressure.intensity === 'high') return 'fast';

  // Medium closing speed still raises urgency above normal
  if (reading.pressure.closingSpeed > 3 && reading.pressure.nearestOpponentDist < 10) return 'normal';

  // COMFORT ZONE: own half, no pressure, space — player can think
  if (reading.fieldZone === 'own_box' || reading.fieldZone === 'def_third') {
    if (reading.pressure.intensity === 'none') return 'slow';
  }
  if (reading.pressure.intensity === 'none' && reading.space.canConductForward
      && reading.fieldZone !== 'att_third' && reading.fieldZone !== 'opp_box') {
    return 'slow';
  }

  return 'normal';
}

function retShoot(reading: ContextReading, ctx: DecisionContext, longRange: boolean): OnBallAction {
  ctx.noteShootChosen?.();
  return longRange ? { type: 'shoot_long_range' } : { type: 'shoot' };
}

export function decisionDelaySec(speed: DecisionSpeed): number {
  // Urgency vs comfort zone:
  //  - 'instant': danger zone / shooting opportunity — act NOW
  //  - 'fast': under pressure or in attack — quick decisions
  //  - 'normal': midfield, balanced — standard reading time
  //  - 'slow': comfort zone (own half, no pressure) — think, circulate, survey
  switch (speed) {
    case 'instant': return 0.02;
    case 'fast': return 0.06 + Math.random() * 0.03;
    case 'normal': return 0.10 + Math.random() * 0.05;
    case 'slow': return 0.22 + Math.random() * 0.10;
  }
}

// ---------------------------------------------------------------------------
// Main on-ball decision — INTENTION → ACTION
// ---------------------------------------------------------------------------

export function decideOnBall(ctx: DecisionContext): OnBallAction {
  const reading = buildContextReading(ctx);
  if (ctx.isCarrier && ctx.noteShootCandidate && shouldCountShootCandidate(ctx.self, reading, ctx)) {
    ctx.noteShootCandidate();
  }
  const intention = deriveFromReading(ctx, reading);
  return decideOnBallWithIntention(ctx, reading, intention);
}

export function decideOnBallWithIntention(
  ctx: DecisionContext,
  reading: ContextReading,
  intention: PlayIntention,
): OnBallAction {
  const profile = ctx.profile;
  let passOptions = findPassOptions(ctx.self, ctx.teammates, ctx.opponents, ctx.attackDir);
  if (ctx.passBlocklist?.length) {
    const bl = new Set(ctx.passBlocklist);
    passOptions = passOptions.filter((o) => !bl.has(o.targetId));
  }
  const shot = evaluateShot(ctx.self, ctx.attackDir, ctx.opponents);

  // Collective/Individual architecture layer: score canonical actions
  // by role fit + attributes + archetype + context risk.
  if (passOptions.length > 0) {
    const attrs = extractAttributes(ctx.self, ctx.profile);
    const role = mapRole(ctx.self);
    const arch = mapArchetype(ctx.profile, ctx.self);
    const tctx = buildTeamTacticalContext(ctx);
    const pressure01 = nearestOpponentPressure01(ctx.self, ctx.opponents);
    const pstate = buildPlayerState(ctx, pressure01);

    const safePass = passOptions.find((p) => p.successProb > 0.62 && !p.isForward) ?? passOptions[0]!;
    const progressive = passOptions.find((p) => p.isForward && p.successProb > 0.35) ?? passOptions[0]!;
    const longPass = passOptions.find((p) => p.isLong && p.isForward && p.successProb > 0.28) ?? progressive;
    const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
    const crossZ = clampZ(FIELD_WIDTH / 2 + (ctx.self.z < FIELD_WIDTH / 2 ? 10 : -10));
    const crossX = clampX(goalX - ctx.attackDir * 14);
    const wingSlot =
      ctx.self.slotId?.includes('pe')
      || ctx.self.slotId?.includes('pd')
      || ctx.self.slotId === 'le'
      || ctx.self.slotId === 'ld';
    const options: ActionOption[] = [
      { id: 'pass_safe', pass: safePass },
      { id: 'pass_progressive', pass: progressive },
      { id: 'pass_long', pass: longPass },
      { id: 'carry', targetX: clampX(ctx.self.x + ctx.attackDir * 6), targetZ: clampZ(ctx.self.z) },
      { id: 'dribble_risk', targetX: clampX(ctx.self.x + ctx.attackDir * 8), targetZ: clampZ(ctx.self.z + (Math.random() - 0.5) * 6) },
      { id: 'shoot' },
      { id: 'clearance', targetX: clampX(ctx.attackDir === 1 ? FIELD_LENGTH - 8 : 8), targetZ: FIELD_WIDTH / 2 },
    ];
    if (wingSlot || Math.abs(ctx.self.z - FIELD_WIDTH / 2) > 14) {
      options.splice(3, 0, { id: 'cross', targetX: crossX, targetZ: crossZ });
    }
    const half = ctx.clockHalf ?? 1;
    const zoneTags = getZoneTags({ x: ctx.self.x, z: ctx.self.z }, { team: ctx.self.side, half });
    const shootFloorEligible = isShootMinEligible(ctx.self, reading, ctx);
    const pick = chooseAction(role, attrs, arch, tctx, pstate, options, !!ctx.decisionDebug, {
      tags: zoneTags,
      shootFloorEligible,
      shootBudgetForce: !!ctx.shootBudgetForce && shootFloorEligible,
    });

    ctx.noteCarrierDecisionDebug?.({
      zoneTags: zoneTags.join('+'),
      top3: pick.top3.map((t) => `${t.id}:${t.score.toFixed(2)}`).join(' | '),
      pickedId: pick.action.id,
    });

    if (pick.action.id === 'shoot' && isShootMinEligible(ctx.self, reading, ctx)) {
      const allow =
        canShoot(reading, shot.xG, ctx.shootBudgetForce || ctx.offensiveStallShotBoost ? 0.12 : 0, ctx.profile)
        || ctx.shootBudgetForce
        || ctx.offensiveStallShotBoost
        || shot.xG >= 0.038;
      if (allow) {
        return retShoot(reading, ctx, reading.distToGoal > 22);
      }
    }
    if (pick.action.id === 'cross' && pick.action.targetX != null && pick.action.targetZ != null) {
      return { type: 'low_cross', targetX: pick.action.targetX, targetZ: pick.action.targetZ };
    }
    if (pick.action.id === 'pass_progressive' && pick.action.pass) {
      const p = pick.action.pass;
      if (p.isLong && p.isForward) return { type: 'long_ball', option: p };
      if (p.linesBroken > 0) return { type: 'through_ball', option: p };
      return { type: 'vertical_pass', option: p };
    }
    if (pick.action.id === 'pass_long' && pick.action.pass) {
      return { type: 'long_ball', option: pick.action.pass };
    }
    if (pick.action.id === 'pass_safe' && pick.action.pass) {
      const p = pick.action.pass;
      return p.isForward ? { type: 'vertical_pass', option: p } : { type: 'short_pass_safety', option: p };
    }
    if (pick.action.id === 'dribble_risk') {
      return {
        type: 'progressive_dribble',
        targetX: pick.action.targetX ?? clampX(ctx.self.x + ctx.attackDir * 8),
        targetZ: pick.action.targetZ ?? clampZ(ctx.self.z),
      };
    }
    if (pick.action.id === 'carry') {
      return {
        type: 'simple_carry',
        targetX: pick.action.targetX ?? clampX(ctx.self.x + ctx.attackDir * 6),
        targetZ: pick.action.targetZ ?? ctx.self.z,
      };
    }
    if (pick.action.id === 'clearance') {
      return {
        type: 'clearance',
        targetX: pick.action.targetX ?? clampX(ctx.attackDir === 1 ? FIELD_LENGTH - 8 : 8),
        targetZ: pick.action.targetZ ?? FIELD_WIDTH / 2,
      };
    }
  }

  // Situation-specific behaviors always have priority (GK, CB clearance, etc.)
  const situational = trySituationalBehavior(ctx, reading, passOptions);
  if (situational) return situational;

  // =================================================================
  // INSTINCT LAYER — fires BEFORE intention.
  // Goal is the ultimate objective. If the player has a clear chance
  // to score or to set up a teammate for a clear chance, act NOW.
  // =================================================================
  const instinct = tryGoalInstinct(ctx, reading, passOptions, shot.xG, profile);
  if (instinct) return instinct;

  // Route by intention
  switch (intention) {
    case 'relieve_pressure':
      return decideUnderExtremePressure(ctx, reading, passOptions, profile);

    case 'protect_result':
      return decideProtectResult(ctx, reading, passOptions, profile);

    case 'maintain_possession':
      return decideMaintainPossession(ctx, reading, passOptions, profile);

    case 'reorganize':
      return decideReorganize(ctx, reading, passOptions, profile);

    case 'progress':
      return decideProgress(ctx, reading, passOptions, profile);

    case 'break_line':
      return decideBreakLine(ctx, reading, passOptions, profile);

    case 'accelerate':
    case 'attack_space':
      return decideAccelerate(ctx, reading, passOptions, profile, shot.xG);

    case 'create_chance':
      return decideCreateChance(ctx, reading, passOptions, profile, shot.xG);

    case 'finish': {
      const urgency = ctx.scoreDiff < 0 && ctx.minute > 70 ? 0.12 : 0;
      if (canShoot(reading, shot.xG, urgency, profile)) {
        return retShoot(reading, ctx, reading.distToGoal > 22 && profile.riskAppetite > 0.5);
      }
      return decideCreateChance(ctx, reading, passOptions, profile, shot.xG);
    }
  }
}

/**
 * Generates a movement action to keep the player moving during the scanning
 * phase instead of freezing with hold_ball. The carrier conducts the ball in
 * a contextually-appropriate direction while the decision resolves.
 */
export function carryScanAction(ctx: DecisionContext, reading: ContextReading): OnBallAction {
  const dir = ctx.attackDir;

  // Under pressure: shield or carry away from pressure
  if (reading.pressure.intensity === 'high' || reading.pressure.intensity === 'extreme') {
    if (reading.pressure.nearestOpponentDist < 2) return { type: 'shield_ball' };
    const awayX = ctx.self.x - reading.pressure.pressureDirection.x * 3;
    const awayZ = ctx.self.z - reading.pressure.pressureDirection.z * 3;
    return { type: 'simple_carry', targetX: clampX(awayX), targetZ: clampZ(awayZ) };
  }

  // Space ahead: carry forward (short)
  if (reading.space.canConductForward) {
    return {
      type: 'simple_carry',
      targetX: clampX(ctx.self.x + dir * 4),
      targetZ: clampZ(ctx.self.z + (Math.random() - 0.5) * 2),
    };
  }

  // Lateral space: carry sideways
  if (reading.space.canConductLateral) {
    const lateralDir = reading.space.lateralSpaceRight > reading.space.lateralSpaceLeft ? 1 : -1;
    return {
      type: 'simple_carry',
      targetX: clampX(ctx.self.x + dir * 2),
      targetZ: clampZ(ctx.self.z + lateralDir * 3),
    };
  }

  // No clear space: tiny forward movement to avoid stalling
  return {
    type: 'simple_carry',
    targetX: clampX(ctx.self.x + dir * 2),
    targetZ: ctx.self.z,
  };
}

// ---------------------------------------------------------------------------
// INSTINCT LAYER — Goal is everything
// ---------------------------------------------------------------------------

/**
 * Goal instinct: before any tactical reasoning, check if the player
 * should act on pure football instinct:
 *
 * 1. I'm in a good shooting position → SHOOT
 * 2. A teammate is in a BETTER shooting position → FIND HIM
 *
 * This layer embodies the urgency: the goal is the ultimate objective.
 * It also respects the comfort zone: in safe areas, instinct doesn't fire.
 */
function tryGoalInstinct(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: PassOption[],
  xG: number,
  profile: PlayerProfile,
): OnBallAction | null {
  const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
  const distToGoal = reading.distToGoal;

  // -----------------------------------------------------------------------
  // COMFORT ZONE: in defensive zones with no pressure, don't trigger instinct.
  // Let the player think and build the play.
  // -----------------------------------------------------------------------
  if (reading.fieldZone === 'own_box' || reading.fieldZone === 'def_third' || reading.fieldZone === 'def_mid') {
    return null;
  }

  // -----------------------------------------------------------------------
  // 1. SHOOT INSTINCT: in a good position → just shoot
  // -----------------------------------------------------------------------

  // Inside the box with any reasonable chance: shoot immediately
  if (distToGoal < 14 && xG > 0.05 && reading.pressure.opponentsInZone < 3) {
    return retShoot(reading, ctx, false);
  }

  // Edge of the box, clean sight: shoot
  if (distToGoal < 20 && xG > 0.08 && reading.pressure.opponentsInZone < 2) {
    return retShoot(reading, ctx, false);
  }

  // Medium range, good angle, space: take the shot
  if (distToGoal < 25 && xG > 0.12 && reading.pressure.nearestOpponentDist > 3) {
    return profile.riskAppetite > 0.3 ? retShoot(reading, ctx, true) : null;
  }

  // -----------------------------------------------------------------------
  // 2. KEY PASS INSTINCT: a teammate is in a prime position → find him
  //    even if he's far away. The goal is what matters.
  // -----------------------------------------------------------------------

  // Find teammate closest to goal who is OPEN (no defender near)
  const goalZ = FIELD_WIDTH / 2;
  let bestScoringTeammate: PassOption | null = null;
  let bestScoringDist = Infinity;

  for (const p of passOptions) {
    const tmDistToGoal = Math.hypot(goalX - p.targetX, goalZ - p.targetZ);
    const inDangerZone = tmDistToGoal < 22;
    const inBox = tmDistToGoal < 16;

    if (!inDangerZone) continue;

    // Forward of the carrier
    const isAhead = ctx.attackDir === 1
      ? p.targetX > ctx.self.x + 3
      : p.targetX < ctx.self.x - 3;
    if (!isAhead) continue;

    // Prioritize open teammates in the box
    if (inBox && p.successProb > 0.3 && tmDistToGoal < bestScoringDist) {
      bestScoringTeammate = p;
      bestScoringDist = tmDistToGoal;
    } else if (inDangerZone && p.successProb > 0.4 && tmDistToGoal < bestScoringDist) {
      bestScoringTeammate = p;
      bestScoringDist = tmDistToGoal;
    }
  }

  if (bestScoringTeammate) {
    const tmDistToGoal = bestScoringDist;
    const myDistToGoal = distToGoal;

    // Teammate is in a better position than me → FIND HIM
    if (tmDistToGoal < myDistToGoal - 5) {
      // Close pass to teammate in the box
      if (tmDistToGoal < 14) {
        return { type: 'through_ball', option: bestScoringTeammate };
      }
      // Vertical pass to teammate in danger zone
      return { type: 'vertical_pass', option: bestScoringTeammate };
    }

    // Teammate is in the box and I'm far out → always seek him
    if (tmDistToGoal < 16 && myDistToGoal > 25 && bestScoringTeammate.successProb > 0.35) {
      return bestScoringTeammate.isLong
        ? { type: 'long_ball', option: bestScoringTeammate }
        : { type: 'through_ball', option: bestScoringTeammate };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Situational behaviors (role + context specific)
// ---------------------------------------------------------------------------

function trySituationalBehavior(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: PassOption[],
): OnBallAction | null {
  const role = ctx.self.role;
  const slot = ctx.self.id;
  const profile = ctx.profile;

  // CDM receiving with back to goal, turning under low pressure
  if ((role === 'def' || slot.includes('vol')) && reading.pressure.intensity === 'low' && profile.composure > 0.5) {
    if (reading.space.canConductForward && Math.random() < 0.35) {
      const tx = ctx.self.x + ctx.attackDir * 8;
      const tz = ctx.self.z + (Math.random() - 0.5) * 4;
      return { type: 'turn_on_marker', targetX: clampX(tx), targetZ: clampZ(tz) };
    }
  }

  // Fullback receiving wide — advance or pass inside
  if (slot.includes('le') || slot.includes('ld')) {
    if (reading.space.canConductForward && reading.pressure.intensity !== 'high') {
      if (Math.random() < 0.4 + profile.dribbleTendency * 0.3) {
        const tx = ctx.self.x + ctx.attackDir * 12;
        return { type: 'aggressive_carry', targetX: clampX(tx), targetZ: ctx.self.z };
      }
    }
    const insidePass = passOptions.find(p =>
      Math.abs(p.targetZ - FIELD_WIDTH / 2) < 15 && p.isForward && p.successProb > 0.5,
    );
    if (insidePass) {
      return { type: 'vertical_pass', option: insidePass };
    }
  }

  // Winger 1v1 — dribble or cut inside
  if ((slot.includes('pe') || slot.includes('pd')) && reading.pressure.opponentsInZone === 1) {
    if (profile.dribbleTendency > 0.5 && Math.random() < profile.dribbleTendency) {
      const isLeft = ctx.self.z < FIELD_WIDTH / 2;
      const cutZ = isLeft ? ctx.self.z + 10 : ctx.self.z - 10;
      return { type: 'cut_inside', targetX: clampX(ctx.self.x + ctx.attackDir * 5), targetZ: clampZ(cutZ) };
    }
    if (reading.fieldZone === 'att_third' || reading.fieldZone === 'opp_box') {
      return { type: 'beat_marker', targetX: clampX(ctx.self.x + ctx.attackDir * 6), targetZ: ctx.self.z };
    }
  }

  // Striker holding up play for midfield arrival
  if (role === 'attack' && reading.pressure.intensity === 'high') {
    const nearMid = reading.availableTeammates.find(t =>
      t.snapshot.role === 'mid' && t.distance < 18 && t.isOpen,
    );
    if (nearMid && Math.random() < 0.5) {
      return { type: 'short_pass_safety', option: {
        targetId: nearMid.snapshot.id, targetX: nearMid.snapshot.x, targetZ: nearMid.snapshot.z,
        distance: nearMid.distance, successProb: 0.72, isForward: false, isLong: false,
        progressionGain: 0, spaceAtTarget: 5, linesBroken: 0,
      }};
    }
    return { type: 'hold_ball' };
  }

  // GK — short or long distribution
  if (role === 'gk') {
    const safeDef = passOptions.filter(p => p.successProb > 0.7 && !p.isLong);
    if (safeDef.length > 0 && ctx.profile.possessionBias > 0.4) {
      return { type: 'short_pass_safety', option: safeDef[0]! };
    }
    const longOpt = passOptions.find(p => p.isLong && p.isForward);
    if (longOpt) return { type: 'long_ball', option: longOpt };
    if (passOptions.length > 0) return { type: 'short_pass_safety', option: passOptions[0]! };
    return { type: 'clearance', targetX: FIELD_LENGTH / 2, targetZ: FIELD_WIDTH / 2 };
  }

  // CB under pressure clears
  if ((slot.includes('zag') || role === 'def') && reading.pressure.intensity === 'extreme') {
    if (passOptions.length === 0) {
      return { type: 'clearance', targetX: FIELD_LENGTH / 2, targetZ: FIELD_WIDTH / 2 };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Shooting check
// ---------------------------------------------------------------------------

function canShoot(
  reading: ContextReading,
  xG: number,
  urgency: number,
  profile: PlayerProfile,
): boolean {
  if (reading.distToGoal > 32) return false;

  // Threat-aware: rising threat makes finishing more likely
  const threatBonus = reading.threatTrend === 'rising' ? 0.04
    : reading.threatTrend === 'falling' ? -0.01
    : 0;
  const tierBonus = reading.threatLevel > 0.6 ? 0.05 : reading.threatLevel > 0.4 ? 0.03 : 0;

  const threshold = 0.05 - urgency - profile.riskAppetite * 0.04 - threatBonus - tierBonus;

  // Inside the box: very low threshold — shoot almost always
  if (reading.distToGoal < 14 && xG > 0.03) return true;
  // Edge of box with some quality
  if (reading.distToGoal < 20 && xG > threshold) return true;
  // Medium distance with space
  if (reading.distToGoal < 25 && reading.pressure.opponentsInZone < 2 && xG > threshold) return true;
  // Long range with conviction
  if (reading.distToGoal < 30 && xG > 0.10 && reading.pressure.nearestOpponentDist > 4) return true;
  // Rising threat: risk the shot from distance
  if (reading.threatTrend === 'rising' && reading.distToGoal < 28 && profile.riskAppetite > 0.4 && xG > 0.04) return true;
  return false;
}

// ---------------------------------------------------------------------------
// INTENTION: relieve_pressure
// ---------------------------------------------------------------------------

function decideUnderExtremePressure(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: PassOption[],
  profile: PlayerProfile,
): OnBallAction {
  const safePasses = passOptions.filter(p => p.successProb > 0.6);

  if (profile.dribbleTendency > 0.7 && Math.random() < 0.25) {
    const escapeAngle = Math.atan2(-reading.pressure.pressureDirection.z, -reading.pressure.pressureDirection.x);
    return {
      type: 'beat_marker',
      targetX: clampX(ctx.self.x + Math.cos(escapeAngle) * 5),
      targetZ: clampZ(ctx.self.z + Math.sin(escapeAngle) * 5),
    };
  }

  const relief = pickBestForIntention(passOptions, 'relieve_pressure', ctx, reading,
    p => p.successProb > 0.5);
  if (relief) return { type: 'short_pass_safety', option: relief };
  if (passOptions.length > 0) return { type: 'short_pass_safety', option: passOptions[0]! };
  if (profile.composure > 0.6) return { type: 'shield_ball' };
  return { type: 'clearance', targetX: FIELD_LENGTH / 2, targetZ: FIELD_WIDTH / 2 };
}

// ---------------------------------------------------------------------------
// INTENTION: protect_result
// ---------------------------------------------------------------------------

function decideProtectResult(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: PassOption[],
  profile: PlayerProfile,
): OnBallAction {
  const lateral = pickBestForIntention(passOptions, 'protect_result', ctx, reading,
    p => !p.isForward && p.successProb > 0.6);
  if (lateral && Math.random() < 0.6) return { type: 'lateral_pass', option: lateral };

  const safe = pickBestForIntention(passOptions, 'protect_result', ctx, reading,
    p => p.successProb > 0.65);
  if (safe) return { type: 'short_pass_safety', option: safe };

  if (reading.space.canConductLateral) {
    const latDir = reading.space.lateralSpaceRight > reading.space.lateralSpaceLeft ? 1 : -1;
    return { type: 'simple_carry', targetX: ctx.self.x, targetZ: clampZ(ctx.self.z + latDir * 6) };
  }
  return selectBestPass(passOptions, reading, profile, ctx, 'protect_result');
}

// ---------------------------------------------------------------------------
// INTENTION: maintain_possession
// ---------------------------------------------------------------------------

function decideMaintainPossession(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: PassOption[],
  profile: PlayerProfile,
): OnBallAction {
  if (reading.pressure.intensity === 'none' || reading.pressure.intensity === 'low') {
    const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
    const scoringPass = pickBestForIntention(passOptions, 'create_chance', ctx, reading, p => {
      const tmDist = Math.hypot(goalX - p.targetX, FIELD_WIDTH / 2 - p.targetZ);
      return tmDist < 22 && p.isForward && p.successProb > 0.4;
    });
    if (scoringPass && profile.vision > 0.4) {
      return scoringPass.isLong
        ? { type: 'long_ball', option: scoringPass }
        : { type: 'through_ball', option: scoringPass };
    }

    if (reading.space.canConductForward && profile.composure > 0.5 && Math.random() < 0.25) {
      return { type: 'simple_carry', targetX: clampX(ctx.self.x + ctx.attackDir * 8), targetZ: clampZ(ctx.self.z + (Math.random() - 0.5) * 4) };
    }
    const fwd = pickBestForIntention(passOptions, 'progress', ctx, reading,
      p => p.isForward && p.successProb > 0.5);
    if (fwd && Math.random() < 0.45 + profile.verticality * 0.25) {
      return { type: 'vertical_pass', option: fwd };
    }
  }

  const lateralPass = pickBestForIntention(passOptions, 'maintain_possession', ctx, reading,
    p => !p.isForward && !p.isLong && p.successProb > 0.65);
  if (lateralPass && profile.possessionBias > 0.4 && Math.random() < 0.5) {
    return { type: 'lateral_pass', option: lateralPass };
  }

  if (reading.pressure.intensity === 'high') {
    const back = pickBestForIntention(passOptions, 'relieve_pressure', ctx, reading,
      p => !p.isForward && p.successProb > 0.65);
    if (back) return { type: 'short_pass_safety', option: back };
    return { type: 'retreat_reorganize', targetX: clampX(ctx.self.x - ctx.attackDir * 5), targetZ: ctx.self.z };
  }

  return selectBestPass(passOptions, reading, profile, ctx, 'maintain_possession');
}

// ---------------------------------------------------------------------------
// INTENTION: reorganize
// ---------------------------------------------------------------------------

function decideReorganize(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: PassOption[],
  profile: PlayerProfile,
): OnBallAction {
  const switchPass = pickBestForIntention(passOptions, 'reorganize', ctx, reading,
    p => Math.abs(p.targetZ - ctx.self.z) > 25 && p.successProb > 0.45);
  if (switchPass) return { type: 'switch_play', option: switchPass };

  const safe = pickBestForIntention(passOptions, 'reorganize', ctx, reading,
    p => p.successProb > 0.6);
  if (safe) return { type: 'lateral_pass', option: safe };

  if (reading.space.canConductLateral) {
    const latDir = reading.space.lateralSpaceRight > reading.space.lateralSpaceLeft ? 1 : -1;
    return { type: 'simple_carry', targetX: clampX(ctx.self.x + ctx.attackDir * 2), targetZ: clampZ(ctx.self.z + latDir * 5) };
  }

  return selectBestPass(passOptions, reading, profile, ctx, 'reorganize');
}

// ---------------------------------------------------------------------------
// INTENTION: progress
// ---------------------------------------------------------------------------

function decideProgress(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: PassOption[],
  profile: PlayerProfile,
): OnBallAction {
  const threatRising = reading.threatTrend === 'rising';

  const vertProb = threatRising ? 0.45 : 0.35;
  const verticalPass = pickBestForIntention(passOptions, 'progress', ctx, reading,
    p => p.isForward && !p.isLong && p.successProb > 0.4);
  if (verticalPass && Math.random() < vertProb + profile.verticality * 0.3) {
    return { type: 'vertical_pass', option: verticalPass };
  }

  if (profile.vision > 0.55) {
    const longBall = pickBestForIntention(passOptions, 'progress', ctx, reading,
      p => p.isLong && p.isForward && p.successProb > 0.35);
    if (longBall && Math.random() < 0.15 + profile.riskAppetite * 0.2) {
      return { type: 'long_ball', option: longBall };
    }
  }

  if (reading.space.canConductForward && profile.dribbleTendency > 0.3 && reading.pressure.intensity !== 'high') {
    const carryProb = threatRising ? 0.35 : 0.25;
    if (Math.random() < carryProb + profile.dribbleTendency * 0.2) {
      return { type: 'progressive_dribble', targetX: clampX(ctx.self.x + ctx.attackDir * 10), targetZ: clampZ(ctx.self.z + (Math.random() - 0.5) * 8) };
    }
  }

  const congested = reading.pressure.opponentsInZone >= 3;
  if (congested) {
    const sw = pickBestForIntention(passOptions, 'reorganize', ctx, reading,
      p => Math.abs(p.targetZ - ctx.self.z) > 25 && p.successProb > 0.45);
    if (sw) return { type: 'switch_play', option: sw };
  }

  return selectBestPass(passOptions, reading, profile, ctx, 'progress');
}

// ---------------------------------------------------------------------------
// INTENTION: break_line
// ---------------------------------------------------------------------------

function decideBreakLine(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: PassOption[],
  profile: PlayerProfile,
): OnBallAction {
  const throughBall = pickBestForIntention(passOptions, 'break_line', ctx, reading,
    p => p.isForward && p.distance < 25 && p.successProb > 0.35);
  if (throughBall && Math.random() < 0.45 + profile.vision * 0.25) {
    return { type: 'through_ball', option: throughBall };
  }

  if (reading.space.canConductForward && reading.pressure.opponentsInZone < 2 && profile.dribbleTendency > 0.35) {
    return { type: 'progressive_dribble', targetX: clampX(ctx.self.x + ctx.attackDir * 12), targetZ: clampZ(ctx.self.z + (Math.random() - 0.5) * 6) };
  }

  const otp = pickBestForIntention(passOptions, 'break_line', ctx, reading,
    p => p.distance < 12 && p.successProb > 0.55);
  if (otp && profile.firstTouchPlay > 0.4 && Math.random() < 0.3) {
    return { type: 'one_two', option: otp };
  }

  return decideProgress(ctx, reading, passOptions, profile);
}

// ---------------------------------------------------------------------------
// INTENTION: accelerate / attack_space
// ---------------------------------------------------------------------------

function decideAccelerate(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: PassOption[],
  profile: PlayerProfile,
  xG: number,
): OnBallAction {
  const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
  const isWide = Math.abs(ctx.self.z - FIELD_WIDTH / 2) > 18;
  const threatRising = reading.threatTrend === 'rising';

  // Threat rising: the play is maturing — try to finish before defense recovers
  if (threatRising && canShoot(reading, xG, 0.02, profile)) {
    return retShoot(reading, ctx, reading.distToGoal > 22);
  }

  if (isWide && reading.distToGoal < 25) {
    if (reading.distToGoal < 18) return { type: 'run_to_byline', targetX: clampX(goalX), targetZ: ctx.self.z };
    const cz = FIELD_WIDTH / 2 + (Math.random() - 0.5) * 14;
    return Math.random() < 0.5
      ? { type: 'low_cross', targetX: goalX - ctx.attackDir * 10, targetZ: cz }
      : { type: 'high_cross', targetX: goalX - ctx.attackDir * 10, targetZ: cz };
  }

  if (reading.space.canConductForward && reading.pressure.opponentsInZone < 2) {
    return { type: 'aggressive_carry', targetX: clampX(ctx.self.x + ctx.attackDir * 12), targetZ: clampZ(ctx.self.z + (Math.random() - 0.5) * 6) };
  }

  if (reading.threatTrend === 'falling') {
    const throughBall = pickBestForIntention(passOptions, 'accelerate', ctx, reading,
      p => p.isForward && p.distance < 20 && p.successProb > 0.3);
    if (throughBall) return { type: 'through_ball', option: throughBall };
  }

  const throughBall = pickBestForIntention(passOptions, 'accelerate', ctx, reading,
    p => p.isForward && p.distance < 20 && p.successProb > 0.35);
  if (throughBall && profile.vision > 0.5) return { type: 'through_ball', option: throughBall };

  return decideProgress(ctx, reading, passOptions, profile);
}

// ---------------------------------------------------------------------------
// INTENTION: create_chance
// ---------------------------------------------------------------------------

function decideCreateChance(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: PassOption[],
  profile: PlayerProfile,
  xG: number,
): OnBallAction {
  const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
  const isWide = Math.abs(ctx.self.z - FIELD_WIDTH / 2) > 18;
  const threatFalling = reading.threatTrend === 'falling';

  // Threat falling while in chance-creation zone: defense is recovering, act NOW
  if (threatFalling && reading.distToGoal < 25 && canShoot(reading, xG, 0.03, profile)) {
    return retShoot(reading, ctx, reading.distToGoal > 20);
  }

  if (isWide) {
    if (reading.distToGoal < 20) return { type: 'run_to_byline', targetX: clampX(goalX), targetZ: ctx.self.z };
    const cz = FIELD_WIDTH / 2 + (Math.random() - 0.5) * 14;
    return Math.random() < 0.5
      ? { type: 'low_cross', targetX: goalX - ctx.attackDir * 10, targetZ: cz }
      : { type: 'high_cross', targetX: goalX - ctx.attackDir * 10, targetZ: cz };
  }

  const throughBall = pickBestForIntention(passOptions, 'create_chance', ctx, reading,
    p => p.isForward && p.distance < 20 && p.successProb > 0.35);
  if (throughBall && profile.vision > 0.5 && Math.random() < 0.4 + profile.verticality * 0.2) {
    return { type: 'through_ball', option: throughBall };
  }

  if (reading.space.canConductForward && reading.distToGoal < 22 && reading.pressure.opponentsInZone < 2) {
    return { type: 'enter_box', targetX: clampX(goalX), targetZ: FIELD_WIDTH / 2 + (Math.random() - 0.5) * 10 };
  }

  const otp = pickBestForIntention(passOptions, 'create_chance', ctx, reading,
    p => p.distance < 12 && p.successProb > 0.55);
  if (otp && profile.firstTouchPlay > 0.4 && Math.random() < 0.3) {
    return { type: 'one_two', option: otp };
  }

  if (reading.space.canConductForward && profile.dribbleTendency > 0.4) {
    return { type: 'progressive_dribble', targetX: clampX(ctx.self.x + ctx.attackDir * 8), targetZ: clampZ(ctx.self.z + (Math.random() - 0.5) * 6) };
  }

  if (reading.pressure.intensity === 'high' && isAttackZone(reading.fieldZone) && Math.random() < 0.1) {
    return { type: 'draw_foul' };
  }

  return selectBestPass(passOptions, reading, profile, ctx, 'create_chance');
}

// ---------------------------------------------------------------------------
// INTENTION-DRIVEN PASS SCORING
// ---------------------------------------------------------------------------

/**
 * Score a pass option based on the current play intention.
 * This is the core mechanism that prevents proximity-biased decisions:
 * each intention weights progression, safety, space and goal proximity
 * differently, so the "best" pass changes with context.
 */
function scorePassForIntention(
  option: PassOption,
  intention: PlayIntention,
  ctx: DecisionContext,
  reading: ContextReading,
): number {
  const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
  const targetDistToGoal = Math.hypot(goalX - option.targetX, FIELD_WIDTH / 2 - option.targetZ);
  const goalProximity = 1 - Math.min(targetDistToGoal / (FIELD_LENGTH * 0.7), 1);
  const space = Math.min(option.spaceAtTarget / 10, 1);
  const prog = option.progressionGain;
  const lines = Math.min(option.linesBroken * 0.15, 0.45);

  // xG-delta: does the pass put the ball in a position with higher expected
  // goal chance? This makes the team "seek the goal" continuously.
  const side = ctx.self.side as 'home' | 'away';
  const half = (ctx.clockHalf ?? 1) as 1 | 2;
  const selfXG = estimatePositionalXG(ctx.self.x, ctx.self.z, side, half, ctx.self.finalizacao);
  const targetXG = estimatePositionalXG(option.targetX, option.targetZ, side, half, ctx.self.finalizacao);
  const xgDelta = targetXG - selfXG;
  const xgBonus = xgDelta > PASS_XG_DELTA_MIN_THRESHOLD
    ? Math.min(xgDelta * 3, 0.2) * PASS_XG_DELTA_WEIGHT
    : 0;

  switch (intention) {
    case 'progress':
      return prog * 0.30 + option.successProb * 0.22 + space * 0.18
        + (option.isForward ? 0.13 : 0) + lines * 0.05 + xgBonus + goalProximity * 0.06;

    case 'maintain_possession':
      return option.successProb * 0.42 + space * 0.23
        + (!option.isLong ? 0.14 : 0) + (option.distance < 15 ? 0.08 : 0)
        + (!option.isForward ? 0.04 : 0) + xgBonus * 0.5;

    case 'accelerate':
    case 'attack_space':
    case 'break_line':
      return prog * 0.22 + lines * 0.22 + goalProximity * 0.18
        + (option.isForward ? 0.13 : 0) + option.successProb * 0.13 + xgBonus;

    case 'create_chance':
    case 'finish':
      return goalProximity * 0.30 + space * 0.18 + option.successProb * 0.18
        + prog * 0.12 + lines * 0.08 + xgBonus * 1.5;

    case 'reorganize':
      return option.successProb * 0.33
        + (Math.abs(option.targetZ - ctx.self.z) > 20 ? 0.18 : 0)
        + space * 0.18 + (!option.isForward ? 0.14 : 0)
        + (option.distance > 15 && option.distance < 35 ? 0.09 : 0) + xgBonus * 0.3;

    case 'relieve_pressure':
      return option.successProb * 0.48 + space * 0.24
        + (!option.isLong ? 0.14 : 0) + (option.distance < 20 ? 0.09 : 0) + xgBonus * 0.2;

    case 'protect_result':
      return option.successProb * 0.43 + (!option.isForward ? 0.18 : 0)
        + space * 0.18 + (!option.isLong ? 0.09 : 0)
        + (option.distance < 20 ? 0.05 : 0) + xgBonus * 0.15;

    default:
      return option.successProb * 0.28 + prog * 0.22 + space * 0.18
        + (option.isForward ? 0.13 : 0) + goalProximity * 0.10 + xgBonus;
  }
}

/**
 * Pick the best pass from a (possibly filtered) set using intention scoring.
 * Returns null if no options survive the filter.
 */
function pickBestForIntention(
  passOptions: PassOption[],
  intention: PlayIntention,
  ctx: DecisionContext,
  reading: ContextReading,
  filter?: (p: PassOption) => boolean,
): PassOption | null {
  const pool = filter ? passOptions.filter(filter) : passOptions;
  if (pool.length === 0) return null;
  const scored = pool
    .map(p => ({ option: p, score: scorePassForIntention(p, intention, ctx, reading) }))
    .sort((a, b) => b.score - a.score);
  const topN = Math.min(3, scored.length);
  return scored[Math.floor(Math.random() * topN)]!.option;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Universal fallback: score ALL available passes by the active intention
 * and pick from the top options. Determines pass type from the chosen
 * option's characteristics — never defaults to "nearest teammate".
 */
function selectBestPass(
  passOptions: PassOption[],
  reading: ContextReading,
  profile: PlayerProfile,
  ctx: DecisionContext,
  intention: PlayIntention = 'maintain_possession',
): OnBallAction {
  if (passOptions.length === 0) return { type: 'hold_ball' };

  const pick = pickBestForIntention(passOptions, intention, ctx, reading)!;

  if (pick.isLong && pick.isForward) return { type: 'long_ball', option: pick };
  if (Math.abs(pick.targetZ - ctx.self.z) > 25) return { type: 'switch_play', option: pick };
  if (pick.isForward && pick.linesBroken > 0) return { type: 'through_ball', option: pick };
  if (pick.isForward) return { type: 'vertical_pass', option: pick };
  return { type: 'lateral_pass', option: pick };
}

function isAttackZone(zone: FieldZone): boolean {
  return zone === 'att_third' || zone === 'opp_box';
}

function clampX(x: number): number {
  return Math.max(2, Math.min(FIELD_LENGTH - 2, x));
}

function clampZ(z: number): number {
  return Math.max(2, Math.min(FIELD_WIDTH - 2, z));
}
