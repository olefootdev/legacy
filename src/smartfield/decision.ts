/**
 * Motor único de decisão posicional do SmartField.
 *
 * Cada jogador, por tick, consulta `getBestAction(player, all, side, ctx)` e
 * recebe uma `Decision` tipada (action + confidence + reason + target). A
 * hierarquia de zonas decide:
 *
 *   goalmouth > six_yard > box > creation > press > build_up > recovery
 *
 * Bias por macro-zona em `ZONE_BIAS` é a única fonte de verdade — handlers
 * (skills, cobranças, eventos) chamam `biasFor(zone)` em vez de espalhar
 * pesos pelos arquivos.
 *
 * FASE 1.2 — miolo migrado para Utility AI multi-axis (Dave Mark / IAUS).
 */

import type { ZoneInfo } from '@/match/spatialZones';
import {
  isBox,
  isSixYard,
  isGoalmouth,
  isCreationZone,
  isPressZone,
  isBuildUpZone,
  isRecoveryZone,
  isFinalThird,
  isMidThird,
  isWing,
  isHalfspace,
  laneOf,
} from '@/match/spatialZones';
import { getAwarenessContext, distance2D, type AwarePlayer } from '@/smartfield/awareness';
import {
  scoreAction,
  applyInertiaBonus,
  shouldHesitate,
  sampleWeightedAction,
} from '@/decisionAI/utility/engine';
import type { CandidateAction } from '@/decisionAI/utility/types';

// ── Bias por macro-zona ───────────────────────────────────────────

export interface ZoneBiasEntry {
  shoot?: number;
  dribble?: number;
  cross?: number;
  halfspace?: number;
  mustShootIfFree?: boolean;
}

export const ZONE_BIAS: Record<string, ZoneBiasEntry> = {
  attacking_center: { shoot: 0.4, dribble: 0.1, cross: 0.0, mustShootIfFree: true },
  attacking_left_halfspace: { shoot: 0.1, dribble: 0.2, cross: 0.1, halfspace: 0.3 },
  attacking_right_halfspace: { shoot: 0.1, dribble: 0.2, cross: 0.1, halfspace: 0.3 },
  attacking_left_wing: { shoot: -0.2, dribble: 0.1, cross: 0.4 },
  attacking_right_wing: { shoot: -0.2, dribble: 0.1, cross: 0.4 },
};

export function biasFor(z: ZoneInfo): ZoneBiasEntry {
  return ZONE_BIAS[z.macro ?? ''] ?? {};
}

// ── Decision API ──────────────────────────────────────────────────

export type ActionKind =
  | 'SHOOT'
  | 'CROSS'
  | 'PASS'
  | 'DRIBBLE'
  | 'PRESS'
  | 'MID_BLOCK'
  | 'CLEAR'
  | 'HOLD'
  | 'RECOVER_POSITION'
  | 'FREE_KICK_DIRECT';

export interface Decision {
  action: ActionKind;
  confidence: number;
  reason: string;
  target?: AwarePlayer;
  /** Delta a aplicar no xG/triggerChance quando aplicável. */
  shootBias?: number;
}

export interface DecisionContext {
  hasBall: boolean;
  isFreeKick: boolean;
  ballCarrier?: AwarePlayer;
  /** ID da ação anterior do agente (para inertia bonus 1.4) */
  previousActionId?: string | null;
}

// ── Utility inputs builder ────────────────────────────────────────

interface UtilityInputs {
  distToGoalNorm: number;    // 0=na boca, 1=longe
  pressureLevel: number;     // 0-1
  hasBall: number;           // 0 ou 1
  isBox: number;             // 0 ou 1
  isSixYard: number;         // 0 ou 1
  isGoalmouth: number;       // 0 ou 1
  isCreation: number;        // 0 ou 1
  isWing: number;            // 0 ou 1
  isHalfspace: number;       // 0 ou 1
  isFinalThird: number;      // 0 ou 1
  isMidThird: number;        // 0 ou 1
  isPress: number;           // 0 ou 1
  isBuildUp: number;         // 0 ou 1
  isRecovery: number;        // 0 ou 1
  isFreeKick: number;        // 0 ou 1
  hasPassTarget: number;     // 0 ou 1
  hasClearShot: number;      // 0 ou 1
  shootBias: number;         // bias de zona [-0.2, 0.4]
  crossBias: number;
  hasBoxTarget: number;      // 0 ou 1 — teammate na área
  carrierMatesNear: number;  // normalizado 0-1 (0=0 mates, 1=5+)
}

function buildInputs(
  aw: ReturnType<typeof getAwarenessContext>,
  z: ZoneInfo,
  ctx: DecisionContext,
  allPlayers: AwarePlayer[],
): UtilityInputs {
  const bias = biasFor(z);
  const hasBoxTarget = aw.availableTeammates.some((t) => isBox(t.zone)) ? 1 : 0;

  let carrierMatesNear = 0;
  if (ctx.ballCarrier) {
    const carrier = ctx.ballCarrier;
    const count = allPlayers.filter(
      (q) => q.team === carrier.team && q.playerId !== carrier.playerId
        && distance2D(q.x, q.y, carrier.x, carrier.y) < 6,
    ).length;
    carrierMatesNear = Math.min(1, count / 5);
  }

  return {
    distToGoalNorm: Math.min(1, aw.distanceToGoalM / 50),
    pressureLevel: aw.pressureLevel,
    hasBall: ctx.hasBall ? 1 : 0,
    isBox: isBox(z) ? 1 : 0,
    isSixYard: isSixYard(z) ? 1 : 0,
    isGoalmouth: isGoalmouth(z) ? 1 : 0,
    isCreation: isCreationZone(z) ? 1 : 0,
    isWing: isWing(z) ? 1 : 0,
    isHalfspace: isHalfspace(z) ? 1 : 0,
    isFinalThird: isFinalThird(z) ? 1 : 0,
    isMidThird: isMidThird(z) ? 1 : 0,
    isPress: isPressZone(z) ? 1 : 0,
    isBuildUp: isBuildUpZone(z) ? 1 : 0,
    isRecovery: isRecoveryZone(z) ? 1 : 0,
    isFreeKick: ctx.isFreeKick ? 1 : 0,
    hasPassTarget: aw.bestPassOption ? 1 : 0,
    hasClearShot: aw.hasClearShot ? 1 : 0,
    shootBias: bias.shoot ?? 0,
    crossBias: bias.cross ?? 0,
    hasBoxTarget,
    carrierMatesNear,
  };
}

// ── Candidate actions com axes ────────────────────────────────────

function buildCandidates(): CandidateAction[] {
  return [
    {
      id: 'SHOOT',
      axes: [
        { input: 'hasBall',        curve: 'linear',        m: 1,    k: 0,   b: 0,    c: 1 },
        { input: 'distToGoalNorm', curve: 'quadratic_down', m: 2,   k: 0,   b: 0,    c: 1 },
        { input: 'pressureLevel',  curve: 'quadratic_down', m: 1.5, k: 0,   b: 0.2,  c: 0.8 },
        { input: 'shootBias',      curve: 'linear',         m: 1,   k: -0.2, b: 0.5, c: 1 },
      ],
    },
    {
      id: 'SHOOT_BOX',
      axes: [
        { input: 'hasBall',   curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
        { input: 'isBox',     curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
        { input: 'pressureLevel', curve: 'quadratic_down', m: 1, k: 0, b: 0.3, c: 0.7 },
      ],
    },
    {
      id: 'SHOOT_SIXYARD',
      axes: [
        { input: 'hasBall',    curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
        { input: 'isSixYard',  curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
      ],
    },
    {
      id: 'SHOOT_GOALMOUTH',
      axes: [
        { input: 'hasBall',     curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
        { input: 'isGoalmouth', curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
      ],
    },
    {
      id: 'FREE_KICK_DIRECT',
      axes: [
        { input: 'isFreeKick',     curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
        { input: 'distToGoalNorm', curve: 'quadratic_down', m: 3, k: 0, b: 0, c: 1 },
      ],
    },
    {
      id: 'CROSS',
      axes: [
        { input: 'hasBall',      curve: 'linear', m: 1,   k: 0, b: 0,   c: 1 },
        { input: 'isWing',       curve: 'linear', m: 1,   k: 0, b: 0,   c: 1 },
        { input: 'isFinalThird', curve: 'linear', m: 1,   k: 0, b: 0,   c: 1 },
        { input: 'hasBoxTarget', curve: 'linear', m: 1,   k: 0, b: 0,   c: 1 },
        { input: 'crossBias',    curve: 'linear', m: 1,   k: -0.2, b: 0.5, c: 1 },
      ],
    },
    {
      id: 'PASS',
      axes: [
        { input: 'hasBall',       curve: 'linear', m: 1,   k: 0, b: 0,   c: 1 },
        { input: 'hasPassTarget', curve: 'linear', m: 1,   k: 0, b: 0,   c: 1 },
        { input: 'pressureLevel', curve: 'linear', m: -1,  k: 0, b: 1,   c: 1 },
      ],
    },
    {
      id: 'PRESS',
      axes: [
        { input: 'hasBall',          curve: 'linear',        m: -1,  k: 0, b: 1,   c: 1 },
        { input: 'isPress',          curve: 'linear',        m: 1,   k: 0, b: 0,   c: 1 },
        { input: 'carrierMatesNear', curve: 'quadratic_down', m: 2,  k: 0, b: 0.2, c: 0.8 },
      ],
    },
    {
      id: 'MID_BLOCK',
      axes: [
        { input: 'hasBall',          curve: 'linear', m: -1, k: 0, b: 1,   c: 1 },
        { input: 'isPress',          curve: 'linear', m: 1,  k: 0, b: 0,   c: 1 },
        { input: 'carrierMatesNear', curve: 'linear', m: 1,  k: 0.4, b: 0, c: 1 },
      ],
    },
    {
      id: 'CLEAR',
      axes: [
        { input: 'hasBall',       curve: 'linear', m: 1,  k: 0, b: 0,   c: 1 },
        { input: 'pressureLevel', curve: 'linear', m: 1,  k: 0.6, b: 0, c: 1 },
      ],
    },
    {
      id: 'RECOVER_POSITION',
      axes: [
        { input: 'hasBall',    curve: 'linear', m: -1, k: 0, b: 1, c: 1 },
        { input: 'isRecovery', curve: 'linear', m: 1,  k: 0, b: 0, c: 1 },
      ],
    },
    {
      id: 'HOLD',
      axes: [
        { input: 'hasBall', curve: 'linear', m: 1, k: 0, b: 0.1, c: 0.4 },
      ],
    },
  ];
}

// ── Utility → Decision mapper ─────────────────────────────────────

function utilityIdToAction(id: string): ActionKind {
  if (id === 'SHOOT' || id === 'SHOOT_BOX' || id === 'SHOOT_SIXYARD' || id === 'SHOOT_GOALMOUTH') return 'SHOOT';
  if (id === 'FREE_KICK_DIRECT') return 'FREE_KICK_DIRECT';
  if (id === 'CROSS') return 'CROSS';
  if (id === 'PASS') return 'PASS';
  if (id === 'PRESS') return 'PRESS';
  if (id === 'MID_BLOCK') return 'MID_BLOCK';
  if (id === 'CLEAR') return 'CLEAR';
  if (id === 'RECOVER_POSITION') return 'RECOVER_POSITION';
  return 'HOLD';
}

// ── Main entry point ──────────────────────────────────────────────

export function getBestAction(
  player: AwarePlayer,
  allPlayers: AwarePlayer[],
  side: 'home' | 'away',
  ctx: DecisionContext,
): Decision {
  const aw = getAwarenessContext(player, allPlayers, side);
  const z = aw.ballZoneInfo;
  const bias = biasFor(z);
  const inputs = buildInputs(aw, z, ctx, allPlayers) as unknown as Record<string, number>;
  const candidates = buildCandidates();

  // Score todos os candidatos
  const allScored = candidates.map((c) => scoreAction(c, inputs));

  // 1.4 — Inertia bonus para ação anterior
  const withInertia = applyInertiaBonus(allScored, ctx.previousActionId ?? null);

  // 1.5 — Hesitation: se top-2 muito próximos, fallback para HOLD
  if (shouldHesitate(withInertia)) {
    return { action: 'HOLD', confidence: 0.4, reason: `${z.macro} — hesitação (scores próximos)` };
  }

  // 1.6 — Sampling ponderado entre top-3 (não puro max — evita robótico)
  const best = sampleWeightedAction(candidates, inputs, Math.random, 3);
  const action = utilityIdToAction(best.id);

  // Resolve target para ações que precisam
  let target: AwarePlayer | undefined;
  if (action === 'CROSS' || action === 'PASS') {
    const targetInBox = aw.availableTeammates.find((t) => isBox(t.zone));
    target = targetInBox ?? aw.bestPassOption ?? undefined;
  }
  if (action === 'PRESS' && ctx.ballCarrier) {
    target = ctx.ballCarrier;
  }

  // shootBias para FREE_KICK_DIRECT na área
  const shootBias = (action === 'FREE_KICK_DIRECT' && isBox(z)) ? 0.3 : undefined;

  const reason = `${z.macro ?? 'field'} — utility[${best.id}] score=${best.score.toFixed(2)} bias=${(bias.shoot ?? 0).toFixed(2)}`;

  return {
    action,
    confidence: Math.max(0.1, Math.min(1, best.score)),
    reason,
    target,
    shootBias,
  };
}
