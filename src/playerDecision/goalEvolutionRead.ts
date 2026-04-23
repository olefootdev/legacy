/**
 * Leitura de “evolução ofensiva” / ameaça ao golo — integrada ao pipeline existente
 * (`OnBallDecision` macroTilt, `tryGoalInstinct`, passes, apoio sem bola).
 *
 * Usa smartfield (`sfGetGoalContext`, zona macro), `computeLineOfSight` e atributos
 * do snapshot — sem motor paralelo, só enriquece scores já usados no OLEFOOT.
 */

import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import type { AgentSnapshot, PassOption } from '@/simulation/InteractionResolver';
import { passOptionAttackBuildUpScore } from '@/simulation/InteractionResolver';
import { computeLineOfSight } from '@/match/goalContext';
import { sfGetGoalContext, sfGetZoneDef } from '@/smartfield/smartfieldBridge';
import type { ContextReading, DecisionContext } from './types';
import type { OffBallAction } from './types';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Pressão 0–1 no ponto (x,z) — espelha a ideia de `nearestOpponentPressure01` sem mutar o agente. */
export function pressure01AtField(x: number, z: number, opponents: readonly AgentSnapshot[]): number {
  let minD = Infinity;
  for (const o of opponents) {
    const d = Math.hypot(o.x - x, o.z - z);
    if (d < minD) minD = d;
  }
  if (!Number.isFinite(minD)) return 0;
  return clamp01((4.8 - minD) / 4.8);
}

function findOppGk(opponents: readonly AgentSnapshot[]): AgentSnapshot | undefined {
  return opponents.find((o) => o.role === 'gk');
}

/**
 * Goleiro deslocado / adiantado / fora do eixo bola–golo → mais valor para o ataque.
 * Heurística leve (não simula guarda-redes frame a frame).
 */
export function gkExposure01(
  opponents: readonly AgentSnapshot[],
  attackDir: 1 | -1,
  ballX: number,
  ballZ: number,
): number {
  const gk = findOppGk(opponents);
  const goalLineX = attackDir === 1 ? FIELD_LENGTH : 0;
  const goalZ = FIELD_WIDTH / 2;
  if (!gk) return 0.32;

  const depthOut =
    attackDir === 1
      ? clamp01((goalLineX - gk.x) / 16)
      : clamp01((gk.x - goalLineX) / 16);
  const lateral = clamp01(Math.abs(gk.z - ballZ) / 18);
  const offCenter = clamp01(Math.abs(gk.z - goalZ) / 14);
  return clamp01(0.22 + depthOut * 0.38 + lateral * 0.22 + offCenter * 0.18);
}

function zoneBuildFinishingBias01(x: number, z: number): number {
  const zd = sfGetZoneDef(x, z);
  if (!zd) return 0.06;
  if (zd.third === 'attacking') return zd.lane === 'central' ? 0.14 : 0.11;
  if (zd.third === 'middle') return 0.05;
  return 0.02;
}

/**
 * Score 0–1: quão “perigosa” é esta posição para marcar (não é xG duplicado;
 * combina geometria smartfield, LOS, pressão, zona e exposição do GR).
 */
export function offensiveThreatSnapshot01(
  agent: AgentSnapshot,
  x: number,
  z: number,
  attackDir: 1 | -1,
  opponents: readonly AgentSnapshot[],
): number {
  const goalX = attackDir === 1 ? FIELD_LENGTH : 0;
  const goalZ = FIELD_WIDTH / 2;
  const sf = sfGetGoalContext(x, z, attackDir);
  const dist01 = 1 - clamp01(sf.distance / 52);
  const angle01 =
    sf.angleQuality === 'excellent' ? 1
    : sf.angleQuality === 'good' ? 0.85
    : sf.angleQuality === 'tight' ? 0.58
      : 0.38;
  const los = computeLineOfSight(x, z, goalX, goalZ, opponents);
  const press = pressure01AtField(x, z, opponents);
  const zoneW = zoneBuildFinishingBias01(x, z);
  const gk = gkExposure01(opponents, attackDir, x, z);

  const fin = agent.finalizacao / 100;
  const mental = ((agent.mentalidade ?? 70) + (agent.confianca ?? 70)) / 200;
  const tatico = (agent.tatico ?? 70) / 100;
  const exec = fin * 0.07 + mental * 0.04 + tatico * 0.025;

  return clamp01(
    0.1
    + dist01 * 0.22
    + angle01 * 0.16
    + los * 0.17
    + (1 - press) * 0.12
    + zoneW
    + gk * 0.11
    + exec,
  );
}

export interface PassContinuationRead {
  pass: PassOption;
  targetThreat: number;
  deltaVsCarrier: number;
}

/** Melhor passe para subir ameaça futura ao golo (combinado com segurança mínima). */
export function bestPassForGoalEvolution(
  carrier: AgentSnapshot,
  teammates: readonly AgentSnapshot[],
  opponents: readonly AgentSnapshot[],
  attackDir: 1 | -1,
  passOptions: readonly PassOption[],
): PassContinuationRead | null {
  if (passOptions.length === 0) return null;
  const carrierThreat = offensiveThreatSnapshot01(carrier, carrier.x, carrier.z, attackDir, opponents);
  let best: PassContinuationRead | null = null;
  let bestScore = -1e9;
  for (const p of passOptions) {
    if (p.successProb < 0.26) continue;
    const tm = teammates.find((t) => t.id === p.targetId);
    if (!tm) continue;
    const targetThreat = offensiveThreatSnapshot01(tm, p.targetX, p.targetZ, attackDir, opponents);
    const delta = targetThreat - carrierThreat;
    const blended = delta * 1.35 + p.successProb * 0.42 + passOptionAttackBuildUpScore(p) * 0.08;
    if (blended > bestScore) {
      bestScore = blended;
      best = { pass: p, targetThreat, deltaVsCarrier: delta };
    }
  }
  return best;
}

export type GoalEvolutionTilt = Partial<
  Record<
    | 'pass_safe'
    | 'pass_progressive'
    | 'pass_long'
    | 'cross'
    | 'carry'
    | 'dribble_risk'
    | 'shoot'
    | 'clearance',
    number
  >
>;

/**
 * Inclinações somadas a `macroTilt` em `chooseAction` (× 0.34 no scorer coletivo).
 * Constrói quando um passo curto eleva claramente a ameaça; segura remate precipitado.
 */
export function computeGoalEvolutionMacroTilt(
  ctx: DecisionContext,
  reading: ContextReading,
  shot: { xG: number },
  passOptions: readonly PassOption[],
): GoalEvolutionTilt {
  const tilt: GoalEvolutionTilt = {};
  if (passOptions.length === 0) return tilt;

  const cont = bestPassForGoalEvolution(
    ctx.self,
    ctx.teammates,
    ctx.opponents,
    ctx.attackDir,
    passOptions,
  );
  const carrierThreat = offensiveThreatSnapshot01(
    ctx.self,
    ctx.self.x,
    ctx.self.z,
    ctx.attackDir,
    ctx.opponents,
  );

  const carryX = Math.min(FIELD_LENGTH - 2, Math.max(2, ctx.self.x + ctx.attackDir * 7.5));
  const carryThreat = offensiveThreatSnapshot01(ctx.self, carryX, ctx.self.z, ctx.attackDir, ctx.opponents);
  const carryLift = carryThreat - carrierThreat;

  if (cont && cont.deltaVsCarrier > 0.045 && cont.pass.successProb > 0.32) {
    const str = Math.min(0.55, 0.22 + cont.deltaVsCarrier * 1.6);
    tilt.pass_progressive = (tilt.pass_progressive ?? 0) + str * 0.95;
    if (cont.pass.isLong) tilt.pass_long = (tilt.pass_long ?? 0) + str * 0.55;
    const shootPenalty = Math.min(0.62, 0.18 + cont.deltaVsCarrier * 1.9 + (1 - reading.lineOfSightScore) * 0.12);
    tilt.shoot = (tilt.shoot ?? 0) - shootPenalty;
    if (cont.pass.successProb > 0.52 && !cont.pass.isForward) {
      tilt.pass_safe = (tilt.pass_safe ?? 0) + 0.04;
    }
  }

  if (
    carryLift > 0.035
    && reading.lineOfSightScore < 0.55
    && reading.pressure.intensity !== 'extreme'
  ) {
    tilt.carry = (tilt.carry ?? 0) + Math.min(0.38, 0.12 + carryLift * 2.2);
    tilt.dribble_risk = (tilt.dribble_risk ?? 0) + Math.min(0.32, 0.1 + carryLift * 1.8);
    if (shot.xG < 0.07) tilt.shoot = (tilt.shoot ?? 0) - 0.1;
  }

  const press01 = pressure01AtField(ctx.self.x, ctx.self.z, ctx.opponents);
  if (press01 > 0.52 && (!cont || cont.deltaVsCarrier < 0.03)) {
    tilt.pass_safe = (tilt.pass_safe ?? 0) + 0.14;
    tilt.shoot = (tilt.shoot ?? 0) - 0.12;
  }

  if (carrierThreat > 0.52 && (!cont || cont.deltaVsCarrier < 0.04) && reading.lineOfSightScore > 0.42) {
    tilt.shoot = (tilt.shoot ?? 0) + 0.12;
  }

  return tilt;
}

/** Passe pós-prioridade: mistura ameaça futura ao score já existente `passOptionAttackBuildUpScore`. */
export function passOptionAttackBuildUpWithGoalEvolution(
  o: PassOption,
  teammates: readonly AgentSnapshot[],
  opponents: readonly AgentSnapshot[],
  attackDir: 1 | -1,
): number {
  const base = passOptionAttackBuildUpScore(o);
  const tm = teammates.find((t) => t.id === o.targetId);
  if (!tm) return base;
  const post = offensiveThreatSnapshot01(tm, o.targetX, o.targetZ, attackDir, opponents);
  return base + post * 0.1;
}

/**
 * Evita instinto de remate quando um companheiro eleva muito mais a ameaça com passe viável.
 */
export function shouldDeferInstinctShotForProgression(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: readonly PassOption[],
  xG: number,
): boolean {
  if (xG > 0.092) return false;
  if (reading.distToGoal < 8.5 && reading.lineOfSightScore > 0.4) return false;

  const cont = bestPassForGoalEvolution(ctx.self, ctx.teammates, ctx.opponents, ctx.attackDir, passOptions);
  if (!cont) return false;
  if (cont.pass.successProb < 0.34) return false;
  if (cont.deltaVsCarrier < 0.065) return false;
  if (reading.lineOfSightScore > 0.78 && xG > 0.045) return false;
  return true;
}

/** Refinar o auto-golo na área: não “return true” só por proximidade se o passe melhora muito a ameaça. */
export function shouldDeferBoxAutoShot(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: readonly PassOption[],
  xG: number,
): boolean {
  const cont = bestPassForGoalEvolution(ctx.self, ctx.teammates, ctx.opponents, ctx.attackDir, passOptions);
  if (!cont || cont.pass.successProb < 0.36) return false;
  if (cont.deltaVsCarrier < 0.055) return false;
  if (reading.distToGoal < 9 && xG > 0.028) return false;
  if (reading.lineOfSightScore > 0.62 && reading.pressure.nearestOpponentDist > 2.8) return false;
  return xG < 0.04 || reading.lineOfSightScore < 0.48;
}

/** Nudge leve (metros) nos alvos de apoio: aproxima o corredor do que sobe ameaça sem “teleportar”. */
export function nudgeOffBallTowardHigherThreat(
  ctx: DecisionContext,
  reading: ContextReading,
  action: OffBallAction,
): OffBallAction {
  if (ctx.possession !== ctx.self.side) return action;
  if (reading.teamPhase !== 'attack' && reading.teamPhase !== 'progression') return action;
  const nx = ctx.attackDir === 1 ? ctx.ballX / FIELD_LENGTH : 1 - ctx.ballX / FIELD_LENGTH;
  if (nx < 0.48) return action;

  if (!('targetX' in action) || !('targetZ' in action)) return action;
  const tx = action.targetX;
  const tz = action.targetZ;
  const base = offensiveThreatSnapshot01(ctx.self, tx, tz, ctx.attackDir, ctx.opponents);
  const fwd = offensiveThreatSnapshot01(
    ctx.self,
    Math.min(FIELD_LENGTH - 3, Math.max(3, tx + ctx.attackDir * 3.5)),
    tz,
    ctx.attackDir,
    ctx.opponents,
  );
  if (fwd <= base + 0.012) return action;

  const alpha = Math.min(0.28, 0.12 + (fwd - base) * 2.4);
  const pullX = tx + ctx.attackDir * 3.5;
  return {
    ...action,
    targetX: tx + (pullX - tx) * alpha,
    targetZ: tz,
  };
}
