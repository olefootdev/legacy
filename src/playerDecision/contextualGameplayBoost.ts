/**
 * Camada de influência contextual nas decisões (macroTilt / suportes).
 * Não substitui motor físico nem scoring base — apenas enviesa prioridades.
 */
import { FIELD_WIDTH } from '@/simulation/field';
import type { AgentSnapshot, PassOption } from '@/simulation/InteractionResolver';
import type { BallSector, ContextReading, DecisionContext, OnBallAction } from './types';
import { mapRole } from './collectiveIndividualDecision';
import type { DecisionActionId } from './collectiveIndividualDecision';

const TRIANGLE_NEAR = 14;

export interface CarrierPassSlice {
  progressive: PassOption;
  safePass: PassOption;
  longPass: PassOption;
}

function addTilt(t: Partial<Record<DecisionActionId, number>>, id: DecisionActionId, v: number) {
  t[id] = (t[id] ?? 0) + v;
}

function sk(a: AgentSnapshot): string {
  return (a.slotId ?? '').toLowerCase();
}

function teammate(ctx: DecisionContext, id: string): AgentSnapshot | null {
  return ctx.teammates.find((x) => x.id === id) ?? null;
}

function isStrikerSlot(s: string): boolean {
  return s.includes('ata');
}

function isCamOrSecond(s: string): boolean {
  return s === 'ca' || s.startsWith('ca') || s.includes('ca');
}

/** Par natural portador → alvo de passe (alta probabilidade em futebol real). */
function pairStrength01(ctx: DecisionContext, carrier: AgentSnapshot, pass: PassOption): number {
  const cs = sk(carrier);
  const tm = teammate(ctx, pass.targetId);
  const ts = tm ? sk(tm) : '';

  if (isWingPair(cs, ts)) return 1;
  if (isFbToVol(cs, ts)) return 0.88;
  if (isZagToVol(cs, ts)) return 0.82;
  if (isCamToSt(cs, ts)) return 0.95;
  if (isStToCam(carrier.role, cs, ts)) return 0.78;
  if (isMidToStriker(carrier, ts)) return 0.9;
  return 0;
}

function isWingPair(cs: string, ts: string): boolean {
  return (cs.includes('ld') && ts.includes('pd')) || (cs.includes('le') && ts.includes('pe'));
}

function isFbToVol(cs: string, ts: string): boolean {
  return (cs.includes('ld') || cs.includes('le')) && ts.includes('vol');
}

function isZagToVol(cs: string, ts: string): boolean {
  return cs.includes('zag') && ts.includes('vol');
}

function isCamToSt(cs: string, ts: string): boolean {
  return cs.includes('ca') && isStrikerSlot(ts);
}

function isStToCam(role: string, cs: string, ts: string): boolean {
  return role === 'attack' && isStrikerSlot(cs) && isCamOrSecond(ts);
}

function isMidToStriker(carrier: AgentSnapshot, ts: string): boolean {
  const s = sk(carrier);
  const midish = carrier.role === 'mid' || s.includes('vol') || mapRole(carrier) === 'meia';
  return midish && isStrikerSlot(ts);
}

function countTriangleMates(ctx: DecisionContext, reading: ContextReading): number {
  let n = 0;
  for (const o of reading.availableTeammates) {
    if (o.distance > TRIANGLE_NEAR) continue;
    if (o.isForward || o.isOpen) n++;
  }
  return n;
}

function sameFlankBall(selfZ: number, ballZ: number): boolean {
  const mid = FIELD_WIDTH / 2;
  return (selfZ - mid) * (ballZ - mid) >= 0;
}

/** Ponta do mesmo corredor “corta” para o meio — lateral sobe à ponta. */
function wingerCutInsideFreeChannel(ctx: DecisionContext, carrierSlot: string): boolean {
  const wingTag = carrierSlot.includes('ld') ? 'pd' : carrierSlot.includes('le') ? 'pe' : '';
  if (!wingTag) return false;
  const w = ctx.teammates.find((t) => sk(t).includes(wingTag));
  if (!w) return false;
  const centralish = Math.abs(w.z - FIELD_WIDTH / 2) < 10;
  const ahead = ctx.attackDir === 1 ? w.x >= ctx.self.x - 3 : w.x <= ctx.self.x + 3;
  return centralish && ahead;
}

/** Passe “conector” melhor que remate marginal (CAM/ST livre à frente). */
export function shouldDeferShotForConnectorPass(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: PassOption[],
  shotXG: number,
): boolean {
  if (passOptions.length === 0) return false;
  if (shotXG >= 0.095) return false;

  const eliteFinish = reading.fieldZone === 'opp_box' && shotXG >= 0.055 && reading.lineOfSightScore >= 0.42;
  if (eliteFinish) return false;

  for (const p of passOptions) {
    if (p.successProb < 0.36) continue;
    if (p.threatDepth01 < 0.44) continue;
    if (p.spaceAtTarget < 3.8 && p.successProb < 0.48) continue;
    const tm = teammate(ctx, p.targetId);
    if (!tm) continue;
    const ts = sk(tm);
    const connector = isStrikerSlot(ts) || isCamOrSecond(ts);
    if (!connector) continue;
    if (p.distToOppGoal + 1.2 < reading.distToGoal) return true;
    if (reading.pressure.intensity === 'high' || reading.pressure.intensity === 'extreme') {
      if (p.successProb >= 0.42 && p.spaceAtTarget >= 4.2) return true;
    }
  }
  return false;
}

/** Se existir passe claramente melhor para finalizador / CAM, devolve-o antes do instinto de remate. */
export function tryConnectorPassBeforeShot(
  ctx: DecisionContext,
  reading: ContextReading,
  passOptions: PassOption[],
  shotXG: number,
): OnBallAction | null {
  if (!shouldDeferShotForConnectorPass(ctx, reading, passOptions, shotXG)) return null;
  const cand = passOptions
    .filter((p) => p.successProb >= 0.36 && p.threatDepth01 >= 0.42)
    .filter((p) => {
      const tm = teammate(ctx, p.targetId);
      if (!tm) return false;
      const ts = sk(tm);
      return isStrikerSlot(ts) || isCamOrSecond(ts);
    });
  cand.sort((a, b) => b.threatDepth01 * b.successProb - a.threatDepth01 * a.successProb);
  const p = cand[0];
  if (!p) return null;
  if (p.isLong && p.isForward) return { type: 'long_ball', option: p };
  if (p.linesBroken > 0 && p.isForward) return { type: 'through_ball', option: p };
  return { type: 'vertical_pass', option: p };
}

/**
 * Inclinação somada a `macroTilt` em `chooseAction` (peso interno ×0.34).
 * Ordem de grandeza calibrada para ~+30% ações táticas, ~+20% pares naturais, ~−20% ruído.
 */
export function computeContextualGameplayMacroTilt(
  ctx: DecisionContext,
  reading: ContextReading,
  slice: CarrierPassSlice,
): Partial<Record<DecisionActionId, number>> {
  const out: Partial<Record<DecisionActionId, number>> = {};
  if (ctx.possession !== ctx.self.side) return out;

  const carrier = ctx.self;
  const cs = sk(carrier);
  const role = mapRole(carrier);
  const ballSideOk = sameFlankBall(carrier.z, ctx.ballZ);
  const attPh = reading.teamPhase === 'attack' || reading.teamPhase === 'progression';
  const offensiveZone =
    reading.fieldZone === 'att_mid'
    || reading.fieldZone === 'att_third'
    || reading.fieldZone === 'opp_box';

  const tactW = 0.22;
  const pairW = 0.18;
  const noiseW = -0.12;

  const prog = slice.progressive;
  const safe = slice.safePass;
  const lng = slice.longPass;

  // Favor lead/progressive passes into the penalty area when the progressive
  // option points to a target close to goal and there is reasonable space.
  try {
    if (prog && prog.distToOppGoal < 22 && prog.spaceAtTarget > 3.2 && prog.successProb > 0.32) {
      addTilt(out, 'pass_progressive', 0.36);
      // small extra bias to through-ball style if lines are broken
      if (prog.linesBroken > 0) addTilt(out, 'pass_progressive', 0.12);
    }
  } catch (e) {
    // noop - conservative fail-safe
  }

  const ppPair = pairStrength01(ctx, carrier, prog);
  const spPair = pairStrength01(ctx, carrier, safe);
  const lpPair = pairStrength01(ctx, carrier, lng);

  if (ppPair > 0 && prog.successProb > 0.28) {
    addTilt(out, 'pass_progressive', tactW * 0.35 + ppPair * pairW);
  }
  if (spPair > 0.75 && safe.successProb > 0.5) {
    addTilt(out, 'pass_safe', spPair * pairW * 0.55);
  }
  if (lpPair > 0.6 && lng.isLong && lng.successProb > 0.26) {
    addTilt(out, 'pass_long', tactW * 0.28 + lpPair * pairW * 0.45);
  }

  const lateral = cs.includes('le') || cs.includes('ld');
  if (lateral && attPh && offensiveZone) {
    if (ballSideOk || wingerCutInsideFreeChannel(ctx, cs)) {
      addTilt(out, 'cross', tactW * 0.55 + 0.08);
      addTilt(out, 'carry', tactW * 0.42);
      if (ppPair >= 0.88) addTilt(out, 'pass_progressive', pairW * 0.35);
    }
  }

  const midCreator = role === 'meia' || role === 'volante' || carrier.role === 'mid';
  if (midCreator && offensiveZone) {
    const toSt =
      teammate(ctx, prog.targetId)
      && isStrikerSlot(sk(teammate(ctx, prog.targetId)!))
      && prog.successProb > 0.32;
    if (toSt) addTilt(out, 'pass_progressive', tactW * 0.5 + pairW * 0.25);
    const wideFree = ctx.teammates.some((t) => {
      const s = sk(t);
      const wide = s.includes('pe') || s.includes('pd') || s.includes('le') || s.includes('ld');
      const d = Math.hypot(t.x - carrier.x, t.z - carrier.z);
      const open = Math.hypot(t.x - ctx.ballX, t.z - ctx.ballZ) > 8;
      return wide && d < 26 && d > 8 && open;
    });
    if (wideFree) addTilt(out, 'pass_long', tactW * 0.32);

    if (countTriangleMates(ctx, reading) >= 2 && reading.spatialBand !== 'danger') {
      addTilt(out, 'pass_progressive', tactW * 0.25);
    }
  }

  // If a nearby fullback is available and the pass option to them shows space,
  // slightly favour progressive / long options to involve the fullback in build.
  try {
    const fb = ctx.teammates.find((t) => sk(t).includes('le') || sk(t).includes('ld'));
    if (fb) {
      const cand = [prog, safe, lng].find((o) => o && o.targetId === fb.id) as (PassOption | undefined) | undefined;
      if (cand && cand.spaceAtTarget > 3.8 && cand.successProb > 0.28) {
        addTilt(out, 'pass_progressive', 0.22);
        addTilt(out, 'pass_long', 0.08);
      }
    }
  } catch (e) {
    // noop
  }

  const zag = role === 'zagueiro' || cs.includes('zag');
  if (zag && teammate(ctx, safe.targetId) && isZagToVol(cs, sk(teammate(ctx, safe.targetId)!)) && safe.successProb > 0.45) {
    addTilt(out, 'pass_safe', pairW * 0.65);
    addTilt(out, 'pass_progressive', tactW * 0.15);
  }

  const construction =
    reading.spatialBand === 'construction'
    || reading.spatialBand === 'safe'
    || reading.teamPhase === 'buildup'
    || reading.teamPhase === 'progression';

  const hasProgression =
    prog.successProb > 0.4
    && (prog.isForward || prog.threatDepth01 > 0.34)
    && prog.progressionGain > 0.06;

  if (construction && hasProgression) {
    const fbOverlap = lateral && attPh && offensiveZone && (ballSideOk || wingerCutInsideFreeChannel(ctx, cs));
    if (fbOverlap) {
      addTilt(out, 'dribble_risk', noiseW * 0.55);
    } else {
      addTilt(out, 'carry', noiseW);
      addTilt(out, 'dribble_risk', noiseW * 0.92);
    }
  }

  return out;
}

/** +participação de laterais em sobreposição (prob. base já existe em OffBallDecision). */
export function contextualFullbackOverlapRoll01(
  ctx: DecisionContext,
  reading: ContextReading,
  sector: BallSector,
): number {
  if (ctx.possession !== ctx.self.side) return 0;
  const s = sk(ctx.self);
  if (!s.includes('le') && !s.includes('ld')) return 0;
  const isLeft = ctx.self.z < FIELD_WIDTH / 2;
  const mySector: BallSector = isLeft ? 'left' : 'right';
  if (sector !== mySector) return 0;
  if (!(reading.teamPhase === 'attack' || reading.teamPhase === 'progression')) return 0;
  return 0.12;
}
