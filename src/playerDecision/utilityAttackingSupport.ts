/**
 * utilityAttackingSupport.ts — FASE 1.3 (off-ball, dispatcher).
 *
 * Migra a CASCATA core de `decideAttackingSupport` (OffBallDecision.ts:233+)
 * para Utility AI multi-candidate via engine data-driven em `@/decisionAI/utility`.
 *
 * **Não migrado** (preservado intacto):
 *   - Phase 1 (cluster guard): `tripleCluster` early exit é precondição
 *     anti-swarm — fires regardless, não compete com positioning.
 *   - Phase 5 (role dispatch): `decideStrikerSupport`, `decideWingerSupport`,
 *     etc são fallbacks robustos com geometria role-específica complexa.
 *     Quando nenhum candidate utility passa do threshold, role dispatch toma
 *     decisão (preservação total de comportamento legacy).
 *
 * **Migrado** (10 candidates competindo por score):
 *   1. striker_infiltrate_box       — role=attack + box_entry/final_third + box not full
 *   2. winger_attack_depth          — slot pe/pd + box_entry/final_third + box not full
 *   3. fullback_overlap_box_entry   — slot le/ld + box_entry + box not full
 *   4. mid_attack_depth             — slot mei/am + box_entry/final_third + box not full
 *   5. anchor_to_slot               — shouldAnchorToSlot true
 *   6. structural_hold              — distToBall > 30
 *   7. sq_create_width              — collective sq.usefulness<0.35 + suggestion=create_width
 *   8. sq_attack_space              — sq + suggestion=attack_space
 *   9. sq_recycle                   — sq + suggestion=recycle
 *  10. sq_offer_line                — sq + suggestion=offer_line
 *
 * Saída:
 *   selectAttackingAction(...) → { actionId, score, fire } | null se nenhum
 *   passa do threshold → caller delega pra role dispatch (Phase 5).
 *
 * Resolve preserva geometria legacy. Telemetria observacional embutida.
 */

import type { CandidateAction } from '@/decisionAI/utility';
import { scoreAction, applyInertiaBonus } from '@/decisionAI/utility';
import type { ContextReading, DecisionContext, OffBallAction } from './types';
import type { SupportQuality } from './teamCollectiveState';
import { recordAttackingTelemetry } from './utilityAttackingTelemetry';
import { getLastAttackingAction, recordAttackingAction } from './agentActionMemory';

// ---------------------------------------------------------------------------
// CandidateActions (10) — data-driven JSON-serializable
// ---------------------------------------------------------------------------

/**
 * Padrão de score: cada candidate consome 2-4 inputs binários ou contínuos.
 * Inputs binários (role match, zone match) usam linear m=1 → score = input
 * direto. Inputs contínuos usam sigmoid/linear conforme a curva apropriada.
 *
 * Como `scoreAction` faz produto dos axes com compensation factor, basta
 * que UMA condição binária seja zero (ex: role≠attack pra striker_infiltrate)
 * pra zerar o candidate inteiro — role-mutex emergente sem if-else.
 */

// 1. STRIKER_INFILTRATE_BOX
const STRIKER_INFILTRATE_BOX: CandidateAction = {
  id: 'striker_infiltrate_box',
  axes: [
    { input: 'roleAttack',     curve: 'linear', m: 1, k: 0, b: 0,    c: 1 },
    { input: 'inFinalThird',   curve: 'linear', m: 1, k: 0, b: 0,    c: 1 },
    { input: 'boxNotFull',     curve: 'linear', m: 1, k: 0, b: 0,    c: 1 },
  ],
};

// 2. WINGER_ATTACK_DEPTH
const WINGER_ATTACK_DEPTH: CandidateAction = {
  id: 'winger_attack_depth',
  axes: [
    { input: 'slotWinger',     curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
    { input: 'inFinalThird',   curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
    { input: 'boxNotFull',     curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
  ],
};

// 3. FULLBACK_OVERLAP_BOX_ENTRY
// box_entry específico (não final_third) — é o trigger original para overlap forçado.
const FULLBACK_OVERLAP_BOX_ENTRY: CandidateAction = {
  id: 'fullback_overlap_box_entry',
  axes: [
    { input: 'slotFullback',   curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
    { input: 'inBoxEntry',     curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
    { input: 'boxNotFull',     curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
  ],
};

// 4. MID_ATTACK_DEPTH
const MID_ATTACK_DEPTH: CandidateAction = {
  id: 'mid_attack_depth',
  axes: [
    { input: 'slotMidAtt',     curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
    { input: 'inFinalThird',   curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
    { input: 'boxNotFull',     curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
  ],
};

// 5. ANCHOR_TO_SLOT
const ANCHOR_TO_SLOT: CandidateAction = {
  id: 'anchor_to_slot',
  axes: [
    { input: 'shouldAnchor',   curve: 'linear', m: 1, k: 0, b: 0,    c: 1 },
    // Pequeno tilt: prioridade alta entre não-box-invasion candidates.
    { input: 'notInFinalThird', curve: 'linear', m: 1, k: 0, b: 0.4, c: 0.6 },
  ],
};

// 6. STRUCTURAL_HOLD (far from ball)
const STRUCTURAL_HOLD: CandidateAction = {
  id: 'structural_hold',
  axes: [
    { input: 'farFromBall',    curve: 'linear', m: 1, k: 0, b: 0,    c: 1 },
    { input: 'notShouldAnchor', curve: 'linear', m: 1, k: 0, b: 0.5, c: 0.5 },
  ],
};

// 7-10. Collective Support Quality candidates
const SQ_CREATE_WIDTH: CandidateAction = {
  id: 'sq_create_width',
  axes: [
    { input: 'sqLowUsefulness',      curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
    { input: 'sqSuggestionWidth',    curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
  ],
};

const SQ_ATTACK_SPACE: CandidateAction = {
  id: 'sq_attack_space',
  axes: [
    { input: 'sqLowUsefulness',         curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
    { input: 'sqSuggestionAttackSpace', curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
  ],
};

const SQ_RECYCLE: CandidateAction = {
  id: 'sq_recycle',
  axes: [
    { input: 'sqLowUsefulness',     curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
    { input: 'sqSuggestionRecycle', curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
  ],
};

const SQ_OFFER_LINE: CandidateAction = {
  id: 'sq_offer_line',
  axes: [
    { input: 'sqLowUsefulness',   curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
    { input: 'sqSuggestionOffer', curve: 'linear', m: 1, k: 0, b: 0, c: 1 },
  ],
};

const ATTACKING_CANDIDATES: ReadonlyArray<CandidateAction> = [
  STRIKER_INFILTRATE_BOX,
  WINGER_ATTACK_DEPTH,
  FULLBACK_OVERLAP_BOX_ENTRY,
  MID_ATTACK_DEPTH,
  ANCHOR_TO_SLOT,
  STRUCTURAL_HOLD,
  SQ_CREATE_WIDTH,
  SQ_ATTACK_SPACE,
  SQ_RECYCLE,
  SQ_OFFER_LINE,
];

// ---------------------------------------------------------------------------
// Build inputs
// ---------------------------------------------------------------------------

export interface AttackingUtilityInputs {
  roleAttack: number;
  slotWinger: number;
  slotFullback: number;
  slotMidAtt: number;
  inFinalThird: number;
  inBoxEntry: number;
  notInFinalThird: number;
  boxNotFull: number;
  shouldAnchor: number;
  notShouldAnchor: number;
  farFromBall: number;
  sqLowUsefulness: number;
  sqSuggestionWidth: number;
  sqSuggestionAttackSpace: number;
  sqSuggestionRecycle: number;
  sqSuggestionOffer: number;
}

export function buildAttackingInputs(args: {
  role: string;
  slot: string;
  attackPhase: string | undefined;
  inBoxCount: number;
  shouldAnchor: boolean;
  distToBall: number;
  supportQuality: SupportQuality | null;
}): AttackingUtilityInputs {
  const slotL = args.slot.toLowerCase();
  const isWinger = slotL.includes('pe') || slotL.includes('pd');
  const isFullback = slotL.includes('le') || slotL.includes('ld');
  const isMidAtt = slotL.includes('mei') || slotL.includes('am');
  const inFinalThird = (args.attackPhase === 'box_entry' || args.attackPhase === 'final_third') ? 1 : 0;
  const inBoxEntry = args.attackPhase === 'box_entry' ? 1 : 0;
  const sq = args.supportQuality;
  const sqLow = sq && sq.usefulness < 0.35 && sq.suggestion !== 'stay' ? 1 : 0;

  return {
    roleAttack: args.role === 'attack' ? 1 : 0,
    slotWinger: isWinger ? 1 : 0,
    slotFullback: isFullback ? 1 : 0,
    slotMidAtt: isMidAtt ? 1 : 0,
    inFinalThird,
    inBoxEntry,
    notInFinalThird: 1 - inFinalThird,
    boxNotFull: args.inBoxCount < 4 ? 1 : 0,
    shouldAnchor: args.shouldAnchor ? 1 : 0,
    notShouldAnchor: args.shouldAnchor ? 0 : 1,
    farFromBall: args.distToBall > 30 ? 1 : 0,
    sqLowUsefulness: sqLow,
    sqSuggestionWidth: sqLow && sq?.suggestion === 'create_width' ? 1 : 0,
    sqSuggestionAttackSpace: sqLow && sq?.suggestion === 'attack_space' ? 1 : 0,
    sqSuggestionRecycle: sqLow && sq?.suggestion === 'recycle' ? 1 : 0,
    sqSuggestionOffer: sqLow && sq?.suggestion === 'offer_line' ? 1 : 0,
  };
}

// ---------------------------------------------------------------------------
// Public API — score + select
// ---------------------------------------------------------------------------

export type AttackingActionId =
  | 'striker_infiltrate_box'
  | 'winger_attack_depth'
  | 'fullback_overlap_box_entry'
  | 'mid_attack_depth'
  | 'anchor_to_slot'
  | 'structural_hold'
  | 'sq_create_width'
  | 'sq_attack_space'
  | 'sq_recycle'
  | 'sq_offer_line';

export interface AttackingUtilityVerdict {
  actionId: AttackingActionId | null;
  score: number;
  marginOverRunnerUp: number;
  /** Quando true, caller deve aplicar resolveAttackingUtilityAction. Quando false, cair pro role dispatch legacy. */
  fire: boolean;
  rawScores: Record<string, number>;
  allCandidates: { id: string; score: number }[];
}

/**
 * Threshold mínimo para utility tomar a decisão. Abaixo disso, sinaliza
 * `fire=false` e o caller delega pra Phase 5 (role dispatch legacy).
 *
 * Calibrado conservadoramente (0.4) — em situações sem fit claro
 * (role/zone misalignment, sem sq), nenhum candidate atinge e o role
 * dispatch atua. Comportamento legacy 100% preservado nesse path.
 */
export const ATTACKING_FIRE_THRESHOLD = 0.4;

export function selectAttackingAction(
  ctx: DecisionContext,
  inputs: AttackingUtilityInputs,
  threshold: number = ATTACKING_FIRE_THRESHOLD,
  previousActionId?: string | null,
): AttackingUtilityVerdict {
  const inputsRecord = inputs as unknown as Record<string, number>;
  const scored = ATTACKING_CANDIDATES.map((c) => scoreAction(c, inputsRecord));

  const adjusted = applyInertiaBonus(scored, previousActionId ?? null, 0.05);
  // Tie-breaker explícito: applyInertiaBonus tem cap em 1.0; quando 2+ candidates
  // tied em score=1.0, o bonus vira no-op. Prioriza previousActionId em empates
  // (delta < 1e-3) para anti-flickering robusto inclusive em saturação.
  const sorted = [...adjusted].sort((a, b) => {
    const delta = b.score - a.score;
    if (Math.abs(delta) < 1e-3 && previousActionId) {
      if (a.id === previousActionId && b.id !== previousActionId) return -1;
      if (b.id === previousActionId && a.id !== previousActionId) return 1;
    }
    return delta;
  });
  const winner = sorted[0]!;
  const runnerUp = sorted[1] ?? winner;

  const fire = winner.score >= threshold;
  return {
    actionId: fire ? (winner.id as AttackingActionId) : null,
    score: winner.score,
    marginOverRunnerUp: winner.score - runnerUp.score,
    fire,
    rawScores: winner.rawScores,
    allCandidates: sorted.map((s) => ({ id: s.id, score: s.score })),
  };
}

// ---------------------------------------------------------------------------
// Resolve to concrete OffBallAction (preserves legacy geometry)
// ---------------------------------------------------------------------------

const FIELD_LENGTH = 100;
const FIELD_WIDTH = 100;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface ResolveContext {
  ctx: DecisionContext;
  reading: ContextReading;
  pick01: (ctx: DecisionContext) => number;
  findReceptionZone: (ctx: DecisionContext) => { x: number; z: number };
}

export function resolveAttackingUtilityAction(
  actionId: AttackingActionId,
  rc: ResolveContext,
): OffBallAction {
  const { ctx, pick01 } = rc;
  const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
  const slotL = (ctx.self.slotId ?? '').toLowerCase();

  switch (actionId) {
    case 'striker_infiltrate_box': {
      const lateralOffset = ctx.self.z < FIELD_WIDTH / 2 ? -1 : 1;
      return {
        type: 'infiltrate',
        targetX: clamp(goalX - ctx.attackDir * (5 + pick01(ctx) * 5), 3, FIELD_LENGTH - 3),
        targetZ: clamp(FIELD_WIDTH / 2 + lateralOffset * (3 + pick01(ctx) * 6), 8, FIELD_WIDTH - 8),
      };
    }
    case 'winger_attack_depth': {
      const isLeft = slotL.includes('pe') || ctx.self.z < FIELD_WIDTH / 2;
      const wideZ = isLeft ? 6 + pick01(ctx) * 6 : FIELD_WIDTH - 6 - pick01(ctx) * 6;
      return {
        type: 'attack_depth',
        targetX: clamp(goalX - ctx.attackDir * (4 + pick01(ctx) * 6), 3, FIELD_LENGTH - 3),
        targetZ: wideZ,
      };
    }
    case 'fullback_overlap_box_entry': {
      const isLeft = slotL.includes('le') || ctx.self.z < FIELD_WIDTH / 2;
      return {
        type: 'overlap_run',
        targetX: clamp(goalX - ctx.attackDir * (10 + pick01(ctx) * 8), 8, FIELD_LENGTH - 8),
        targetZ: isLeft ? 2 + pick01(ctx) * 4 : FIELD_WIDTH - 2 - pick01(ctx) * 4,
      };
    }
    case 'mid_attack_depth': {
      return {
        type: 'attack_depth',
        targetX: clamp(goalX - ctx.attackDir * (14 + pick01(ctx) * 6), 5, FIELD_LENGTH - 5),
        targetZ: clamp(FIELD_WIDTH / 2 + (pick01(ctx) - 0.5) * 12, 10, FIELD_WIDTH - 10),
      };
    }
    case 'anchor_to_slot': {
      // Caller deve aplicar enforceSpacing externamente — aqui retornamos o slot bruto.
      return { type: 'move_to_slot', targetX: ctx.slotX, targetZ: ctx.slotZ };
    }
    case 'structural_hold': {
      const compressedX = lerp(ctx.slotX, ctx.ballX, 0.08);
      return { type: 'move_to_slot', targetX: compressedX, targetZ: ctx.slotZ };
    }
    case 'sq_create_width': {
      const wideDir = ctx.self.z < FIELD_WIDTH / 2 ? -1 : 1;
      const wz = clamp(ctx.self.z + wideDir * (10 + pick01(ctx) * 6), 4, FIELD_WIDTH - 4);
      return {
        type: 'open_width',
        targetX: clamp(ctx.self.x + ctx.attackDir * 3, 5, FIELD_LENGTH - 5),
        targetZ: wz,
      };
    }
    case 'sq_attack_space': {
      return {
        type: 'attack_depth',
        targetX: clamp(ctx.self.x + ctx.attackDir * (8 + pick01(ctx) * 5), 5, FIELD_LENGTH - 5),
        targetZ: clamp(ctx.self.z + (pick01(ctx) - 0.5) * 8, 6, FIELD_WIDTH - 6),
      };
    }
    case 'sq_recycle': {
      return {
        type: 'move_to_slot',
        targetX: clamp(ctx.slotX - ctx.attackDir * 4, 5, FIELD_LENGTH - 5),
        targetZ: ctx.slotZ,
      };
    }
    case 'sq_offer_line': {
      const rz = rc.findReceptionZone(ctx);
      return {
        type: 'offer_short_line',
        targetX: rz.x,
        targetZ: rz.z,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Combined entry point
// ---------------------------------------------------------------------------

export function evaluateAttackingUtility(
  ctx: DecisionContext,
  reading: ContextReading,
  inputs: AttackingUtilityInputs,
  resolveCtx: ResolveContext,
  previousActionId?: string | null,
): { action: OffBallAction | null; verdict: AttackingUtilityVerdict } {
  // Per-agent action memory (anti-flickering via inertia bonus).
  const memoryPrev = previousActionId ?? getLastAttackingAction(ctx.self.id);
  const verdict = selectAttackingAction(ctx, inputs, ATTACKING_FIRE_THRESHOLD, memoryPrev);
  if (verdict.fire && verdict.actionId) {
    recordAttackingAction(ctx.self.id, verdict.actionId);
  }

  // Telemetria observacional (DEV-only).
  recordAttackingTelemetry({
    agentId: ctx.self.id,
    slot: ctx.self.slotId,
    role: ctx.self.role,
    attackPhase: ctx.attackPhase,
    inputs,
    actionId: verdict.actionId,
    score: verdict.score,
    margin: verdict.marginOverRunnerUp,
    fire: verdict.fire,
    candidates: verdict.allCandidates,
    minute: reading.minute,
  });

  if (!verdict.fire || !verdict.actionId) {
    return { action: null, verdict };
  }

  const action = resolveAttackingUtilityAction(verdict.actionId, resolveCtx);
  return { action, verdict };
}
