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

export type ShotOutcomeKind = 'goal' | 'save' | 'block' | 'miss';

export interface PassPossessionResult {
  completed: boolean;
  x: number;
  z: number;
  interceptPlayerId: string | null;
  roll: number;
  pSuccess: number;
  reason: string;
}

export interface CrossPossessionResult {
  success: boolean;
  targetX: number;
  targetZ: number;
  roll: number;
  pSuccess: number;
  reason: string;
}

export interface DribbleContestResult {
  success: boolean;
  roll: number;
  pSuccess: number;
  reason: string;
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

export function resolvePassForPossession(
  baseSeed: number,
  tickKey: number,
  carrier: AgentSnapshot,
  option: PassOption,
  pressure01: number,
  opponents: AgentSnapshot[],
): PassPossessionResult {
  const rng = rngFromSeed(baseSeed, `pass:${carrier.id}:${tickKey}:${option.targetId}`);
  const land = resolvePassLanding(option, carrier, pressure01, rng);
  if (land.completed) {
    return {
      completed: true,
      x: land.x,
      z: land.z,
      interceptPlayerId: null,
      roll: land.roll,
      pSuccess: land.pSuccess,
      reason: `pass_completed p=${land.pSuccess.toFixed(3)} roll=${land.roll.toFixed(3)}`,
    };
  }
  let interceptPlayerId: string | null = null;
  const cand = bestInterceptorOnLine(opponents, carrier, option.targetX, option.targetZ);
  if (cand) {
    const pInt = Math.min(
      PASS_INTERCEPT_PROB_CAP,
      cand.snap.marcacao / 100 * 0.44 + (1 - cand.lineDist / PASS_INTERCEPT_LINE_DIST) * 0.22,
    );
    const r = rng.nextUnit();
    if (r < pInt) {
      interceptPlayerId = cand.id;
      return {
        completed: false,
        x: land.x,
        z: land.z,
        interceptPlayerId,
        roll: land.roll,
        pSuccess: land.pSuccess,
        reason: `intercept lineDist=${cand.lineDist.toFixed(2)} pInt=${pInt.toFixed(3)} r=${r.toFixed(3)}`,
      };
    }
  }
  return {
    completed: false,
    x: land.x,
    z: land.z,
    interceptPlayerId: null,
    roll: land.roll,
    pSuccess: land.pSuccess,
    reason: `pass_incomplete loose p=${land.pSuccess.toFixed(3)} roll=${land.roll.toFixed(3)}`,
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
  return {
    success,
    targetX: tx,
    targetZ: tz,
    roll,
    pSuccess: pOk,
    reason: `${success ? 'cross_ok' : 'cross_fail'} p=${pOk.toFixed(3)} roll=${roll.toFixed(3)} high=${isHigh}`,
  };
}

export function resolveDribbleBeat(
  baseSeed: number,
  tickKey: number,
  carrier: AgentSnapshot,
  pressure01: number,
): DribbleContestResult {
  const rng = rngFromSeed(baseSeed, `dribble:${carrier.id}:${tickKey}`);
  const skill = carrier.drible / 100;
  const st = (carrier.stamina ?? 90) / 100;
  let pOk = 0.38 + skill * 0.42;
  pOk -= pressure01 * 0.55;
  pOk *= 0.88 + st * 0.12;
  pOk *= 0.9 + (carrier.mentalidade / 100) * 0.08;
  pOk = Math.max(0.14, Math.min(ACTION_SOFT_CAP_DRIBBLE, pOk));
  const roll = rng.nextUnit();
  return {
    success: roll < pOk,
    roll,
    pSuccess: pOk,
    reason: `dribble p=${pOk.toFixed(3)} roll=${roll.toFixed(3)} press=${pressure01.toFixed(2)}`,
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
): ShotPossessionResult {
  const rng = rngFromSeed(baseSeed, `shot:${carrier.id}:${tickKey}`);
  const chance = evaluateShot(carrier, attackDir, opponents);
  const press = nearestOpponentPressure01(carrier, opponents);
  const fin = carrier.finalizacao / 100;
  const mental = (carrier.mentalidade + carrier.confianca) / 200;
  let pOnTarget =
    0.28
    + fin * 0.26
    + mental * 0.12
    - press * 0.21
    + (1 - Math.min(1, chance.angle / (Math.PI * 0.42))) * 0.07;
  if (chance.distance > 20) pOnTarget -= (chance.distance - 20) * 0.0075;
  const tagSet = new Set(zoneTags);
  if (tagSet.has('opp_box')) pOnTarget += 0.12;
  if (tagSet.has('own_box') || tagSet.has('defensive_third')) pOnTarget -= 0.22;
  if (longRange) pOnTarget -= 0.12;
  const confRun = Math.min(1.25, carrier.confidenceRuntime ?? 1);
  pOnTarget *= 0.92 + confRun * 0.08;
  pOnTarget = Math.max(SHOT_P_ON_TARGET_FLOOR, Math.min(SHOT_P_ON_TARGET_CAP, pOnTarget));

  const rollOnTarget = rng.nextUnit();
  const goalX = attackDir === 1 ? FIELD_LENGTH : 0;
  const goalZ = FIELD_WIDTH / 2 + (rng.nextUnit() - 0.5) * 5.2;

  if (rollOnTarget >= pOnTarget) {
    return {
      outcome: 'miss',
      rollOnTarget,
      pOnTarget,
      rollBranch: -1,
      goalX,
      goalZ,
      xGOnTarget: 0,
      reason: `miss_wide pOn=${pOnTarget.toFixed(3)} r=${rollOnTarget.toFixed(3)} dist=${chance.distance.toFixed(1)}`,
    };
  }

  let xG = chance.xG * (longRange ? 0.72 : 1);
  xG *= 0.94 + Math.min(confRun, 1.2) * 0.06;
  xG = Math.max(0.02, Math.min(SHOT_XG_CAP, xG));

  const rollBranch = rng.nextUnit();
  if (rollBranch < xG) {
    return {
      outcome: 'goal',
      rollOnTarget,
      pOnTarget,
      rollBranch,
      goalX,
      goalZ,
      xGOnTarget: xG,
      reason: `goal xG=${xG.toFixed(3)} branch=${rollBranch.toFixed(3)}`,
    };
  }
  const rem = 1 - xG;
  const saveShare = rem * 0.58;
  if (rollBranch < xG + saveShare) {
    return {
      outcome: 'save',
      rollOnTarget,
      pOnTarget,
      rollBranch,
      goalX,
      goalZ,
      xGOnTarget: xG,
      reason: `save branch=${rollBranch.toFixed(3)} xG=${xG.toFixed(3)}`,
    };
  }
  return {
    outcome: 'block',
    rollOnTarget,
    pOnTarget,
    rollBranch,
    goalX,
    goalZ,
    xGOnTarget: xG,
    reason: `block branch=${rollBranch.toFixed(3)} xG=${xG.toFixed(3)}`,
  };
}

export function logActionResolverDebug(row: ActionResolverDebugRow): void {
  if ((globalThis as { __OF_ACTION_RESOLVER_DEBUG__?: boolean }).__OF_ACTION_RESOLVER_DEBUG__ !== true) return;
  const z = row.zoneTags.join('+');
  console.debug(
    `[action-resolve] ${row.action} | zones: ${z} | roll: ${row.roll.toFixed(3)} vs ${row.threshold.toFixed(3)} | ${row.outcome} | pos ${row.possessionBefore}→${row.possessionAfter} | ${row.reason}`,
  );
}
