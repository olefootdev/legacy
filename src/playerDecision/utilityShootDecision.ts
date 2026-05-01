/**
 * utilityShootDecision.ts — FASE 1.3
 *
 * Migra a CASCATA de chute em `tryGoalInstinct` (OnBallDecision.ts) para
 * Utility AI multi-axis usando o engine data-driven em `@/decisionAI/utility`.
 *
 * O design preserva o fluxo externo (gates de comfort zone, connectorFirst,
 * key-pass instinct continuam intactos). Substitui apenas o miolo da decisão
 * de remate (linhas que encadeavam if-elses sobre xG/distToGoal/pressure).
 *
 * Saída:
 *   shootInstinctUtility(...) → { score, fire, longRange }
 *
 * Caller decide se chama `shootUnlessSmarterPass(longRange)` ou retorna null.
 *
 */

import type { CandidateAction, UtilityResult } from '@/decisionAI/utility';
import { scoreAction, applyInertiaBonus } from '@/decisionAI/utility';
import type { ContextReading, DecisionContext, PlayerProfile } from './types';
import { recordShootTelemetry } from './utilityShootTelemetry';
import { getLastShootAction, recordShootAction } from './agentActionMemory';

// ---------------------------------------------------------------------------
// CandidateAction (data-driven) — 5 axes
// ---------------------------------------------------------------------------

/**
 * Eixo 1 — xG: sigmoid (k=80, c=1, b=0).
 *   xG=0.01 → ~0.05  · xG=0.025 → ~0.5  · xG=0.05 → ~0.86  · xG≥0.10 → ~1.0
 *
 * Eixo 2 — closenessToGoal: linear inverso (m=-1/30, b=1).
 *   dist=0 → 1.0  ·  dist=15 → 0.5  ·  dist=30 → 0.0
 *
 * Eixo 3 — pressureSafety: quadratic_down sobre opponentsInZone normalizado [0,8].
 *   0 oponentes → 1.0  ·  4 → 0.75  ·  8 → 0.0
 *
 * Eixo 4 — lineOfSight: sigmoid (k=10, c=0.4, m=1, b=0).
 *   los=0.2 → ~0.12  ·  los=0.4 → 0.5  ·  los=0.6 → 0.88
 *
 * Eixo 5 — riskAppetite: linear modulator com peso 0.5.
 *   risk=0 → 0.5  ·  risk=0.5 → 0.75  ·  risk=1.0 → 1.0
 */
const SHOOT_INSTINCT_CANDIDATE: CandidateAction = {
  id: 'shoot_instinct',
  axes: [
    // xG (sigmoid: m=steepness, k=center, b=offset, c=scale)
    { input: 'xG',                curve: 'sigmoid',        m: 80,  k: 0.025, b: 0, c: 1 },
    // closenessToGoal (linear: m=slope, k=x-shift, b=y-intercept)
    { input: 'closenessToGoal',   curve: 'linear',         m: 1,   k: 0,     b: 0, c: 1 },
    // pressureSafety (linear sobre 1 - opp/8 já calculado upstream)
    { input: 'pressureSafety',    curve: 'linear',         m: 1,   k: 0,     b: 0, c: 1 },
    // lineOfSight (sigmoid centrado em 0.4)
    { input: 'lineOfSight',       curve: 'sigmoid',        m: 10,  k: 0.4,   b: 0, c: 1 },
    // riskAppetite (linear com soft floor — peso menor: 0.5 base + 0.5 escala)
    { input: 'riskAppetiteMod',   curve: 'linear',         m: 1,   k: 0,     b: 0, c: 1, weight: 0.85 },
  ],
};

// ---------------------------------------------------------------------------
// Build inputs map a partir de reading + ctx + xG + profile
// ---------------------------------------------------------------------------

export interface ShootInstinctInputs {
  xG: number;
  /** [0,1]: 1 = colado ao gol, 0 = ≥30m. */
  closenessToGoal: number;
  /** [0,1]: 1 = sem oponentes na zona, 0 = ≥8 oponentes. */
  pressureSafety: number;
  /** [0,1]: linha de visão da bola para o gol (já normalizado upstream). */
  lineOfSight: number;
  /** [0.5,1.0]: 0.5 base + riskAppetite/2 — modulator suave (não veta). */
  riskAppetiteMod: number;
}

export function buildShootInstinctInputs(
  reading: ContextReading,
  xG: number,
  profile: PlayerProfile,
): ShootInstinctInputs {
  const closeness = Math.max(0, 1 - reading.distToGoal / 30);
  const pressureSafety = Math.max(0, 1 - (reading.pressure.opponentsInZone ?? 0) / 8);
  const los = Math.max(0, Math.min(1, reading.lineOfSightScore ?? 0));
  const risk = Math.max(0, Math.min(1, profile.riskAppetite ?? 0.4));
  return {
    xG,
    closenessToGoal: closeness,
    pressureSafety,
    lineOfSight: los,
    riskAppetiteMod: 0.5 + risk * 0.5,
  };
}

// ---------------------------------------------------------------------------
// Public API — score + fire decision
// ---------------------------------------------------------------------------

export interface ShootInstinctVerdict {
  score: number;
  fire: boolean;
  longRange: boolean;
  /** Breakdown bruto por axis input — debug/telemetria. */
  rawScores: Record<string, number>;
}

/**
 * Threshold mínimo para o remate ser disparado.
 * Calibrado conservadoramente: cobre todos os casos da cascata legacy
 * (xG ≥ 0.009 dentro da pequena área, xG ≥ 0.078 a 25m) sem regressão.
 *
 *  - 0.40: agressivo
 *  - 0.45: BALANCEADO (default)
 *  - 0.55: conservador
 */
export const SHOOT_INSTINCT_THRESHOLD = 0.45;

/**
 * Avalia o disparo do instinto de remate via Utility AI multi-axis.
 *
 * Comportamento equivalente à cascata legacy mas SEM early-returns
 * conservadores acumulados — atributos do jogador (riskAppetite) e
 * lineOfSight participam diretamente do score (antes só vetavam).
 */
export function shootInstinctUtility(
  ctx: DecisionContext,
  reading: ContextReading,
  xG: number,
  profile: PlayerProfile,
  threshold: number = SHOOT_INSTINCT_THRESHOLD,
): ShootInstinctVerdict {
  const inputs = buildShootInstinctInputs(reading, xG, profile);
  const inputsRecord: Record<string, number> = {
    xG: inputs.xG,
    closenessToGoal: inputs.closenessToGoal,
    pressureSafety: inputs.pressureSafety,
    lineOfSight: inputs.lineOfSight,
    riskAppetiteMod: inputs.riskAppetiteMod,
  };

  const baseResult: UtilityResult = scoreAction(SHOOT_INSTINCT_CANDIDATE, inputsRecord);
  // Apply inertia bonus if agent fired shoot recently (anti-flickering).
  const previousShoot = getLastShootAction(ctx.self.id);
  const adjusted = applyInertiaBonus([baseResult], previousShoot, 0.05);
  const result: UtilityResult = adjusted[0]!;

  // Bonus situacional (fora do produto): six-yard box é gol quase certo.
  // Aditivo, capa em 1.0 — preserva o comportamento da cascata "PEQUENA ÁREA".
  const bonus = reading.distToGoal < 6 ? 0.18 : 0;
  const finalScore = Math.min(1, result.score + bonus);

  // Long-range derivado da geometria (alinha com `shootUnlessSmarterPass(longRange)`).
  const longRange = reading.distToGoal > 21;

  // Risco mínimo para chutes de longa distância — preserva gate da cascata.
  const longRangeRiskOk = !longRange || (profile.riskAppetite ?? 0) > 0.22;

  const fire = finalScore >= threshold && longRangeRiskOk;

  // Persist last action ID for inertia next tick.
  if (fire) recordShootAction(ctx.self.id, SHOOT_INSTINCT_CANDIDATE.id);

  // FASE 1.3 — Telemetria observacional (DEV-only, no-op em prod).
  recordShootTelemetry({
    agentId: ctx.self.id,
    slot: ctx.self.slotId,
    role: ctx.self.role,
    zone: reading.fieldZone,
    minute: reading.minute,
    xG,
    distToGoal: reading.distToGoal,
    opponentsInZone: reading.pressure.opponentsInZone ?? 0,
    nearestOpponentDist: reading.pressure.nearestOpponentDist ?? 0,
    lineOfSightScore: reading.lineOfSightScore ?? 0,
    riskAppetite: profile.riskAppetite ?? 0,
    axisXG: result.rawScores['xG'] ?? 0,
    axisCloseness: result.rawScores['closenessToGoal'] ?? 0,
    axisPressure: result.rawScores['pressureSafety'] ?? 0,
    axisLineOfSight: result.rawScores['lineOfSight'] ?? 0,
    axisRiskMod: result.rawScores['riskAppetiteMod'] ?? 0,
    score: finalScore,
    threshold,
    fire,
    longRange,
  });

  return {
    score: finalScore,
    fire,
    longRange,
    rawScores: result.rawScores,
  };
}
