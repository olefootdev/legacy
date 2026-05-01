import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import {
  findPassOptions,
  evaluateShot,
  nearestOpponentPressure01,
  passTargetThreatDepth01,
} from '@/simulation/InteractionResolver';
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
import { buildContextReading, isReceivingBackToGoalShaped } from './ContextScanner';
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
import { pick01ForDecision } from './decisionRng';
import { sfGetGoalContext } from '@/smartfield/smartfieldBridge';
import { resolveCarrierMacroDecision } from './carrierMacroBrain';
import { prethinkingMacroTilt } from './prethinking';
import {
  computeContextualGameplayMacroTilt,
  tryConnectorPassBeforeShot,
} from './contextualGameplayBoost';
import {
  computeGoalEvolutionMacroTilt,
  offensiveThreatSnapshot01,
  passOptionAttackBuildUpWithGoalEvolution,
  shouldDeferInstinctShotForProgression,
  shouldDeferBoxAutoShot,
} from './goalEvolutionRead';
import {
  evaluateCarrierLocalDuel,
  duelMacroTiltForCarrier,
  type LocalDuelRead,
} from './localDuelRead';
import { playContinuityScore } from './teamCollectiveState';
import type { DecisionActionId } from './collectiveIndividualDecision';
import { evaluateGoalTree } from '@/agents/goap';
import type { GoalContext as GoapGoalContext } from '@/agents/goap';

// ---------------------------------------------------------------------------
// GOAP goal bias → macroTilt
// ---------------------------------------------------------------------------

function buildGoapMacroTilt(ctx: DecisionContext): Partial<Record<DecisionActionId, number>> {
  const teamHasBall = ctx.possession === ctx.self.side;
  const distToGoal = ctx.goalContext?.distToGoal ?? 50;
  const distToBall = Math.hypot(ctx.self.x - ctx.ballX, ctx.self.z - ctx.ballZ);
  const role = ctx.self.role ?? '';
  const isForward = role === 'fw' || role === 'st' || role === 'rw' || role === 'lw';
  const isDefender = role === 'cb' || role === 'rb' || role === 'lb';
  const isMidfielder = role === 'cm' || role === 'dm' || role === 'am' || role === 'rm' || role === 'lm';
  const goapCtx: GoapGoalContext = {
    isCarrier: ctx.isCarrier,
    teamHasBall,
    distToGoalM: distToGoal,
    distToBallM: distToBall,
    minute: ctx.minute,
    scoreDiff: ctx.scoreDiff,
    fatigue01: 1 - (ctx.stamina ?? 100) / 100,
    pressureLevel: ctx.threatLevel,
    inBox: distToGoal < 18,
    inFinalThird: distToGoal < 35,
    inDefensiveThird: distToGoal > 70,
    isForward,
    isDefender,
    isMidfielder,
  };
  const evaluation = evaluateGoalTree(goapCtx);
  const tilt: Partial<Record<string, number>> = {};
  for (const action of evaluation.biasActions) {
    tilt[action] = (tilt[action] ?? 0) + evaluation.biasStrength;
  }
  return tilt as Partial<Record<DecisionActionId, number>>;
}

// ---------------------------------------------------------------------------
// Decision timing
// ---------------------------------------------------------------------------

export function computeDecisionSpeed(
  reading: ContextReading,
  profile: PlayerProfile,
  executionBoost01?: number,
): DecisionSpeed {
  let speed: DecisionSpeed;

  // URGENCY: near the goal or high threat = instant decisions
  if (reading.distToGoal < 20) speed = 'instant';
  else if (reading.threatLevel > 0.6) speed = 'instant';
  else if (reading.pressure.intensity === 'extreme') speed = 'instant';
  // APPROACH SENSE: opponent running at us — no time to think
  else if (reading.pressure.closingSpeed > 8 && reading.pressure.nearestOpponentDist < 8) speed = 'instant';
  else if (reading.pressure.closingSpeed > 6.2 && reading.pressure.nearestOpponentDist < 9.5) speed = 'instant';
  else if (reading.pressure.closingSpeed > 5 && reading.pressure.nearestOpponentDist < 12) speed = 'fast';
  else if (reading.distToGoal < 30 && reading.threatLevel > 0.4) speed = 'fast';
  else if (reading.pressure.intensity === 'high') speed = 'fast';
  // Medium closing speed still raises urgency above normal
  else if (reading.pressure.closingSpeed > 3 && reading.pressure.nearestOpponentDist < 10) speed = 'normal';
  // COMFORT ZONE: own half, no pressure, space — player can think
  else if (
    (reading.fieldZone === 'own_box' || reading.fieldZone === 'def_third')
    && reading.pressure.intensity === 'none'
  ) {
    speed = 'slow';
  } else if (
    reading.pressure.intensity === 'none'
    && reading.space.canConductForward
    && reading.fieldZone !== 'att_third'
    && reading.fieldZone !== 'opp_box'
  ) {
    speed = 'slow';
  } else if (
    reading.pressure.intensity === 'none'
    && reading.threatLevel < 0.35
    && reading.pressure.closingSpeed < 2.8
    && reading.fieldZone !== 'att_third'
    && reading.fieldZone !== 'opp_box'
    && reading.progressToGoal < 0.62
  ) {
    speed = 'slow';
  } else {
    speed = 'normal';
  }

  const b = executionBoost01 ?? 0;
  if (speed !== 'instant') {
    if (b > 0.2 && speed === 'slow') speed = 'normal';
    else if (b > 0.38 && speed === 'normal') speed = 'fast';
  }
  return speed;
}

/** Quão “à procura do golo” está o contexto (MVP: decisões mais agressivas no último terço). */
function attackUrgency01(reading: ContextReading): number {
  const dg = reading.distToGoal;
  const fromDist = Math.max(0, Math.min(1, (50 - dg) / 46));
  if (reading.fieldZone === 'opp_box') return Math.max(fromDist, 0.9);
  if (reading.fieldZone === 'att_third') return Math.max(fromDist, 0.58);
  return fromDist;
}

/**
 * Continuity tilt: when the play is building well, favor passing/carrying
 * over risky shots or clearances. When play is stalled, favor recycling.
 */
function computePlayContinuityTilt(ctx: DecisionContext): Partial<Record<DecisionActionId, number>> {
  if (!ctx.collective) return {};
  const c = ctx.collective;
  const cont = playContinuityScore(
    ctx.threatLevel, ctx.threatTrend, c.passChainLength, c.supportCount, c.phase,
  );

  if (cont > 0.55) {
    // Play is building — favor progressive passing and carrying, penalize clearance
    return {
      pass_progressive: cont * 0.12,
      carry: cont * 0.06,
      clearance: -cont * 0.15,
      pass_safe: -cont * 0.04,
    };
  }
  if (cont < 0.2) {
    // Play is stalled — favor recycling, long switches, risk taking
    return {
      pass_safe: 0.06,
      pass_long: 0.08,
      carry: -0.04,
    };
  }
  return {};
}

/**
 * Com linha de remate tapada mas espaço a jogar — conduzir / driblar para ganhar ângulo ou profundidade.
 */
function trySeekBetterGoalAngleDribble(
  ctx: DecisionContext,
  reading: ContextReading,
  profile: PlayerProfile,
  carrierDuel: LocalDuelRead,
): OnBallAction | null {
  if (
    carrierDuel.outcome === 'disadvantage'
    && (carrierDuel.kind === 'dribble' || carrierDuel.kind === 'speed' || carrierDuel.kind === 'body')
  ) {
    return null;
  }
  if (reading.pressure.intensity === 'extreme') return null;
  if (reading.distToGoal < 6 || reading.distToGoal > 36) return null;
  // Fix #4: gate antigo bloqueava drible quando o gol estava LIVRE (lineOfSight alto),
  // o que era contraditório — atacante com visão de gol clara deveria arriscar drible
  // para ganhar ângulo/proximidade, não congelar. Só aborta se a linha está muito tapada
  // (lineOfSightScore < 0.18) — nesse caso, melhor passar do que driblar para o nada.
  if (reading.lineOfSightScore < 0.18) return null;
  const minForwardSpace = reading.inOppPenaltyArea ? 2.8 : 4.2;
  if (reading.space.forwardSpaceDepth < minForwardSpace) return null;

  const inFinishingZone = reading.fieldZone === 'att_third' || reading.fieldZone === 'opp_box' || reading.inOppPenaltyArea;
  const drive =
    profile.dribbleTendency * 0.52
    + profile.composure * 0.22
    + (inFinishingZone ? 0.24 : 0);
  if (pick01ForDecision(ctx) > drive) return null;

  const sideSign = ctx.self.z < FIELD_WIDTH / 2 ? 1 : -1;
  const lateral = (reading.lineOfSightScore < 0.38 ? 8.2 : 5.4) + pick01ForDecision(ctx) * 4;

  if (reading.pressure.intensity === 'high' || reading.pressure.nearestOpponentDist < 4.2) {
    return {
      type: 'beat_marker',
      targetX: clampX(ctx.self.x + ctx.attackDir * 4.8),
      targetZ: clampZ(ctx.self.z + sideSign * lateral),
    };
  }
  return {
    type: 'progressive_dribble',
    targetX: clampX(ctx.self.x + ctx.attackDir * (reading.distToGoal < 19 ? 8 : 11)),
    targetZ: clampZ(ctx.self.z + sideSign * lateral * 0.92),
  };
}

/** Entre candidatos válidos, escolhe o que melhor equilibra segurança, profundidade e ameaça futura ao golo. */
function pickBestPassByAttackBuildUp(pool: PassOption[], ctx: DecisionContext): PassOption | null {
  if (pool.length === 0) return null;
  return pool.reduce((best, p) =>
    passOptionAttackBuildUpWithGoalEvolution(p, ctx.teammates, ctx.opponents, ctx.attackDir)
    > passOptionAttackBuildUpWithGoalEvolution(best, ctx.teammates, ctx.opponents, ctx.attackDir)
      ? p
      : best,
  );
}

function retShoot(reading: ContextReading, ctx: DecisionContext, longRange: boolean): OnBallAction {
  ctx.noteShootChosen?.();
  return longRange ? { type: 'shoot_long_range' } : { type: 'shoot' };
}

export function decisionDelaySec(speed: DecisionSpeed, pick01: () => number = Math.random): number {
  // Urgency vs comfort zone:
  //  - 'instant': danger zone / shooting opportunity — act NOW
  //  - 'fast': under pressure or in attack — quick decisions
  //  - 'normal': midfield, balanced — standard reading time
  //  - 'slow': comfort zone (own half, no pressure) — think, circulate, survey
  switch (speed) {
    case 'instant': return 0.02;
    case 'fast': return 0.06 + pick01() * 0.03;
    case 'normal': return 0.10 + pick01() * 0.05;
    case 'slow': return 0.22 + pick01() * 0.10;
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
  /** Duelo local vs o adversário mais relevante — inclina chooseAction / instinto sem substituir o pipeline. */
  const carrierDuel = evaluateCarrierLocalDuel(ctx, reading);
  let passOptions = findPassOptions(ctx.self, ctx.teammates, ctx.opponents, ctx.attackDir);
  // Respect nudges from FanFrustrationSystem (propagated as transient ctx fields)
  try {
    if ((ctx as any)._nudgeAvoidKeeperPass) {
      passOptions = passOptions.filter((o) => !o.targetId || !(o.targetId.toLowerCase().includes('gol') || o.targetId.toLowerCase().includes('keeper')));
    }
  } catch (e) {
    // noop
  }
  if (ctx.passBlocklist?.length) {
    const bl = new Set(ctx.passBlocklist);
    passOptions = passOptions.filter((o) => !bl.has(o.targetId));
  }
  const shot = evaluateShot(ctx.self, ctx.attackDir, ctx.opponents);

  // Q3 — Cobrador de falta direta: avalia chute direto / cruzamento conforme
  // distância ao gol e atributos. Cap de probabilidade de chute (não vira shoot
  // sempre — em ângulos ruins ou longe demais, prefere cruzar/passar).
  if (ctx.setPieceContext?.kind === 'free_kick') {
    const sp = ctx.setPieceContext;
    if (sp.distanceToGoal <= 32) {
      const fin = ctx.self.finalizacao / 100;
      const passLong = ctx.self.passeLongo / 100;
      // Distância ótima 18-24m, cai depois.
      const distFactor = sp.distanceToGoal < 18
        ? 0.85
        : sp.distanceToGoal < 24
          ? 1.0
          : Math.max(0.30, 1 - (sp.distanceToGoal - 24) / 12);
      // Ângulo: penaliza chute muito lateral.
      const goalZCenter = FIELD_WIDTH / 2;
      const lateralOff = Math.abs(ctx.self.z - goalZCenter);
      const angleFactor = lateralOff < 14 ? 1.0 : Math.max(0.25, 1 - (lateralOff - 14) / 22);
      const directShotP = 0.18 + fin * 0.50 + passLong * 0.10;
      const finalP = directShotP * distFactor * angleFactor;
      if (pick01ForDecision(ctx) < finalP) {
        return sp.distanceToGoal > 22 ? { type: 'shoot_long_range' } : { type: 'shoot' };
      }
      // Falta lateral em final third → cruzamento ao invés de passe seguro.
      if (sp.distanceToGoal < 28 && lateralOff > 16) {
        const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
        const cz = FIELD_WIDTH / 2 + (pick01ForDecision(ctx) - 0.5) * 16;
        return pick01ForDecision(ctx) < 0.55
          ? { type: 'high_cross', targetX: goalX - ctx.attackDir * 8, targetZ: cz }
          : { type: 'low_cross', targetX: goalX - ctx.attackDir * 10, targetZ: cz };
      }
    }
    // Falas longas/seguras: cai pro fluxo normal (passe), mas com flag.
  }

  // Bloco C — Pattern de 1 toque: recém-recebeu bola sob pressão alta
  // Quando o jogador acaba de virar carrier (passe acabou de chegar) e há
  // pressão de adversário próximo, libera bola rápido pra colega seguro.
  // Skill firstTouchPlay aumenta a probabilidade.
  if (ctx.carrierJustChanged && passOptions.length > 0) {
    const press = nearestOpponentPressure01(ctx.self, ctx.opponents);
    if (press > 0.55) {
      const safe = passOptions.find(
        (p) => p.distance < 18 && p.successProb > 0.58,
      );
      if (safe) {
        const ftSkill = profile.firstTouchPlay ?? 0.4;
        const oneTouchP = 0.25 + ftSkill * 0.45 + (press - 0.55) * 0.4;
        if (pick01ForDecision(ctx) < oneTouchP) {
          return { type: 'one_two', option: safe };
        }
      }
    }
  }

  const backToGoalPlay = tryBackToGoalAttackPlay(ctx, reading, passOptions, shot, profile, carrierDuel);
  if (backToGoalPlay) return backToGoalPlay;

  /**
   * Instinto de golo ANTES do `chooseAction`: quando há passes, o scorer coletivo
   * quase sempre devolve `pass_safe` / progressivo e saíamos deste ramo sem nunca
   * chegar a `tryGoalInstinct` (comportamento de “só toques”). Padrão de engines:
   * oportunidade de remate compete em prioridade com “melhor passe”, não só com scores estáticos.
   */
  if (
    passOptions.length > 0
    && (reading.fieldZone === 'opp_box' || reading.fieldZone === 'att_third')
  ) {
    const instinctFirst = tryGoalInstinct(ctx, reading, passOptions, shot.xG, profile, carrierDuel);
    if (instinctFirst) return instinctFirst;
  }

  const pressEarly = nearestOpponentPressure01(ctx.self, ctx.opponents);
  const panicClear = tryPanicForwardClearance(ctx, reading, passOptions, pressEarly, carrierDuel);
  if (panicClear) return panicClear;

  // Collective/Individual architecture layer: score canonical actions
  // by role fit + attributes + archetype + context risk.
  if (passOptions.length > 0) {
    // Encourage lead passes into the box: if a pass option targets a teammate
    // near the penalty area and that teammate is likely to run, boost progressive
    // pass weight so midfielders consider "pass where he'll be" rather than
    // the static receiver location.
    try {
      for (const p of passOptions) {
        if (p.distToOppGoal < 24 && p.spaceAtTarget > 3.2 && p.successProb > 0.28) {
          // increase weight for progression / through style
          p.progressionGain = Math.min(1, (p.progressionGain ?? 0) + 0.08);
          // mark a transient hint used by chooseAction via macroTilt: nudge connector logic
          (ctx as any)._leadPassPreferred = true;
        }
      }
    } catch (e) {
      // noop
    }
    const attrs = extractAttributes(ctx.self, ctx.profile);
    const role = mapRole(ctx.self);
    const arch = mapArchetype(ctx.profile, ctx.self);
    const tctx = buildTeamTacticalContext(ctx);
    const pressure01 = nearestOpponentPressure01(ctx.self, ctx.opponents);
    const pstate = buildPlayerState(ctx, pressure01);

    // Voice: "passa pro X" — se o receptor pedido for uma opção viável, força ele como safePass.
    const preferredId = ctx.voiceBias?.preferredReceiverId;
    const preferredOption = preferredId ? passOptions.find((p) => p.targetId === preferredId && p.successProb > 0.2) : undefined;
    const safeBackward = passOptions.filter((p) => p.successProb > 0.62 && !p.isForward);
    const safePass =
      preferredOption ??
      (safeBackward.length > 0
        ? safeBackward.reduce((a, b) => (a.successProb >= b.successProb ? a : b))
        : passOptions.filter((p) => p.successProb > 0.55).sort((a, b) => b.successProb - a.successProb)[0]
          ?? passOptions[0]!);
    const progressive =
      pickBestPassByAttackBuildUp(passOptions.filter((p) => p.isForward && p.successProb > 0.3), ctx)
      ?? passOptions[0]!;
    const longPass =
      pickBestPassByAttackBuildUp(
        passOptions.filter((p) => p.isLong && p.isForward && p.successProb > 0.25),
        ctx,
      )
      ?? progressive;
    const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
    const crossZ = clampZ(FIELD_WIDTH / 2 + (ctx.self.z < FIELD_WIDTH / 2 ? 10 : -10));
    const crossX = clampX(goalX - ctx.attackDir * 14);
    const wingSlot =
      ctx.self.slotId?.includes('pe')
      || ctx.self.slotId?.includes('pd')
      || ctx.self.slotId === 'le'
      || ctx.self.slotId === 'ld';
  // If there's a nudge to advance, slightly bias to crossing / attack width
  const nudgeAdvance = Boolean((ctx as any)._nudgeAdvance);
    const dribbleSide = ctx.self.z < FIELD_WIDTH / 2 ? 1 : -1;
    const dribbleZBias =
      Math.abs(ctx.self.z - FIELD_WIDTH / 2) < 9 ? dribbleSide * 5.2 : dribbleSide * 2.8;
    const options: ActionOption[] = [
      { id: 'pass_safe', pass: safePass },
      { id: 'pass_progressive', pass: progressive },
      { id: 'pass_long', pass: longPass },
      {
        id: 'carry',
        targetX: clampX(ctx.self.x + ctx.attackDir * (reading.distToGoal < 26 ? 9 : 6)),
        targetZ: clampZ(ctx.self.z),
      },
      {
        id: 'dribble_risk',
        targetX: clampX(ctx.self.x + ctx.attackDir * 8),
        targetZ: clampZ(ctx.self.z + dribbleZBias),
      },
      { id: 'shoot' },
      { id: 'clearance', targetX: clampX(ctx.attackDir === 1 ? FIELD_LENGTH - 8 : 8), targetZ: FIELD_WIDTH / 2 },
    ];
    if (wingSlot || Math.abs(ctx.self.z - FIELD_WIDTH / 2) > 14) {
  const crossOption = { id: 'cross' as any, targetX: crossX, targetZ: crossZ } as ActionOption;
      if (nudgeAdvance) {
        // place cross earlier in options so it's more likely to be chosen
        options.splice(2, 0, crossOption);
      } else {
        options.splice(3, 0, crossOption);
      }
    }
    const half = ctx.clockHalf ?? 1;
    const zoneTags = getZoneTags({ x: ctx.self.x, z: ctx.self.z }, { team: ctx.self.side, half });
    const shootFloorEligible = isShootMinEligible(ctx.self, reading, ctx);
    const macro = resolveCarrierMacroDecision(ctx, reading, passOptions);
    const passSlice = { progressive, safePass, longPass };
    // Ameaça ao golo (smartfield + LOS + GR + pressão): inclina passes/condução vs remate precipitado.
    const goalEvolutionTilt = computeGoalEvolutionMacroTilt(ctx, reading, shot, passOptions);
    const macroTilt = {
      ...macro.macroTilt,
      ...prethinkingMacroTilt(ctx),
      ...computeContextualGameplayMacroTilt(ctx, reading, passSlice),
      ...goalEvolutionTilt,
      ...duelMacroTiltForCarrier(carrierDuel, reading),
  // Sprint L2 — Personalidade: ego inclina o jogador a chutar/driblar mais
  //   ego 90 (Cristiano-tier): +shoot, +dribble_risk, -pass_safe
  //   ego 30 (cooperativo):    +pass_safe, -shoot
  ...(ctx.self.ego != null ? (() => {
    const egoBias = (ctx.self.ego - 50) / 100; // -0.5 .. +0.5
    return {
      shoot: egoBias * 0.18,
      dribble_risk: egoBias * 0.12,
      pass_safe: -egoBias * 0.14,
    };
  })() : {}),
  // Sprint L5 — Moral coletiva afeta o tipo de risco assumido
  //   moral abalada (<25): chutes desesperados, +shoot
  //   moral alta (>75):    pode segurar mais, hold ball
  //   moral neutra:        sem efeito
  ...(ctx.self.teamMorale != null ? (() => {
    const m = ctx.self.teamMorale;
    if (m < 25) return { shoot: 0.18, pass_safe: -0.08 };
    if (m < 40) return { shoot: 0.08, pass_safe: -0.04 };
    if (m >= 75) return { shoot: 0.06, pass_safe: 0.06 }; // confiante: ousa mas segura quando vale
    return {};
  })() : {}),
  // Prefer finish if requested by the nudge
  ...( (ctx as any)._nudgePreferFinish ? { shoot: 0.35 } : {} ),
  // Voice command bias — treinador mandou algo específico pro portador
  ...(ctx.voiceBias ? {
    ...(ctx.voiceBias.shootBoost ? { shoot: ctx.voiceBias.shootBoost } : {}),
    ...(ctx.voiceBias.dribbleBoost ? { dribble_risk: ctx.voiceBias.dribbleBoost, dribble_safe: ctx.voiceBias.dribbleBoost * 0.6 } : {}),
    ...(ctx.voiceBias.crossBoost ? { cross: ctx.voiceBias.crossBoost } : {}),
    ...(ctx.voiceBias.quickPassBoost ? { pass_safe: ctx.voiceBias.quickPassBoost * 0.7, pass_progressive: ctx.voiceBias.quickPassBoost * 0.4 } : {}),
    ...(ctx.voiceBias.holdBallBoost ? { pass_safe: ctx.voiceBias.holdBallBoost * 0.6, shoot: -ctx.voiceBias.holdBallBoost * 0.4, pass_long: -ctx.voiceBias.holdBallBoost * 0.3 } : {}),
    ...(ctx.voiceBias.freedomBoost ? { dribble_risk: ctx.voiceBias.freedomBoost * 0.7, shoot: ctx.voiceBias.freedomBoost * 0.3 } : {}),
  } : {}),
  // If lead pass preference detected, bias progressive/through a bit
  ...((ctx as any)._leadPassPreferred ? { pass_progressive: 0.26, pass_long: 0.08 } : {}),
      ...computePlayContinuityTilt(ctx),
      ...(ctx.teamIntentBias ?? {}),
      ...buildGoapMacroTilt(ctx),
    };
    const pick = chooseAction(role, attrs, arch, tctx, pstate, options, !!ctx.decisionDebug, {
      tags: zoneTags,
      shootFloorEligible,
      shootBudgetForce: !!ctx.shootBudgetForce && shootFloorEligible,
      attackUrgency01: attackUrgency01(reading),
      lineOfSight01: reading.lineOfSightScore,
      macroTilt,
    });

    ctx.noteCarrierDecisionDebug?.({
      zoneTags: zoneTags.join('+'),
      top3: pick.top3.map((t) => `${t.id}:${t.score.toFixed(2)}`).join(' | '),
      pickedId: pick.action.id,
    });

    if (pick.action.id === 'shoot' && isShootMinEligible(ctx.self, reading, ctx)) {
      const allow =
        canShoot(
          reading,
          shot.xG,
          ctx.shootBudgetForce || ctx.offensiveStallShotBoost ? 0.12 : 0,
          ctx.profile,
          { ctx, passOptions },
        )
        || ctx.shootBudgetForce
        || ctx.offensiveStallShotBoost
        || shot.xG >= 0.019;
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
  const instinct = tryGoalInstinct(ctx, reading, passOptions, shot.xG, profile, carrierDuel);
  if (instinct) return instinct;

  const angleSeek = trySeekBetterGoalAngleDribble(ctx, reading, profile, carrierDuel);
  if (angleSeek) return angleSeek;

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
      if (canShoot(reading, shot.xG, urgency, profile, { ctx, passOptions })) {
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

  if (isReceivingBackToGoalShaped(ctx, reading) && reading.pressure.intensity !== 'extreme') {
    const step = reading.pressure.intensity === 'high' ? 2.6 : 4.2;
    return {
      type: 'simple_carry',
      targetX: clampX(ctx.self.x + dir * step),
      targetZ: clampZ(ctx.self.z + (pick01ForDecision(ctx) - 0.5) * 2.8),
    };
  }

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
      targetZ: clampZ(ctx.self.z + (pick01ForDecision(ctx) - 0.5) * 2),
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
// Panic clearance — chutão para a frente quando a posse perto do golo é perigosa
// ---------------------------------------------------------------------------

function forwardChannelClearance(ctx: DecisionContext): OnBallAction {
  const ad = ctx.attackDir;
  const longX = clampX(ctx.self.x + ad * (36 + pick01ForDecision(ctx) * 10));
  // Q2 — Chutão deixa de ser pra "lateral genérica". Mira o setor com mais
  // colegas à frente (densidade de aliados nos próximos ~30m), não cego.
  const candidates = [10, 22, 34, FIELD_WIDTH - 34, FIELD_WIDTH - 22, FIELD_WIDTH - 10];
  let bestZ = ctx.self.z < FIELD_WIDTH / 2 ? 12 : FIELD_WIDTH - 12;
  let bestScore = -Infinity;
  for (const cz of candidates) {
    let score = 0;
    for (const t of ctx.teammates) {
      if (t.id === ctx.self.id) continue;
      const dxT = (t.x - longX) * ad;       // colega à frente do alvo X
      if (dxT > -8 && dxT < 18) {
        const dzT = Math.abs(t.z - cz);
        if (dzT < 14) score += 1 - dzT / 14;
      }
    }
    if (score > bestScore) { bestScore = score; bestZ = cz; }
  }
  const tz = clampZ(bestZ + (pick01ForDecision(ctx) - 0.5) * 4);
  return { type: 'clearance', targetX: longX, targetZ: tz };
}

/** Muitos adversários + pouca linha de passe limpa no último terço → alívio longo. */
function tryPanicForwardClearance(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: PassOption[],
  press01: number,
  carrierDuel: LocalDuelRead,
): OnBallAction | null {
  if (carrierDuel.kind === 'pass' && carrierDuel.outcome === 'advantage' && press01 < 0.62) {
    return null;
  }
  const inDanger =
    reading.fieldZone === 'opp_box'
    || (reading.fieldZone === 'att_third' && reading.distToGoal < 32);
  if (!inDanger) return null;

  const crowded = reading.pressure.opponentsInZone >= 4 || press01 >= 0.56;
  if (!crowded) return null;

  const ahead = (p: PassOption) =>
    ctx.attackDir === 1 ? p.targetX > ctx.self.x + 1.5 : p.targetX < ctx.self.x - 1.5;
  const bestFwd = passOptions
    .filter((p) => p.isForward && ahead(p))
    .reduce((m, p) => Math.max(m, p.successProb), 0);

  if (bestFwd >= 0.52) return null;

  if (press01 >= 0.68 && reading.pressure.opponentsInZone >= 3 && bestFwd < 0.48) {
    return forwardChannelClearance(ctx);
  }
  if (reading.pressure.opponentsInZone >= 5 && bestFwd < 0.45) {
    return forwardChannelClearance(ctx);
  }
  if (reading.fieldZone === 'opp_box' && press01 >= 0.52 && bestFwd < 0.42) {
    return forwardChannelClearance(ctx);
  }
  return null;
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
function tryBackToGoalAttackPlay(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: PassOption[],
  shot: { xG: number },
  profile: PlayerProfile,
  carrierDuel: LocalDuelRead,
): OnBallAction | null {
  if (!isReceivingBackToGoalShaped(ctx, reading)) return null;

  const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
  const goalZ = FIELD_WIDTH / 2;
  const carrierDistGoal = reading.distToGoal;

  if (ctx.self.role === 'attack') {
    const finishUrgency = 0.028;
    if (canShoot(reading, shot.xG, finishUrgency, profile, { ctx, passOptions })) {
      return retShoot(reading, ctx, reading.distToGoal > 21);
    }
    // Q4 — Não pode chutar agora mas tem xG decente em zona de finalização:
    // PIVOTA pro gol em vez de cair em passe pra trás. Próximo tick, com
    // heading correto, canShoot recebe inputs melhores.
    if (
      carrierDistGoal < 24
      && shot.xG >= 0.04
      && reading.pressure.opponentsInZone <= 3
      && reading.pressure.nearestOpponentDist > 1.2
    ) {
      const turnTowardX = clampX(ctx.self.x + ctx.attackDir * 4);
      const turnTowardZ = clampZ(ctx.self.z + (goalZ - ctx.self.z) * 0.5);
      return { type: 'turn_on_marker', targetX: turnTowardX, targetZ: turnTowardZ };
    }
    if (
      shot.xG > 0.014
      && reading.distToGoal < 23
      && reading.lineOfSightScore > 0.32
      && reading.pressure.nearestOpponentDist > 1.4
    ) {
      return retShoot(reading, ctx, reading.distToGoal > 19);
    }
    if (
      reading.pressure.opponentsInZone <= 2
      && profile.dribbleTendency > 0.32
      && pick01ForDecision(ctx) < 0.4 + profile.dribbleTendency * 0.3
      && !(
        carrierDuel.outcome === 'disadvantage'
        && (carrierDuel.kind === 'dribble' || carrierDuel.kind === 'body' || carrierDuel.kind === 'speed')
      )
    ) {
      const dribbleSide = ctx.self.z < FIELD_WIDTH / 2 ? 1 : -1;
      return {
        type: 'beat_marker',
        targetX: clampX(ctx.self.x + ctx.attackDir * 6.5),
        targetZ: clampZ(ctx.self.z + dribbleSide * 7),
      };
    }
    if (
      reading.pressure.nearestOpponentDist < 7.5
      && reading.space.canConductLateral
      && pick01ForDecision(ctx) < 0.4
    ) {
      const lat = reading.space.lateralSpaceRight > reading.space.lateralSpaceLeft ? 1 : -1;
      return {
        type: 'progressive_dribble',
        targetX: clampX(ctx.self.x + ctx.attackDir * 4.5),
        targetZ: clampZ(ctx.self.z + lat * 6.5),
      };
    }
  }

  const minProb = ctx.self.role === 'attack' ? 0.3 : 0.36;
  const cand = passOptions.filter((p) => p.successProb > minProb);
  if (cand.length === 0) return null;

  cand.sort((a, b) => {
    const sa = a.distToOppGoal - a.threatDepth01 * 4.2 - Math.min(a.spaceAtTarget, 12) / 12 * 2.2;
    const sb = b.distToOppGoal - b.threatDepth01 * 4.2 - Math.min(b.spaceAtTarget, 12) / 12 * 2.2;
    return sa - sb;
  });
  const best = cand[0]!;
  // Fix #1: gate antigo (`+ 8`) abortava enfiada/through-ball sempre que havia colega à frente
  // do portador. Agora só descarta se o melhor passe efetivamente RECUA em relação ao gol
  // (margem de 3m para tolerar passes de apoio laterais que não regridem).
  if (best.distToOppGoal >= carrierDistGoal - 3) return null;

  if (best.isLong && best.isForward) return { type: 'long_ball', option: best };
  if (best.linesBroken > 0 && best.isForward) return { type: 'through_ball', option: best };
  if (best.isForward) return { type: 'vertical_pass', option: best };
  return { type: 'short_pass_safety', option: best };
}

function tryGoalInstinct(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: PassOption[],
  xG: number,
  profile: PlayerProfile,
  carrierDuel: LocalDuelRead,
): OnBallAction | null {
  const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
  const distToGoal = reading.distToGoal;
  const backShaped = isReceivingBackToGoalShaped(ctx, reading);
  const strikerBack = ctx.self.role === 'attack' && backShaped;
  const xgEps = strikerBack ? 0.0045 : 0;
  const duelFinishDisadv = carrierDuel.kind === 'finish' && carrierDuel.outcome === 'disadvantage';
  const duelFinishAdv = carrierDuel.kind === 'finish' && carrierDuel.outcome === 'advantage';

  // -----------------------------------------------------------------------
  // COMFORT ZONE: in defensive zones with no pressure, don't trigger instinct.
  // Let the player think and build the play.
  // -----------------------------------------------------------------------
  if (reading.fieldZone === 'own_box' || reading.fieldZone === 'def_third' || reading.fieldZone === 'def_mid') {
    return null;
  }

  const connectorFirst = tryConnectorPassBeforeShot(ctx, reading, passOptions, xG);
  if (connectorFirst) return connectorFirst;

  /** Instinto de remate só se um passe claramente melhor não subir mais a probabilidade de golo. */
  const shootUnlessSmarterPass = (longRange: boolean): OnBallAction | null => {
    if (shouldDeferInstinctShotForProgression(ctx, reading, passOptions, xG)) return null;
    if (duelFinishDisadv) {
      const long = longRange || distToGoal > 20;
      if (long && xG < 0.062) return null;
      if (!long && xG < 0.019) return null;
    }
    if (
      duelFinishAdv
      && longRange
      && distToGoal > 19
      && ctx.self.fisico >= 70
      && reading.lineOfSightScore > 0.34
      && reading.space.forwardSpaceDepth > 5
    ) {
      if (xG > 0.05) return retShoot(reading, ctx, true);
    }
    return retShoot(reading, ctx, longRange);
  };

  // -----------------------------------------------------------------------
  // PEQUENA ÁREA: chute imediato — qualquer bola na six_yard é gol quase certo
  // -----------------------------------------------------------------------
  const sixYardCtx = sfGetGoalContext(ctx.self.x, ctx.self.z, ctx.attackDir);
  if (sixYardCtx.inSixYard) {
    const s = retShoot(reading, ctx, false);
    if (s) return s;
  }

  // -----------------------------------------------------------------------
  // Terço de ataque (fora da área): mais remates de média distância — “vida” no jogo
  // -----------------------------------------------------------------------
  const inPenaltyArea = reading.inOppPenaltyArea;
  const effectivelyInBox = reading.fieldZone === 'opp_box' || inPenaltyArea;

  if (reading.fieldZone === 'att_third' && !inPenaltyArea) {
    if (distToGoal < 22 && xG > 0.013 - xgEps && reading.pressure.opponentsInZone < 7) {
      const s = shootUnlessSmarterPass(distToGoal > 21);
      if (s) return s;
    }
    if (distToGoal < 26 && xG > 0.036 - xgEps && reading.pressure.nearestOpponentDist > 1.9) {
      const s = shootUnlessSmarterPass(true);
      if (s) return s;
    }
    if (strikerBack && distToGoal < 24 && xG > 0.011 && reading.lineOfSightScore > 0.3) {
      const s = shootUnlessSmarterPass(distToGoal > 20);
      if (s) return s;
    }
  }

  // -----------------------------------------------------------------------
  // 1. SHOOT INSTINCT: in a good position → just shoot
  // -----------------------------------------------------------------------

  // Grande área: `evaluateShot` penaliza aglomeração; sem fallback geométrico o xG
  // cai e o instinto nunca dispara — exatamente o “ping-pong” na área.
  if (effectivelyInBox) {
    if (distToGoal < 11 && xG > 0.009 - xgEps) {
      const s = shootUnlessSmarterPass(false);
      if (s) return s;
    }
    if (distToGoal < 20 && xG > 0.015 - xgEps && reading.pressure.opponentsInZone < 8) {
      const s = shootUnlessSmarterPass(false);
      if (s) return s;
    }
  }

  if (effectivelyInBox && xG > 0.021 - xgEps && reading.pressure.opponentsInZone < 7) {
    const s = shootUnlessSmarterPass(false);
    if (s) return s;
  }

  // Dentro da área ou muito perto: chance moderada basta
  if (distToGoal < 14 && xG > 0.026 && reading.pressure.opponentsInZone < 5) {
    const s = shootUnlessSmarterPass(false);
    if (s) return s;
  }

  // Limite da área: linha de visão mais limpa
  if (distToGoal < 21 && xG > 0.04 && reading.pressure.opponentsInZone < 4) {
    const s = shootUnlessSmarterPass(false);
    if (s) return s;
  }

  // Média distância, bom ângulo e espaço: arriscar o remate
  if (distToGoal < 25 && xG > 0.078 && reading.pressure.nearestOpponentDist > 2.6) {
    if (profile.riskAppetite > 0.22) {
      const s = shootUnlessSmarterPass(true);
      if (s) return s;
    }
  }

  // -----------------------------------------------------------------------
  // 2. KEY PASS INSTINCT: companheiro mais perto da baliza adversária — prioridade absoluta
  // -----------------------------------------------------------------------

  const goalZ = FIELD_WIDTH / 2;
  const carrierDistGoal = Math.hypot(goalX - ctx.self.x, goalZ - ctx.self.z);
  const aheadOk = (p: PassOption) =>
    ctx.attackDir === 1 ? p.targetX > ctx.self.x + 2 : p.targetX < ctx.self.x - 2;

  const keyed = passOptions.filter((p) => {
    if (!aheadOk(p)) return false;
    if (p.distToOppGoal >= 46) return false;
    if (p.successProb < 0.28) return false;
    return true;
  });
  keyed.sort((a, b) => {
    const tmA = ctx.teammates.find((t) => t.id === a.targetId);
    const tmB = ctx.teammates.find((t) => t.id === b.targetId);
    const ta = tmA ? offensiveThreatSnapshot01(tmA, a.targetX, a.targetZ, ctx.attackDir, ctx.opponents) : 0;
    const tb = tmB ? offensiveThreatSnapshot01(tmB, b.targetX, b.targetZ, ctx.attackDir, ctx.opponents) : 0;
    const scoreA = a.distToOppGoal - a.threatDepth01 * 5.5 - a.successProb * 6 - ta * 8.2;
    const scoreB = b.distToOppGoal - b.threatDepth01 * 5.5 - b.successProb * 6 - tb * 8.2;
    return scoreA - scoreB;
  });
  const bestScoringTeammate = keyed[0] ?? null;

  if (bestScoringTeammate) {
    const tmDistToGoal = bestScoringTeammate.distToOppGoal;

    if (tmDistToGoal < carrierDistGoal - 2.5) {
      if (tmDistToGoal < 14) {
        return { type: 'through_ball', option: bestScoringTeammate };
      }
      return { type: 'vertical_pass', option: bestScoringTeammate };
    }

    if (tmDistToGoal < 17 && carrierDistGoal > 20 && bestScoringTeammate.successProb > 0.32) {
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
  const selfSlot = ctx.self.slotId ?? '';
  const profile = ctx.profile;

  // CDM receiving with back to goal, turning under low pressure
  if ((role === 'def' || selfSlot.includes('vol')) && reading.pressure.intensity === 'low' && profile.composure > 0.5) {
    if (reading.space.canConductForward && pick01ForDecision(ctx) < 0.35) {
      const tx = ctx.self.x + ctx.attackDir * 8;
      const tz = ctx.self.z + (pick01ForDecision(ctx) - 0.5) * 4;
      return { type: 'turn_on_marker', targetX: clampX(tx), targetZ: clampZ(tz) };
    }
  }

  // Fullback receiving wide — advance or pass inside
  if (selfSlot.includes('le') || selfSlot.includes('ld')) {
    if (reading.space.canConductForward && reading.pressure.intensity !== 'high') {
      if (pick01ForDecision(ctx) < 0.4 + profile.dribbleTendency * 0.3) {
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
  if ((selfSlot.includes('pe') || selfSlot.includes('pd')) && reading.pressure.opponentsInZone === 1) {
    if (profile.dribbleTendency > 0.5 && pick01ForDecision(ctx) < profile.dribbleTendency) {
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
    if (nearMid && pick01ForDecision(ctx) < 0.5) {
      const tx = nearMid.snapshot.x;
      const tz = nearMid.snapshot.z;
      const gx = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
      return {
        type: 'short_pass_safety',
        option: {
          targetId: nearMid.snapshot.id,
          targetX: tx,
          targetZ: tz,
          distance: nearMid.distance,
          successProb: 0.72,
          isForward: false,
          isLong: false,
          progressionGain: 0,
          spaceAtTarget: 5,
          linesBroken: 0,
          threatDepth01: passTargetThreatDepth01(tx, ctx.attackDir),
          distToOppGoal: Math.hypot(gx - tx, FIELD_WIDTH / 2 - tz),
          sectorVacancy01: 0.5,
        },
      };
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
  if ((selfSlot.includes('zag') || role === 'def') && reading.pressure.intensity === 'extreme') {
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
  opt?: { ctx: DecisionContext; passOptions: PassOption[] },
): boolean {
  if (reading.distToGoal > 32) return false;

  // Threat-aware: rising threat makes finishing more likely
  const threatBonus = reading.threatTrend === 'rising' ? 0.04
    : reading.threatTrend === 'falling' ? -0.01
    : 0;
  const tierBonus = reading.threatLevel > 0.6 ? 0.05 : reading.threatLevel > 0.4 ? 0.03 : 0;

  const threshold = 0.042 - urgency - profile.riskAppetite * 0.045 - threatBonus - tierBonus;

  // Q1 — Close-range absoluto (pequena área): chuta SEMPRE com xG mínimo.
  // Bypassa shouldDeferBoxAutoShot — nessa zona, atacante não devia "passar por
  // segurança"; chute é a decisão correta.
  if (reading.distToGoal < 9 && xG > 0.04) return true;

  // Dentro da área: limiar baixo, mas só pode deferir pra passe quando dist > 9m.
  if ((reading.fieldZone === 'opp_box' || reading.inOppPenaltyArea) && reading.distToGoal < 19 && xG > 0.017) {
    if (opt && shouldDeferBoxAutoShot(opt.ctx, reading, opt.passOptions, xG)) {
      /* continua para as regras seguintes */
    } else {
      return true;
    }
  }
  if (reading.distToGoal < 14 && xG > 0.025) return true;
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

  if (profile.dribbleTendency > 0.7 && pick01ForDecision(ctx) < 0.25) {
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
  if (lateral && pick01ForDecision(ctx) < 0.6) return { type: 'lateral_pass', option: lateral };

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
  if (
    reading.pressure.intensity === 'none'
    && reading.threatLevel < 0.36
    && reading.distToGoal > 26
    && passOptions.some((p) => p.successProb > 0.52)
    && pick01ForDecision(ctx) < 0.11 + profile.composure * 0.14
  ) {
    return { type: 'hold_ball' };
  }

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

    if (reading.space.canConductForward && profile.composure > 0.5 && pick01ForDecision(ctx) < 0.25) {
      return { type: 'simple_carry', targetX: clampX(ctx.self.x + ctx.attackDir * 8), targetZ: clampZ(ctx.self.z + (pick01ForDecision(ctx) - 0.5) * 4) };
    }
    const fwd = pickBestForIntention(passOptions, 'progress', ctx, reading,
      p => p.isForward && p.successProb > 0.5);
    if (fwd && pick01ForDecision(ctx) < 0.45 + profile.verticality * 0.25) {
      return { type: 'vertical_pass', option: fwd };
    }
  }

  const lateralPass = pickBestForIntention(passOptions, 'maintain_possession', ctx, reading,
    p => !p.isForward && !p.isLong && p.successProb > 0.65);
  if (lateralPass && profile.possessionBias > 0.4 && pick01ForDecision(ctx) < 0.5) {
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
  if (verticalPass && pick01ForDecision(ctx) < vertProb + profile.verticality * 0.3) {
    return { type: 'vertical_pass', option: verticalPass };
  }

  if (profile.vision > 0.55) {
    const longBall = pickBestForIntention(passOptions, 'progress', ctx, reading,
      p => p.isLong && p.isForward && p.successProb > 0.35);
    if (longBall && pick01ForDecision(ctx) < 0.15 + profile.riskAppetite * 0.2) {
      return { type: 'long_ball', option: longBall };
    }
  }

  if (reading.space.canConductForward && profile.dribbleTendency > 0.3 && reading.pressure.intensity !== 'high') {
    const carryProb = threatRising ? 0.35 : 0.25;
    if (pick01ForDecision(ctx) < carryProb + profile.dribbleTendency * 0.2) {
      return { type: 'progressive_dribble', targetX: clampX(ctx.self.x + ctx.attackDir * 10), targetZ: clampZ(ctx.self.z + (pick01ForDecision(ctx) - 0.5) * 8) };
    }
  }

  const congested = reading.pressure.opponentsInZone >= 3;
  if (congested) {
    const sw = pickBestForIntention(passOptions, 'reorganize', ctx, reading,
      p => Math.abs(p.targetZ - ctx.self.z) > 25 && p.successProb > 0.45);
    if (sw) return { type: 'switch_play', option: sw };
  }

  // Dentro da grande área adversária: atacantes tentam arrancar falta com mais frequência
  // (duelo com zagueiro → chance de pênalti). Pressão mínima basta.
  if (
    reading.fieldZone === 'opp_box'
    && reading.pressure.intensity !== 'none'
    && pick01ForDecision(ctx) < 0.28
  ) {
    return { type: 'draw_foul' };
  }

  if (
    isAttackZone(reading.fieldZone)
    && (reading.pressure.intensity === 'high' || reading.pressure.intensity === 'extreme')
    && pick01ForDecision(ctx) < 0.14
  ) {
    return { type: 'draw_foul' };
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
    p => p.isForward && p.distance < 25 && p.successProb > 0.30);  // Reduzido de 0.35 para 0.30
  // Aumentar chance de through ball: era 0.45, agora 0.65 (mais ousado)
  if (throughBall && pick01ForDecision(ctx) < 0.65 + profile.vision * 0.25) {
    return { type: 'through_ball', option: throughBall };
  }

  if (reading.space.canConductForward && reading.pressure.opponentsInZone < 2 && profile.dribbleTendency > 0.35) {
    return { type: 'progressive_dribble', targetX: clampX(ctx.self.x + ctx.attackDir * 12), targetZ: clampZ(ctx.self.z + (pick01ForDecision(ctx) - 0.5) * 6) };
  }

  const otp = pickBestForIntention(passOptions, 'break_line', ctx, reading,
    p => p.distance < 12 && p.successProb > 0.55);
  if (otp && profile.firstTouchPlay > 0.4 && pick01ForDecision(ctx) < 0.3) {
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
  if (threatRising && canShoot(reading, xG, 0.02, profile, { ctx, passOptions })) {
    return retShoot(reading, ctx, reading.distToGoal > 22);
  }

  if (isWide && reading.distToGoal < 25) {
    // Aumentar frequência de cruzamentos: era só se distToGoal < 18, agora até 25m
    if (reading.distToGoal < 22) {  // Aumentado de 18 para 22
      return { type: 'run_to_byline', targetX: clampX(goalX), targetZ: ctx.self.z };
    }
    const cz = FIELD_WIDTH / 2 + (pick01ForDecision(ctx) - 0.5) * 14;
    // Aumentar chance de cruzamento: era 0.5, agora 0.7 (mais cruzamentos)
    return pick01ForDecision(ctx) < 0.7
      ? { type: 'low_cross', targetX: goalX - ctx.attackDir * 10, targetZ: cz }
      : { type: 'high_cross', targetX: goalX - ctx.attackDir * 10, targetZ: cz };
  }

  if (reading.space.canConductForward && reading.pressure.opponentsInZone < 2) {
    return { type: 'aggressive_carry', targetX: clampX(ctx.self.x + ctx.attackDir * 12), targetZ: clampZ(ctx.self.z + (pick01ForDecision(ctx) - 0.5) * 6) };
  }

  if (reading.threatTrend === 'falling') {
    const throughBall = pickBestForIntention(passOptions, 'accelerate', ctx, reading,
      p => p.isForward && p.distance < 20 && p.successProb > 0.25);  // Reduzido de 0.3 para 0.25
    if (throughBall) return { type: 'through_ball', option: throughBall };
  }

  const throughBall = pickBestForIntention(passOptions, 'accelerate', ctx, reading,
    p => p.isForward && p.distance < 20 && p.successProb > 0.30);  // Reduzido de 0.35 para 0.30
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
  if (threatFalling && reading.distToGoal < 25 && canShoot(reading, xG, 0.03, profile, { ctx, passOptions })) {
    return retShoot(reading, ctx, reading.distToGoal > 20);
  }

  if (isWide) {
    if (reading.distToGoal < 20) return { type: 'run_to_byline', targetX: clampX(goalX), targetZ: ctx.self.z };
    const cz = FIELD_WIDTH / 2 + (pick01ForDecision(ctx) - 0.5) * 14;
    return pick01ForDecision(ctx) < 0.5
      ? { type: 'low_cross', targetX: goalX - ctx.attackDir * 10, targetZ: cz }
      : { type: 'high_cross', targetX: goalX - ctx.attackDir * 10, targetZ: cz };
  }

  const throughBall = pickBestForIntention(passOptions, 'create_chance', ctx, reading,
    p => p.isForward && p.distance < 20 && p.successProb > 0.35);
  if (throughBall && profile.vision > 0.5 && pick01ForDecision(ctx) < 0.4 + profile.verticality * 0.2) {
    return { type: 'through_ball', option: throughBall };
  }

  if (reading.space.canConductForward && reading.distToGoal < 22 && reading.pressure.opponentsInZone < 2) {
    return { type: 'enter_box', targetX: clampX(goalX), targetZ: FIELD_WIDTH / 2 + (pick01ForDecision(ctx) - 0.5) * 10 };
  }

  const otp = pickBestForIntention(passOptions, 'create_chance', ctx, reading,
    p => p.distance < 12 && p.successProb > 0.55);
  if (otp && profile.firstTouchPlay > 0.4 && pick01ForDecision(ctx) < 0.3) {
    return { type: 'one_two', option: otp };
  }

  if (reading.space.canConductForward && profile.dribbleTendency > 0.4) {
    return { type: 'progressive_dribble', targetX: clampX(ctx.self.x + ctx.attackDir * 8), targetZ: clampZ(ctx.self.z + (pick01ForDecision(ctx) - 0.5) * 6) };
  }

  if (reading.pressure.intensity === 'high' && isAttackZone(reading.fieldZone) && pick01ForDecision(ctx) < 0.22) {
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
/**
 * Peso do cone de visão do portador sobre o passe.
 * Retorna multiplicador em ~[0.35, 1.10]:
 *   ∙ Alvo totalmente à frente: 1.00–1.10
 *   ∙ Alvo perpendicular: 0.80
 *   ∙ Alvo atrás (oposto ao olhar): 0.35–0.45
 * Jogador sem heading (parado) → 1.0 (sem penalidade).
 * `tatico` alto alarga o cone (visão periférica de armador).
 */
function visionConeWeight(
  selfX: number,
  selfZ: number,
  heading: number | undefined,
  targetX: number,
  targetZ: number,
  tatico: number,
): number {
  if (heading === undefined || !Number.isFinite(heading)) return 1.0;
  const dx = targetX - selfX;
  const dz = targetZ - selfZ;
  const dist2 = dx * dx + dz * dz;
  if (dist2 < 0.25) return 1.0; // alvo muito perto
  const targetAng = Math.atan2(dx, dz);
  let delta = targetAng - heading;
  // normaliza pra [-PI, PI]
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  const cosAlign = Math.cos(delta); // +1 à frente, -1 atrás
  // Visão periférica do tático: entre 70 e 95 de tatico expande o cone.
  const periph = Math.max(0, Math.min(1, (tatico - 55) / 40)); // 0..1
  // Base: 0.65 + 0.35*cosAlign → atrás: 0.30, frente: 1.00.
  // Periferia: puxa o mínimo pra cima (0.45) e dá leve bonus na frente.
  const base = 0.65 + 0.35 * cosAlign;
  const withPeriph = base + periph * 0.12 + (cosAlign > 0.8 ? periph * 0.04 : 0);
  return Math.max(0.35, Math.min(1.10, withPeriph));
}

/**
 * Bônus de criatividade: passe do meio rompendo a linha defensiva (lance-livre pro atacante).
 * Combina 3 sinais: (a) carrier é meio-campo, (b) passe cruza linhas, (c) alvo ganha
 * profundidade significativa → dá um boost que torna essa decisão preferida quando existe.
 */
function creativityBonus(
  option: PassOption,
  ctx: DecisionContext,
  reading: ContextReading,
): number {
  const role = ctx.self.role;
  if (role !== 'mid') return 0;
  if (option.linesBroken < 1) return 0;
  // Alvo tem que estar mais perto do gol adversário que o carrier.
  const depthGain = option.threatDepth01 > 0.55 ? option.threatDepth01 - 0.5 : 0;
  if (depthGain <= 0) return 0;
  // Zona do campo: zona intermediária ou ofensiva (passe de fundação não conta).
  if (reading.fieldZone === 'own_box' || reading.fieldZone === 'def_third') return 0;
  // Espaço no alvo importa — passe pra cima de zagueiro apertado é suicida.
  const spaceOk = Math.min(1, option.spaceAtTarget / 6);
  return (0.18 + depthGain * 0.35) * spaceOk;
}

function scorePassForIntention(
  option: PassOption,
  intention: PlayIntention,
  ctx: DecisionContext,
  reading: ContextReading,
): number {
  const visionW = visionConeWeight(
    ctx.self.x,
    ctx.self.z,
    ctx.self.heading,
    option.targetX,
    option.targetZ,
    ctx.self.tatico ?? 60,
  );
  const creatBonus = creativityBonus(option, ctx, reading);
  // Helper para aplicar peso de visão ao score final (+ bônus criativo aditivo).
  const withVision = (score: number) => score * visionW + creatBonus;
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
      return withVision(prog * 0.28 + option.successProb * 0.2 + space * 0.16
        + (option.isForward ? 0.12 : 0) + lines * 0.05 + xgBonus + goalProximity * 0.06
        + option.threatDepth01 * 0.14);

    case 'maintain_possession':
      return withVision(option.successProb * 0.4 + space * 0.22
        + (!option.isLong ? 0.14 : 0) + (option.distance < 15 ? 0.08 : 0)
        + (!option.isForward ? 0.04 : 0) + xgBonus * 0.5
        + option.threatDepth01 * 0.06);

    case 'accelerate':
    case 'attack_space':
    case 'break_line':
      return withVision(prog * 0.2 + lines * 0.2 + goalProximity * 0.23
        + (option.isForward ? 0.12 : 0) + option.successProb * 0.12 + xgBonus
        + option.threatDepth01 * 0.22);

    case 'create_chance':
    case 'finish':
      return withVision(goalProximity * 0.34 + space * 0.15 + option.successProb * 0.15
        + prog * 0.1 + lines * 0.08 + xgBonus * 1.55
        + option.threatDepth01 * 0.2);

    case 'reorganize':
      return withVision(option.successProb * 0.33
        + (Math.abs(option.targetZ - ctx.self.z) > 20 ? 0.18 : 0)
        + space * 0.18 + (!option.isForward ? 0.14 : 0)
        + (option.distance > 15 && option.distance < 35 ? 0.09 : 0) + xgBonus * 0.3);

    case 'relieve_pressure':
      // Passe curto pra trás / pro goleiro é legítimo aqui, mas ainda queremos evitar
      // que o jogador gire 180° contra a inércia — peso de visão atenuado (raiz).
      return withVision(option.successProb * 0.48 + space * 0.24
        + (!option.isLong ? 0.14 : 0) + (option.distance < 20 ? 0.09 : 0) + xgBonus * 0.2)
        * 0.6 + (option.successProb * 0.48 + space * 0.24
        + (!option.isLong ? 0.14 : 0) + (option.distance < 20 ? 0.09 : 0) + xgBonus * 0.2) * 0.4;

    case 'protect_result':
      return withVision(option.successProb * 0.43 + (!option.isForward ? 0.18 : 0)
        + space * 0.18 + (!option.isLong ? 0.09 : 0)
        + (option.distance < 20 ? 0.05 : 0) + xgBonus * 0.15);

    default:
      return withVision(option.successProb * 0.26 + prog * 0.2 + space * 0.16
        + (option.isForward ? 0.12 : 0) + goalProximity * 0.1 + xgBonus
        + option.threatDepth01 * 0.12);
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
  return scored[Math.floor(pick01ForDecision(ctx) * topN)]!.option;
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
