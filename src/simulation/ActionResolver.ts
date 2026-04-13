/**
 * Resolução crítica pós-decisão: acerto/erro com RNG determinístico (seed + tick + jogador + ação).
 */

import { FIELD_LENGTH, FIELD_WIDTH } from './field';
import {
  evaluateShot,
  nearestOpponentPressure01,
  pointToSegmentDist,
  resolvePassLanding,
  type AgentSnapshot,
  type PassOption,
} from './InteractionResolver';
import { rngFromSeed } from '@/match/rngDraw';
import {
  ACTION_SOFT_CAP_CROSS,
  ACTION_SOFT_CAP_DRIBBLE,
  PASS_INTERCEPT_LINE_DIST,
  PASS_INTERCEPT_PROB_CAP,
  SHOT_P_ON_TARGET_CAP,
  SHOT_P_ON_TARGET_FLOOR,
  SHOT_XG_CAP,
} from '@/match/actionResolutionTuning';
import type { ShotStrikeProfile } from '@/match/causal/matchCausalTypes';
import type { ActionExecutionTier, ExecutionImpact01 } from '@/match/actionExecutionTier';
import {
  computeCriticalHitProbShot,
  passInterceptMultiplierForTier,
  resolveCrossExecutionTier,
  resolveDribbleExecutionTier,
  resolvePassExecutionTier,
  resolveShotExecutionTier,
  tightenPassLandingForTier,
} from '@/match/actionExecutionTier';

export type ShotOutcomeKind = 'goal' | 'save' | 'block' | 'miss';

/** Subtipo de `save` no motor contínuo: espalma (rebote) vs segurar. */
export type ShotSaveKind = 'parry' | 'hold';

export interface PassPossessionResult {
  completed: boolean;
  x: number;
  z: number;
  interceptPlayerId: string | null;
  roll: number;
  pSuccess: number;
  reason: string;
  executionTier: ActionExecutionTier;
  impact01: ExecutionImpact01;
}

export interface CrossPossessionResult {
  success: boolean;
  targetX: number;
  targetZ: number;
  roll: number;
  pSuccess: number;
  reason: string;
  executionTier: ActionExecutionTier;
  impact01: ExecutionImpact01;
}

export interface DribbleContestResult {
  success: boolean;
  roll: number;
  pSuccess: number;
  reason: string;
  executionTier: ActionExecutionTier;
  impact01: ExecutionImpact01;
}

export interface ShotPossessionResult {
  outcome: ShotOutcomeKind;
  rollOnTarget: number;
  pOnTarget: number;
  rollBranch: number;
  goalX: number;
  goalZ: number;
  xGOnTarget: number;
  reason: string;
  /** Contacto: fraco (menos xG), colocado (base), forte (mais risco de fora, mais “pancada”). */
  strikeProfile: ShotStrikeProfile;
  executionTier: ActionExecutionTier;
  impact01: ExecutionImpact01;
  /** xG elevado por critical strike antes do ramo gol/defesa. */
  xGCriticalBoosted: boolean;
  /** Só quando `outcome === 'save'`. */
  saveKind?: ShotSaveKind;
  /** Ponto de contacto no bloqueio (trajetória contínua até ao defensor). */
  blockContact?: { x: number; z: number; deflectorId: string | null };
}

export interface ActionResolverDebugRow {
  playerId: string;
  action: string;
  zoneTags: readonly string[];
  roll: number;
  threshold: number;
  outcome: string;
  possessionBefore: string;
  possessionAfter: string;
  reason: string;
}

const SHOT_BLOCK_LINE_DIST_M = 3.25;

function closestPointOnSegmentToPoint(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  px: number,
  pz: number,
): { x: number; z: number; t: number } {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-6) return { x: ax, z: az, t: 0 };
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0.06, Math.min(0.93, t));
  return { x: ax + t * dx, z: az + t * dz, t };
}

function pickShotBlockContact(
  opponents: AgentSnapshot[],
  carrier: AgentSnapshot,
  goalX: number,
  goalZ: number,
  rng: ReturnType<typeof rngFromSeed>,
): { x: number; z: number; deflectorId: string | null } {
  let best: AgentSnapshot | null = null;
  let bestD = SHOT_BLOCK_LINE_DIST_M;
  for (const o of opponents) {
    if (o.role === 'gk') continue;
    const d = pointToSegmentDist(o.x, o.z, carrier.x, carrier.z, goalX, goalZ);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  const ax = carrier.x;
  const az = carrier.z;
  const bx = goalX;
  const bz = goalZ;
  if (best) {
    const cp = closestPointOnSegmentToPoint(ax, az, bx, bz, best.x, best.z);
    return { x: cp.x, z: cp.z, deflectorId: best.id };
  }
  const t = 0.55 + rng.nextUnit() * 0.28;
  return {
    x: ax + (bx - ax) * t,
    z: az + (bz - az) * t,
    deflectorId: null,
  };
}

/** GameSpirit: `spiritMomentumClamp01` alto favorece casa (não força corte — só enviesa xG). */
function spiritAttackMomentum01(side: AgentSnapshot['side'], spiritMomentumClamp01: number | null | undefined): number {
  if (spiritMomentumClamp01 == null) return 0;
  const c = Math.min(0.98, Math.max(0.02, spiritMomentumClamp01));
  const favorHome = c - 0.5;
  return (side === 'home' ? favorHome : -favorHome) * 0.11;
}

function bestInterceptorOnLine(
  opponents: AgentSnapshot[],
  carrier: AgentSnapshot,
  tx: number,
  tz: number,
): { id: string; lineDist: number; snap: AgentSnapshot } | null {
  let best: AgentSnapshot | null = null;
  let bestD = PASS_INTERCEPT_LINE_DIST;
  for (const o of opponents) {
    const d = pointToSegmentDist(o.x, o.z, carrier.x, carrier.z, tx, tz);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best ? { id: best.id, lineDist: bestD, snap: best } : null;
}

function pickShotStrikeProfile(
  rng: ReturnType<typeof rngFromSeed>,
  carrier: AgentSnapshot,
  press01: number,
  longRange: boolean,
): ShotStrikeProfile {
  const fin = carrier.finalizacao / 100;
  const str = carrier.fisico / 100;
  const st = (carrier.stamina ?? 88) / 100;
  const r = rng.nextUnit();
  const weakPull = press01 * 0.38 + (1 - fin) * 0.22 + (1 - st) * 0.12;
  const powerPull = fin * 0.28 + str * 0.34 + (1 - press01) * 0.22 + (longRange ? 0.1 : 0.04);
  if (r < 0.14 + weakPull * 0.42) return 'weak';
  if (r > 0.58 + (1 - powerPull) * 0.28) return 'power';
  return 'placed';
}

/** Trajetória rematador → ponto na baliza a esta distância (m) ou menos do GR = passa pela “zona de presença”. */
const GK_SHOT_PRESENCE_TRAJ_DIST_M = 3.45;

function opponentGoalkeeper(opponents: AgentSnapshot[]): AgentSnapshot | null {
  return opponents.find((o) => o.role === 'gk') ?? null;
}

/** 0–1: “força” do remate para comparar com a defesa do GR. */
function shotPower01FromStrike(strike: ShotStrikeProfile, carrier: AgentSnapshot): number {
  const fin = carrier.finalizacao / 100;
  const str = carrier.fisico / 100;
  if (strike === 'power') return Math.min(1, 0.52 + str * 0.32 + fin * 0.1);
  if (strike === 'weak') return Math.min(1, 0.3 + str * 0.12 + fin * 0.22);
  return Math.min(1, 0.42 + str * 0.2 + fin * 0.24);
}

/** 0–1: capacidade defensiva do GR (marc./tático/físico/vel.). */
function gkDefense01FromSnapshot(gk: AgentSnapshot): number {
  const m =
    gk.marcacao * 0.5 + gk.tatico * 0.3 + gk.fisico * 0.12 + gk.velocidade * 0.08;
  return Math.min(1, m / 100);
}

function gkCorrectDecisionProb(gk: AgentSnapshot, shooterPressure01: number): number {
  const base =
    0.45
    + (gk.marcacao / 100) * 0.2
    + (gk.tatico / 100) * 0.18
    + (gk.confianca / 100) * 0.12
    - shooterPressure01 * 0.1;
  return Math.max(0.32, Math.min(0.88, base));
}

export function resolvePassForPossession(
  baseSeed: number,
  tickKey: number,
  carrier: AgentSnapshot,
  option: PassOption,
  pressure01: number,
  opponents: AgentSnapshot[],
  tacticalDisorg01 = 0,
): PassPossessionResult {
  const rng = rngFromSeed(baseSeed, `pass:${carrier.id}:${tickKey}:${option.targetId}`);
  const rngTier = rngFromSeed(baseSeed, `pass-tier:${carrier.id}:${tickKey}:${option.targetId}`);
  const land = resolvePassLanding(option, carrier, pressure01, rng);

  if (!land.completed) {
    const failTier = resolvePassExecutionTier({
      completed: false,
      interceptPlayerId: null,
      roll: land.roll,
      pSuccess: land.pSuccess,
      carrier,
      pressure01,
      option,
      tacticalDisorg01,
      rng: rngTier,
    });
    return {
      completed: false,
      x: land.x,
      z: land.z,
      interceptPlayerId: null,
      roll: land.roll,
      pSuccess: land.pSuccess,
      executionTier: failTier.tier,
      impact01: failTier.impact01,
      reason: `pass_incomplete loose p=${land.pSuccess.toFixed(3)} roll=${land.roll.toFixed(3)} tier=${failTier.tier}`,
    };
  }

  const passTier = resolvePassExecutionTier({
    completed: true,
    interceptPlayerId: null,
    roll: land.roll,
    pSuccess: land.pSuccess,
    carrier,
    pressure01,
    option,
    tacticalDisorg01,
    rng: rngTier,
  });

  let lx = land.x;
  let lz = land.z;
  const tight = tightenPassLandingForTier(lx, lz, option.targetX, option.targetZ, passTier.tier);
  lx = tight.x;
  lz = tight.z;

  const cand = bestInterceptorOnLine(opponents, carrier, option.targetX, option.targetZ);
  if (cand) {
    let pInt = Math.min(
      PASS_INTERCEPT_PROB_CAP,
      cand.snap.marcacao / 100 * 0.44 + (1 - cand.lineDist / PASS_INTERCEPT_LINE_DIST) * 0.22,
    );
    pInt *= passInterceptMultiplierForTier(passTier.tier);
    const r = rng.nextUnit();
    if (r < pInt) {
      return {
        completed: false,
        x: lx,
        z: lz,
        interceptPlayerId: cand.id,
        roll: land.roll,
        pSuccess: land.pSuccess,
        executionTier: 'error',
        impact01: -0.52,
        reason: `intercept passTier=${passTier.tier} lineDist=${cand.lineDist.toFixed(2)} pInt=${pInt.toFixed(3)} r=${r.toFixed(3)}`,
      };
    }
  }

  return {
    completed: true,
    x: lx,
    z: lz,
    interceptPlayerId: null,
    roll: land.roll,
    pSuccess: land.pSuccess,
    executionTier: passTier.tier,
    impact01: passTier.impact01,
    reason: `pass_completed tier=${passTier.tier} p=${land.pSuccess.toFixed(3)} roll=${land.roll.toFixed(3)}`,
  };
}

export function resolveCrossForPossession(
  baseSeed: number,
  tickKey: number,
  carrier: AgentSnapshot,
  opponents: AgentSnapshot[],
  targetX: number,
  targetZ: number,
  isHigh: boolean,
): CrossPossessionResult {
  const rng = rngFromSeed(baseSeed, `cross:${carrier.id}:${tickKey}`);
  const rngTier = rngFromSeed(baseSeed, `cross-tier:${carrier.id}:${tickKey}`);
  const press = nearestOpponentPressure01(carrier, opponents);
  const cr = carrier.cruzamento / 100;
  const conf = Math.min(1.28, carrier.confidenceRuntime ?? 1);
  const st = (carrier.stamina ?? 90) / 100;
  let pOk = 0.4 + cr * 0.42 + (carrier.mentalidade / 100) * 0.1;
  pOk *= 0.9 + conf * 0.1;
  pOk -= press * 0.2;
  pOk *= 0.92 + st * 0.08;
  pOk = Math.max(0.12, Math.min(ACTION_SOFT_CAP_CROSS, pOk));
  const roll = rng.nextUnit();
  const success = roll < pOk;
  const tx = targetX + (success ? 0 : (rng.nextUnit() - 0.5) * 14);
  const tz = targetZ + (success ? 0 : (rng.nextUnit() - 0.5) * 10);
  const tr = resolveCrossExecutionTier({
    success,
    roll,
    pSuccess: pOk,
    carrier,
    pressure01: press,
    rng: rngTier,
  });
  return {
    success,
    targetX: tx,
    targetZ: tz,
    roll,
    pSuccess: pOk,
    executionTier: tr.tier,
    impact01: tr.impact01,
    reason: `${success ? 'cross_ok' : 'cross_fail'} tier=${tr.tier} p=${pOk.toFixed(3)} roll=${roll.toFixed(3)} high=${isHigh}`,
  };
}

export function resolveDribbleBeat(
  baseSeed: number,
  tickKey: number,
  carrier: AgentSnapshot,
  pressure01: number,
): DribbleContestResult {
  const rng = rngFromSeed(baseSeed, `dribble:${carrier.id}:${tickKey}`);
  const rngTier = rngFromSeed(baseSeed, `dribble-tier:${carrier.id}:${tickKey}`);
  const skill = carrier.drible / 100;
  const st = (carrier.stamina ?? 90) / 100;
  let pOk = 0.38 + skill * 0.42;
  pOk -= pressure01 * 0.55;
  pOk *= 0.88 + st * 0.12;
  pOk *= 0.9 + (carrier.mentalidade / 100) * 0.08;
  pOk = Math.max(0.14, Math.min(ACTION_SOFT_CAP_DRIBBLE, pOk));
  const roll = rng.nextUnit();
  const success = roll < pOk;
  const tr = resolveDribbleExecutionTier({
    success,
    roll,
    pSuccess: pOk,
    carrier,
    pressure01,
    rng: rngTier,
  });
  return {
    success,
    roll,
    pSuccess: pOk,
    executionTier: tr.tier,
    impact01: tr.impact01,
    reason: `dribble tier=${tr.tier} p=${pOk.toFixed(3)} roll=${roll.toFixed(3)} press=${pressure01.toFixed(2)}`,
  };
}

/**
 * Chute: primeiro “no alvo” (gol + defesa); miss → fora / tiro de meta lógico (posse defensora).
 */
export function resolveShotForPossession(
  baseSeed: number,
  tickKey: number,
  carrier: AgentSnapshot,
  attackDir: 1 | -1,
  opponents: AgentSnapshot[],
  zoneTags: readonly string[],
  longRange: boolean,
  tacticalDisorg01 = 0,
  spiritMomentumClamp01: number | null | undefined = undefined,
): ShotPossessionResult {
  const rng = rngFromSeed(baseSeed, `shot:${carrier.id}:${tickKey}`);
  const rngTier = rngFromSeed(baseSeed, `shot-tier:${carrier.id}:${tickKey}`);
  const strikeProfile = pickShotStrikeProfile(rng, carrier, nearestOpponentPressure01(carrier, opponents), longRange);
  const chance = evaluateShot(carrier, attackDir, opponents);
  const press = nearestOpponentPressure01(carrier, opponents);
  const fin = carrier.finalizacao / 100;
  const str01 = carrier.fisico / 100;
  const mental = (carrier.mentalidade + carrier.confianca) / 200;
  let pOnTarget =
    0.28
    + fin * 0.26
    + mental * 0.12
    - press * 0.21
    + (1 - Math.min(1, chance.angle / (Math.PI * 0.42))) * 0.07;
  if (chance.distance > 20) pOnTarget -= (chance.distance - 20) * 0.0075;
  const tagSet = new Set(zoneTags);
  if (tagSet.has('opp_box')) pOnTarget += 0.17;
  if (tagSet.has('own_box') || tagSet.has('defensive_third')) pOnTarget -= 0.22;
  if (longRange) pOnTarget -= 0.12;
  const confRun = Math.min(1.25, carrier.confidenceRuntime ?? 1);
  pOnTarget *= 0.92 + confRun * 0.08;
  if (strikeProfile === 'weak') {
    pOnTarget += 0.045;
    pOnTarget -= fin * 0.03;
  } else if (strikeProfile === 'power') {
    pOnTarget -= 0.075;
    pOnTarget += str01 * 0.025;
  }
  pOnTarget = Math.max(SHOT_P_ON_TARGET_FLOOR, Math.min(SHOT_P_ON_TARGET_CAP, pOnTarget));

  const rollOnTarget = rng.nextUnit();
  const goalX = attackDir === 1 ? FIELD_LENGTH : 0;
  const goalZ =
    FIELD_WIDTH / 2
    + (rng.nextUnit() - 0.5)
      * (strikeProfile === 'power' ? 6.8 : strikeProfile === 'weak' ? 4.1 : 5.2);

  if (rollOnTarget >= pOnTarget) {
    const missTag =
      strikeProfile === 'power' ? 'blaze_wide'
        : strikeProfile === 'weak' ? 'weak_wide'
          : 'miss_wide';
    const st = resolveShotExecutionTier({
      outcome: 'miss',
      rollOnTarget,
      pOnTarget,
      rollBranch: -1,
      xGOnTarget: 0,
      carrier,
      press01: press,
      tacticalDisorg01,
      rng: rngTier,
    });
    return {
      outcome: 'miss',
      rollOnTarget,
      pOnTarget,
      rollBranch: -1,
      goalX,
      goalZ,
      xGOnTarget: 0,
      strikeProfile,
      executionTier: st.tier,
      impact01: st.impact01,
      xGCriticalBoosted: false,
      reason: `${missTag} strike=${strikeProfile} tier=${st.tier} pOn=${pOnTarget.toFixed(3)} r=${rollOnTarget.toFixed(3)} dist=${chance.distance.toFixed(1)}`,
    };
  }

  const gk = opponentGoalkeeper(opponents);
  const rngGkDec = rngFromSeed(baseSeed, `shot-gkdec:${carrier.id}:${tickKey}`);
  const trajDistGk =
    gk === null
      ? Number.POSITIVE_INFINITY
      : pointToSegmentDist(gk.x, gk.z, carrier.x, carrier.z, goalX, goalZ);
  const inGkPresence = gk !== null && trajDistGk <= GK_SHOT_PRESENCE_TRAJ_DIST_M;
  const shotPower01 = shotPower01FromStrike(strikeProfile, carrier);
  const gkDef01 = gk ? gkDefense01FromSnapshot(gk) : 0;
  const powerBeatsGk = gk === null || shotPower01 > gkDef01 + 0.028;
  const pGkCorrect = gk ? gkCorrectDecisionProb(gk, press) : 1;
  const gkWrongDecision = gk === null || rngGkDec.nextUnit() > pGkCorrect;
  const forcedGkRuleGoal = gk !== null && inGkPresence && powerBeatsGk && gkWrongDecision;

  if (forcedGkRuleGoal) {
    const rollBranchGk = rngGkDec.nextUnit();
    const st = resolveShotExecutionTier({
      outcome: 'goal',
      rollOnTarget,
      pOnTarget,
      rollBranch: rollBranchGk,
      xGOnTarget: chance.xG,
      carrier,
      press01: press,
      tacticalDisorg01,
      rng: rngTier,
    });
    return {
      outcome: 'goal',
      rollOnTarget,
      pOnTarget,
      rollBranch: rollBranchGk,
      goalX,
      goalZ,
      xGOnTarget: chance.xG,
      strikeProfile,
      executionTier: st.tier,
      impact01: st.impact01,
      xGCriticalBoosted: false,
      reason:
        `goal_gk_presence trajD=${trajDistGk.toFixed(2)} power=${shotPower01.toFixed(2)}>def=${gkDef01.toFixed(2)} `
        + `gkWrong=${gkWrongDecision} tier=${st.tier} strike=${strikeProfile}`,
    };
  }

  let xG = chance.xG * (longRange ? 0.72 : 1);
  xG *= 0.94 + Math.min(confRun, 1.2) * 0.06;
  if (tagSet.has('opp_box')) xG *= 1.07;
  if (strikeProfile === 'weak') {
    xG *= 0.82;
  } else if (strikeProfile === 'power') {
    xG *= 1.09;
  }
  xG = Math.max(0.02, Math.min(SHOT_XG_CAP, xG));
  const spiritBias = spiritAttackMomentum01(carrier.side, spiritMomentumClamp01);
  xG = Math.max(0.02, Math.min(SHOT_XG_CAP, xG * (1 + spiritBias)));

  const rngCrit = rngFromSeed(baseSeed, `shot-xgcrit:${carrier.id}:${tickKey}`);
  let xGCriticalBoosted = false;
  const pCritShot = computeCriticalHitProbShot(carrier, press, tacticalDisorg01);
  const suppressXgBecauseGkPresence = gk !== null && inGkPresence;
  if (suppressXgBecauseGkPresence) {
    xG = 0;
  } else if (rngCrit.nextUnit() < pCritShot * 0.52) {
    xG = Math.min(SHOT_XG_CAP, xG * 1.16);
    xGCriticalBoosted = true;
  }

  const rollBranch = rng.nextUnit();
  if (rollBranch < xG) {
    let executionTier: ActionExecutionTier = 'good';
    let impact01 = 0.78;
    if (xGCriticalBoosted) {
      executionTier = 'critical_hit';
      impact01 = 1;
    } else {
      const st = resolveShotExecutionTier({
        outcome: 'goal',
        rollOnTarget,
        pOnTarget,
        rollBranch,
        xGOnTarget: xG,
        carrier,
        press01: press,
        tacticalDisorg01,
        rng: rngTier,
      });
      executionTier = st.tier;
      impact01 = st.impact01;
    }
    return {
      outcome: 'goal',
      rollOnTarget,
      pOnTarget,
      rollBranch,
      goalX,
      goalZ,
      xGOnTarget: xG,
      strikeProfile,
      executionTier,
      impact01,
      xGCriticalBoosted,
      reason: `goal tier=${executionTier} strike=${strikeProfile} xG=${xG.toFixed(3)} branch=${rollBranch.toFixed(3)} xgCrit=${xGCriticalBoosted}`,
    };
  }
  const rem = 1 - xG;
  const saveShare = rem * (strikeProfile === 'weak' ? 0.64 : strikeProfile === 'power' ? 0.52 : 0.58);
  if (rollBranch < xG + saveShare) {
    const st = resolveShotExecutionTier({
      outcome: 'save',
      rollOnTarget,
      pOnTarget,
      rollBranch,
      xGOnTarget: xG,
      carrier,
      press01: press,
      tacticalDisorg01,
      rng: rngTier,
    });
    const rngSk = rngFromSeed(baseSeed, `shot-savekind:${carrier.id}:${tickKey}`);
    const holdLean =
      (strikeProfile === 'weak' ? 0.24 : strikeProfile === 'placed' ? 0.11 : -0.06)
      + (press < 0.36 ? 0.11 : -0.04)
      + Math.max(0, gkDef01 - shotPower01) * 0.38
      + (inGkPresence ? 0.09 : -0.05);
    const pHold = Math.max(0.16, Math.min(0.84, 0.44 + holdLean));
    const saveKind: ShotSaveKind = rngSk.nextUnit() < pHold ? 'hold' : 'parry';
    return {
      outcome: 'save',
      rollOnTarget,
      pOnTarget,
      rollBranch,
      goalX,
      goalZ,
      xGOnTarget: xG,
      strikeProfile,
      executionTier: st.tier,
      impact01: st.impact01,
      xGCriticalBoosted,
      saveKind,
      reason: `save tier=${st.tier} strike=${strikeProfile} branch=${rollBranch.toFixed(3)} xG=${xG.toFixed(3)} save=${saveKind}`,
    };
  }
  const sb = resolveShotExecutionTier({
    outcome: 'block',
    rollOnTarget,
    pOnTarget,
    rollBranch,
    xGOnTarget: xG,
    carrier,
    press01: press,
    tacticalDisorg01,
    rng: rngTier,
  });
  const rngBlk = rngFromSeed(baseSeed, `shot-blockpt:${carrier.id}:${tickKey}`);
  const blockContact = pickShotBlockContact(opponents, carrier, goalX, goalZ, rngBlk);
  return {
    outcome: 'block',
    rollOnTarget,
    pOnTarget,
    rollBranch,
    goalX,
    goalZ,
    xGOnTarget: xG,
    strikeProfile,
    executionTier: sb.tier,
    impact01: sb.impact01,
    xGCriticalBoosted,
    blockContact,
    reason: `block tier=${sb.tier} strike=${strikeProfile} branch=${rollBranch.toFixed(3)} xG=${xG.toFixed(3)} def=${blockContact.deflectorId ?? 'none'}`,
  };
}

export function logActionResolverDebug(row: ActionResolverDebugRow): void {
  if ((globalThis as { __OF_ACTION_RESOLVER_DEBUG__?: boolean }).__OF_ACTION_RESOLVER_DEBUG__ !== true) return;
  const z = row.zoneTags.join('+');
  console.debug(
    `[action-resolve] ${row.action} | zones: ${z} | roll: ${row.roll.toFixed(3)} vs ${row.threshold.toFixed(3)} | ${row.outcome} | pos ${row.possessionBefore}→${row.possessionAfter} | ${row.reason}`,
  );
}
