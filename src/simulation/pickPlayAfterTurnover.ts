/**
 * Pure, testable choice of first on-ball action after possession changes by tackle / loose recovery.
 * Priority: finishing shot → progressive pass → safe circulation → short carry away from steal point.
 */
import type { OnBallAction } from '@/playerDecision/types';
import type { AgentSnapshot, PassOption } from './InteractionResolver';
import { findPassOptions, evaluateShot } from './InteractionResolver';
import { FIELD_LENGTH, clampToPitch } from './field';

export type TurnoverReason = 'tackle' | 'loose_ball_recovery';

export interface TurnoverPickContext {
  /** Seeded PRNG in [0, 1) for deterministic tests */
  rng: () => number;
  /** Manager tactical mentality 0–100 */
  mentality: number;
  /** Carrier profile risk appetite 0–1 */
  risk: number;
  /** Previous carrier — excluded from pass targets */
  exCarrierId: string | null;
  attackDir: 1 | -1;
  stealX: number;
  stealZ: number;
  /** Optional; only used for tests / telemetry */
  reason?: TurnoverReason;
}

const W_SAFETY = 1.15;
const W_PROGRESS = 1.05;
const W_COHERENCE = 0.55;

/** Mulberry32 — deterministic from integer seed */
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashTurnoverSeed(parts: string[]): number {
  let h = 2166136261;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      h ^= p.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

export function pressure01(carrier: AgentSnapshot, opponents: AgentSnapshot[]): number {
  let near = 0;
  let bestD = Infinity;
  for (const o of opponents) {
    const d = Math.hypot(o.x - carrier.x, o.z - carrier.z);
    if (d < bestD) bestD = d;
    if (d < 5) near++;
  }
  const v = near * 0.22 + (bestD < 2.8 ? 0.4 : bestD < 5.5 ? 0.2 : 0);
  return Math.min(1, v);
}

/** True if in a plausible finishing arc (meia-lua aproximada) */
export function inFinishingZone(
  carrier: AgentSnapshot,
  attackDir: 1 | -1,
  shot: { distance: number; angle: number },
  pressure: number,
): boolean {
  if (shot.distance > 19) return false;
  if (shot.angle > Math.PI * 0.4) return false;
  if (pressure > 0.52) return false;
  const inAttThird = attackDir === 1 ? carrier.x > FIELD_LENGTH * 0.58 : carrier.x < FIELD_LENGTH * 0.42;
  return inAttThird;
}

function shotTierScore(
  shot: ReturnType<typeof evaluateShot>,
  pressure: number,
  mentality: number,
  rng: () => number,
): number {
  return (
    shot.xG * 4.2
    + (1 - pressure) * 1.1
    + (mentality / 100) * 0.18
    + (rng() - 0.5) * 0.035
  );
}

const SHOOT_TIER_MIN = 0.62;

function progressiveUtility(opt: PassOption, mentality: number, risk: number, rng: () => number): number {
  const safety = opt.successProb * 0.55 + Math.min(opt.spaceAtTarget, 14) / 14 * 0.45;
  const progression =
    opt.progressionGain * 0.95
    + (opt.linesBroken > 0 ? 0.22 : 0)
    + (opt.isForward ? 0.18 : -0.04);
  const coherence = (mentality / 100) * risk * (opt.isForward ? 0.35 : 0.08);
  return safety * W_SAFETY + progression * W_PROGRESS + coherence * W_COHERENCE + (rng() - 0.5) * 0.028;
}

const PROGRESSIVE_MIN = 0.52;

function safeBuildUtility(
  opt: PassOption,
  carrier: AgentSnapshot,
  stealX: number,
  stealZ: number,
  rng: () => number,
): number {
  const awaySteal = Math.hypot(opt.targetX - stealX, opt.targetZ - stealZ);
  const safety = opt.successProb * 1.15 + Math.min(opt.spaceAtTarget, 16) / 16 * 0.85;
  return safety + awaySteal * 0.035 + (rng() - 0.5) * 0.022;
}

const SAFE_MIN = 0.38;

function mapPassType(
  carrier: AgentSnapshot,
  opt: PassOption,
  kind: 'progressive' | 'safe',
  attackDir: 1 | -1,
): OnBallAction {
  const dx = opt.targetX - carrier.x;
  const forward = dx * attackDir > 2.5;

  if (kind === 'progressive') {
    if (opt.isLong && forward) return { type: 'long_ball', option: opt };
    if (opt.linesBroken >= 1 && forward) return { type: 'through_ball', option: opt };
    return { type: 'vertical_pass', option: opt };
  }

  if (!forward && dx * attackDir < -1.5) return { type: 'short_pass_safety', option: opt };
  if (Math.abs(opt.targetZ - carrier.z) > Math.abs(dx) * 0.75) return { type: 'lateral_pass', option: opt };
  return { type: 'short_pass_safety', option: opt };
}

function carryAwayFromSteal(
  carrier: AgentSnapshot,
  opponents: AgentSnapshot[],
  stealX: number,
  stealZ: number,
  attackDir: 1 | -1,
): { x: number; z: number } {
  const vx = carrier.x - stealX;
  const vz = carrier.z - stealZ;
  const len = Math.hypot(vx, vz) || 1;
  let nx = vx / len + attackDir * 0.5;
  let nz = vz / len;
  const nlen = Math.hypot(nx, nz) || 1;
  nx /= nlen;
  nz /= nlen;

  let best = clampToPitch(carrier.x + nx * 5.5, carrier.z + nz * 5.5);
  let bestScore = -Infinity;
  for (let s = 4; s <= 7; s += 1.5) {
    const p = clampToPitch(carrier.x + nx * s, carrier.z + nz * s);
    let minO = Infinity;
    for (const o of opponents) {
      const d = Math.hypot(o.x - p.x, o.z - p.z);
      if (d < minO) minO = d;
    }
    const away = Math.hypot(p.x - stealX, p.z - stealZ);
    const score = minO * 0.45 + away * 0.12 + p.x * attackDir * 0.02;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

export function pickPlayAfterTurnover(
  carrier: AgentSnapshot,
  teammates: AgentSnapshot[],
  opponents: AgentSnapshot[],
  ctx: TurnoverPickContext,
): OnBallAction {
  const { rng, mentality, risk, exCarrierId, attackDir, stealX, stealZ } = ctx;

  const passOpts = findPassOptions(carrier, teammates, opponents, attackDir).filter(
    (o) => o.targetId !== exCarrierId,
  );
  const shot = evaluateShot(carrier, attackDir, opponents);
  const pressure = pressure01(carrier, opponents);

  if (inFinishingZone(carrier, attackDir, shot, pressure)) {
    const su = shotTierScore(shot, pressure, mentality, rng);
    if (su >= SHOOT_TIER_MIN) {
      return shot.distance > 26 ? { type: 'shoot_long_range' } : { type: 'shoot' };
    }
  }

  const progressiveCandidates = passOpts.filter(
    (o) =>
      o.successProb >= 0.4
      && (o.isForward || o.linesBroken >= 1 || o.progressionGain > 0.07)
      && o.spaceAtTarget > 3.2,
  );
  let bestP: PassOption | null = null;
  let bestPU = PROGRESSIVE_MIN - 1;
  for (const o of progressiveCandidates) {
    const u = progressiveUtility(o, mentality, risk, rng);
    if (u > bestPU) {
      bestPU = u;
      bestP = o;
    }
  }
  if (bestP && bestPU >= PROGRESSIVE_MIN) {
    return mapPassType(carrier, bestP, 'progressive', attackDir);
  }

  const safeCandidates = passOpts.filter((o) => o.successProb >= 0.48);
  let bestS: PassOption | null = null;
  let bestSU = SAFE_MIN - 1;
  for (const o of safeCandidates) {
    const u = safeBuildUtility(o, carrier, stealX, stealZ, rng);
    if (u > bestSU) {
      bestSU = u;
      bestS = o;
    }
  }
  if (bestS && bestSU >= SAFE_MIN) {
    return mapPassType(carrier, bestS, 'safe', attackDir);
  }

  const c = carryAwayFromSteal(carrier, opponents, stealX, stealZ, attackDir);
  return { type: 'simple_carry', targetX: c.x, targetZ: c.z };
}
