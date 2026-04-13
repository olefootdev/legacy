/**
 * Camada de decisão estratégica ANTES do chooseAction coletivo:
 * escolhe intenção macro (passar, conduzir, driblar, finalizar, recuar, inverter)
 * e qualidade da decisão (erro, lenta, correta, rápida, critical).
 */
import { FIELD_LENGTH } from '@/simulation/field';
import { evaluateShot } from '@/simulation/InteractionResolver';
import type { AgentSnapshot, PassOption } from '@/simulation/InteractionResolver';
import type { ContextReading, DecisionContext } from './types';
import { pick01ForDecision } from './decisionRng';
import type { DecisionActionId } from './collectiveIndividualDecision';
import { normalizeStyle, possessionAffinity01 } from '@/tactics/playingStyle';

export type IdealStrategicKind =
  | 'pass'
  | 'carry'
  | 'dribble'
  | 'shoot'
  | 'retreat'
  | 'switch_play';

/** Tiers de qualidade da decisão (narrativa / encadeamento). */
export type StrategicDecisionTier =
  | 'decision_wrong'
  | 'decision_slow'
  | 'decision_correct'
  | 'decision_fast'
  | 'decision_critical_hit';

export interface CarrierMacroDecision {
  ideal: IdealStrategicKind;
  tier: StrategicDecisionTier;
  /** Inclinação somada ao score do chooseAction (× macroWeight no scorer). */
  macroTilt: Partial<Record<DecisionActionId, number>>;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function possessionAffinityFromCtx(ctx: DecisionContext): number {
  return possessionAffinity01(normalizeStyle(ctx.tacticalStyle));
}

function idealStrategicFromContext(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: PassOption[],
): IdealStrategicKind {
  const posAff = possessionAffinityFromCtx(ctx);
  const shot = evaluateShot(ctx.self, ctx.attackDir, ctx.opponents);
  const progressive = passOptions.filter((p) => p.isForward && p.successProb > 0.34);
  const wideSwitch = passOptions.filter(
    (p) => p.isLong && Math.abs(p.targetZ - ctx.self.z) > 11,
  );

  if (
    (reading.fieldZone === 'opp_box' || reading.fieldZone === 'att_third')
    && shot.xG >= 0.075
  ) {
    return 'shoot';
  }

  if (reading.pressureBand === 'critical') {
    if (shot.xG >= 0.055 && reading.fieldZone === 'opp_box') return 'shoot';
    return progressive.length > 0 ? 'pass' : 'carry';
  }

  if (
    (reading.fieldZone === 'own_box' || reading.fieldZone === 'def_third')
    && reading.pressureBand !== 'passive'
  ) {
    return 'retreat';
  }

  if (
    wideSwitch.length > 0
    && posAff < 0.48
    && (reading.teamPhase === 'progression' || reading.teamPhase === 'buildup')
    && reading.spatialBand === 'construction'
  ) {
    return 'switch_play';
  }

  if (reading.lineOfSightScore < 0.41 && reading.space.canConductForward) {
    if (posAff < 0.62 || reading.pressureBand === 'high' || reading.pressureBand === 'critical') {
      return 'dribble';
    }
  }

  if (progressive.length > 0) return 'pass';

  if (
    posAff > 0.58
    && passOptions.some((p) => p.successProb > 0.42)
    && (reading.teamPhase === 'buildup' || reading.teamPhase === 'progression')
    && reading.spatialBand !== 'danger'
  ) {
    return 'pass';
  }

  return 'carry';
}

function rollStrategicTier(ctx: DecisionContext, reading: ContextReading): StrategicDecisionTier {
  const r1 = pick01ForDecision(ctx);
  const mental = (ctx.self.mentalidade + ctx.self.confianca) / 200;
  const boost = ctx.decisionExecutionBoost01 ?? 0;
  const st = (ctx.stamina ?? ctx.self.stamina ?? 88) / 100;
  const pressW =
    reading.pressureBand === 'critical' ? 0.16
    : reading.pressureBand === 'high' ? 0.09
    : reading.pressureBand === 'moderate' ? 0.04
    : 0;
  const disorg = reading.spatialBand === 'danger' ? 0.008 : 0;

  const pCrit = clamp01(0.007 + mental * 0.026 + boost * 0.024 - pressW * 0.55 + disorg - (1 - st) * 0.012);
  const pWrong = clamp01(0.1 - mental * 0.042 + pressW * 0.85 - boost * 0.05 + (1 - st) * 0.04);

  if (r1 < pCrit) return 'decision_critical_hit';
  if (r1 < pCrit + pWrong) return 'decision_wrong';

  const r2 = pick01ForDecision(ctx);
  const pSlow = 0.11 + pressW * 0.35 - mental * 0.04;
  if (r2 < pSlow) return 'decision_slow';
  if (r2 > 0.74 - mental * 0.07 - boost * 0.05) return 'decision_fast';
  return 'decision_correct';
}

function wrongAntiTilt(ideal: IdealStrategicKind): Partial<Record<DecisionActionId, number>> {
  switch (ideal) {
    case 'shoot':
      return { pass_safe: 0.48, carry: 0.32, dribble_risk: 0.18 };
    case 'pass':
      return { dribble_risk: 0.52, shoot: 0.32, carry: 0.14 };
    case 'dribble':
      return { pass_safe: 0.46, shoot: 0.28, carry: 0.12 };
    case 'retreat':
      return { dribble_risk: 0.48, shoot: 0.28, pass_progressive: 0.15 };
    case 'switch_play':
      return { pass_safe: 0.42, carry: 0.28, dribble_risk: 0.2 };
    case 'carry':
    default:
      return { dribble_risk: 0.44, shoot: 0.26, pass_long: 0.12 };
  }
}

function tiltForIdealAndTier(
  ideal: IdealStrategicKind,
  tier: StrategicDecisionTier,
): Partial<Record<DecisionActionId, number>> {
  if (tier === 'decision_wrong') {
    return wrongAntiTilt(ideal);
  }

  if (tier === 'decision_slow') {
    return { pass_safe: 0.28, carry: 0.12, shoot: -0.14, dribble_risk: -0.12, pass_progressive: -0.08 };
  }

  if (tier === 'decision_fast') {
    return { pass_progressive: 0.2, dribble_risk: 0.14, shoot: 0.12, carry: 0.1, pass_long: 0.08 };
  }

  if (tier === 'decision_critical_hit') {
    switch (ideal) {
      case 'shoot':
        return { shoot: 1.05, pass_progressive: 0.18 };
      case 'pass':
        return { pass_progressive: 0.72, pass_safe: 0.38, pass_long: 0.28 };
      case 'switch_play':
        return { pass_long: 0.88, pass_progressive: 0.22 };
      case 'dribble':
        return { dribble_risk: 0.88, carry: 0.28 };
      case 'retreat':
        return { clearance: 0.75, pass_safe: 0.42 };
      case 'carry':
      default:
        return { carry: 0.72, pass_safe: 0.22 };
    }
  }

  // decision_correct — alinhamento suave com o ideal
  switch (ideal) {
    case 'shoot':
      return { shoot: 0.38 };
    case 'pass':
      return { pass_progressive: 0.32, pass_safe: 0.14 };
    case 'switch_play':
      return { pass_long: 0.42, pass_progressive: 0.1 };
    case 'dribble':
      return { dribble_risk: 0.36, carry: 0.12 };
    case 'retreat':
      return { clearance: 0.4, pass_safe: 0.28 };
    case 'carry':
    default:
      return { carry: 0.32, pass_safe: 0.1 };
  }
}

/**
 * Decisão macro do portador: roda antes de `chooseAction` no ramo com opções de passe.
 */
export function resolveCarrierMacroDecision(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: PassOption[],
): CarrierMacroDecision {
  const ideal = idealStrategicFromContext(ctx, reading, passOptions);
  const tier = rollStrategicTier(ctx, reading);
  const macroTilt = tiltForIdealAndTier(ideal, tier);
  return { ideal, tier, macroTilt };
}

/** Classifica transição de posse para narrativa / modificadores leves. */
export function transitionOutcomeFromSteal(
  stealer: AgentSnapshot,
  stealX: number,
  attackDir: 1 | -1,
  reason: 'tackle' | 'loose_ball_recovery' | 'intercept' | 'dribble_fail',
  roll01: number,
): { result_type: 'transition'; impact_value: number; loss_profile: string; recovery_profile: string } {
  const nx = attackDir === 1 ? stealX / FIELD_LENGTH : 1 - stealX / FIELD_LENGTH;
  const dangerRecover = nx > 0.68;
  const exposedLoss = nx < 0.38 && reason !== 'loose_ball_recovery';

  let lossProfile: string;
  if (exposedLoss && roll01 < 0.34) lossProfile = 'loss_critical_exposed';
  else if (exposedLoss) lossProfile = 'loss_disorganized';
  else if (roll01 < 0.22) lossProfile = 'loss_slow';
  else lossProfile = 'loss_normal';

  let recoveryProfile: string;
  if (reason === 'intercept' && dangerRecover) recoveryProfile = 'recovery_critical_chance';
  else if (dangerRecover && roll01 > 0.55) recoveryProfile = 'recovery_fast';
  else if (roll01 > 0.72) recoveryProfile = 'recovery_organized';
  else if (roll01 < 0.28) recoveryProfile = 'recovery_slow';
  else recoveryProfile = 'recovery_normal';

  const impact =
    recoveryProfile === 'recovery_critical_chance' ? 0.85
    : recoveryProfile === 'recovery_fast' ? 0.5
    : lossProfile === 'loss_critical_exposed' ? -0.72
    : 0.15;

  return { result_type: 'transition', impact_value: impact, loss_profile: lossProfile, recovery_profile: recoveryProfile };
}
