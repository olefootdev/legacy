/**
 * utilityFullbackSupport.ts — FASE 1.3 (off-ball extension).
 *
 * Migra a cascata de `decideFullbackSupport` (OffBallDecision.ts) para
 * Utility AI multi-candidate usando o engine data-driven em
 * `@/decisionAI/utility`.
 *
 * Cascata legacy resumida:
 *   if (ballOnMySide && attackPhase) {
 *     if (workRate>0.55 && overlapRoll>X) → overlap_run
 *     else → offer_short_line
 *   } else if (ballOpposite) → defensive_cover
 *   else (ballCentral) → open_width
 *
 * Migração: 4 CandidateAction competindo por score. Cada axis pontua a
 * APROPRIAÇÃO da ação dado o contexto. selectBestAction → resolveResult.
 *
 * Resolve preserva geometria original (zonas de cruzamento, byline, etc).
 *
 * Saída:
 *   shouldFireFullbackUtility(...) → { actionId, score, fire } | null
 *   resolveFullbackUtilityAction(...) → OffBallAction
 */

import type { CandidateAction } from '@/decisionAI/utility';
import { scoreAction, applyInertiaBonus } from '@/decisionAI/utility';
import type { ContextReading, DecisionContext, OffBallAction, BallSector, PlayerProfile } from './types';
import { recordFullbackTelemetry } from './utilityFullbackTelemetry';
import { getLastFullbackAction, recordFullbackAction } from './agentActionMemory';

// ---------------------------------------------------------------------------
// CandidateActions (data-driven) — 4 actions competing
// ---------------------------------------------------------------------------

/**
 * overlap_run: corrida pra linha de fundo / zona de cruzamento.
 *   - alta quando: bola do meu lado + fase ofensiva + workRate alto + overlap roll alto
 *   - baixa quando: bola do outro lado, fase defensiva, workRate baixo
 */
const OVERLAP_RUN: CandidateAction = {
  id: 'overlap_run',
  axes: [
    { input: 'ballSideMatch',  curve: 'linear',  m: 1, k: 0,    b: 0,   c: 1 },
    { input: 'inAttackPhase',  curve: 'linear',  m: 1, k: 0,    b: 0,   c: 1 },
    { input: 'workRate',       curve: 'sigmoid', m: 8, k: 0.55, b: 0,   c: 1 },
    { input: 'overlapRoll',    curve: 'linear',  m: 1, k: 0,    b: 0.2, c: 0.8 },
  ],
};

/**
 * offer_short_line: oferece passe curto ao portador no próprio corredor.
 *   - alta quando: bola do meu lado + fase ofensiva + workRate baixo (não vai overlap)
 *   - opção de transição quando overlap_run pontua mediano
 */
const OFFER_SHORT_LINE: CandidateAction = {
  id: 'offer_short_line',
  axes: [
    { input: 'ballSideMatch',     curve: 'linear',  m: 1, k: 0,    b: 0,    c: 1 },
    { input: 'inAttackPhase',     curve: 'linear',  m: 1, k: 0,    b: 0.3,  c: 0.7 },
    { input: 'workRateInverted',  curve: 'sigmoid', m: 6, k: 0.45, b: 0.2,  c: 0.8 },
  ],
};

/**
 * defensive_cover: encaixa pra dentro pra cobrir transição.
 *   - alta quando: bola no lado oposto (não-centro)
 */
const DEFENSIVE_COVER: CandidateAction = {
  id: 'defensive_cover',
  axes: [
    { input: 'ballOpposite',  curve: 'linear', m: 1, k: 0,   b: 0,   c: 1 },
    { input: 'defenseScore',  curve: 'linear', m: 1, k: 0,   b: 0.3, c: 0.7 },
  ],
};

/**
 * open_width: mantém amplitude no próprio corredor.
 *   - alta quando: bola central (default fallback)
 *   - baixa em outros estados
 */
const OPEN_WIDTH: CandidateAction = {
  id: 'open_width',
  axes: [
    { input: 'ballCentral',  curve: 'linear', m: 1, k: 0, b: 0,   c: 1 },
    { input: 'inAttackPhase', curve: 'linear', m: 1, k: 0, b: 0.4, c: 0.6 },
  ],
};

const FULLBACK_CANDIDATES: ReadonlyArray<CandidateAction> = [
  OVERLAP_RUN,
  OFFER_SHORT_LINE,
  DEFENSIVE_COVER,
  OPEN_WIDTH,
];

// ---------------------------------------------------------------------------
// Build inputs
// ---------------------------------------------------------------------------

export interface FullbackUtilityInputs {
  ballSideMatch: number;
  ballOpposite: number;
  ballCentral: number;
  inAttackPhase: number;
  workRate: number;
  workRateInverted: number;
  overlapRoll: number;
  defenseScore: number;
}

export function buildFullbackInputs(
  reading: ContextReading,
  profile: PlayerProfile,
  sector: BallSector,
  mySector: BallSector,
  overlapRoll01: number,
): FullbackUtilityInputs {
  const ballSideMatch = sector === mySector ? 1 : 0;
  const ballOpposite = (sector !== mySector && sector !== 'center') ? 1 : 0;
  const ballCentral = sector === 'center' ? 1 : 0;
  const inAttackPhase = (reading.teamPhase === 'attack' || reading.teamPhase === 'progression') ? 1 : 0;
  const workRate = Math.max(0, Math.min(1, profile.workRate ?? 0.5));
  const workRateInverted = 1 - workRate;
  const overlapRoll = Math.max(0, Math.min(1, overlapRoll01));
  // Defensive score: low when team in attack, high when team in transition_def.
  // (TeamPhase enum: 'buildup' | 'progression' | 'attack' | 'transition_def' | 'transition_att')
  const defenseScore = reading.teamPhase === 'transition_def' ? 1 : 0.3;

  return {
    ballSideMatch,
    ballOpposite,
    ballCentral,
    inAttackPhase,
    workRate,
    workRateInverted,
    overlapRoll,
    defenseScore,
  };
}

// ---------------------------------------------------------------------------
// Public API — score + select best
// ---------------------------------------------------------------------------

export type FullbackActionId = 'overlap_run' | 'offer_short_line' | 'defensive_cover' | 'open_width';

export interface FullbackUtilityVerdict {
  actionId: FullbackActionId;
  score: number;
  /** Top-1 score - top-2 score (margin de confiança). */
  marginOverRunnerUp: number;
  rawScores: Record<string, number>;
  allCandidates: { id: string; score: number }[];
}

export function selectFullbackAction(
  ctx: DecisionContext,
  inputs: FullbackUtilityInputs,
  previousActionId?: string | null,
): FullbackUtilityVerdict {
  const inputsRecord = inputs as unknown as Record<string, number>;
  const scored = FULLBACK_CANDIDATES.map((c) => scoreAction(c, inputsRecord));

  // Inertia bonus: small boost for previous action (anti-flickering).
  const adjusted = applyInertiaBonus(scored, previousActionId ?? null, 0.05);
  // Tie-breaker robusto (cap em 1.0 absorve o bonus quando candidates saturam).
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

  return {
    actionId: winner.id as FullbackActionId,
    score: winner.score,
    marginOverRunnerUp: winner.score - runnerUp.score,
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

export function resolveFullbackUtilityAction(
  actionId: FullbackActionId,
  ctx: DecisionContext,
  reading: ContextReading,
  isLeft: boolean,
  pick01: (ctx: DecisionContext) => number,
): OffBallAction {
  switch (actionId) {
    case 'overlap_run': {
      const goalX = ctx.attackDir === 1 ? FIELD_LENGTH : 0;
      const targetX = reading.teamPhase === 'attack'
        ? clamp(goalX - ctx.attackDir * (8 + pick01(ctx) * 8), 8, FIELD_LENGTH - 8)
        : clamp(ctx.ballX + ctx.attackDir * 18, 10, FIELD_LENGTH - 8);
      return {
        type: 'overlap_run',
        targetX,
        targetZ: isLeft ? 2 + pick01(ctx) * 5 : FIELD_WIDTH - 2 - pick01(ctx) * 5,
      };
    }
    case 'offer_short_line': {
      return {
        type: 'offer_short_line',
        targetX: clamp(ctx.ballX - ctx.attackDir * 3, 3, FIELD_LENGTH - 3),
        targetZ: ctx.self.z,
      };
    }
    case 'defensive_cover': {
      return {
        type: 'defensive_cover',
        targetX: clamp(ctx.slotX + ctx.attackDir * 3, 5, FIELD_LENGTH - 5),
        targetZ: lerp(ctx.slotZ, FIELD_WIDTH / 2, 0.3),
      };
    }
    case 'open_width': {
      const wideTarget = isLeft
        ? 5 + pick01(ctx) * 5
        : FIELD_WIDTH - 5 - pick01(ctx) * 5;
      return {
        type: 'open_width',
        targetX: clamp(ctx.ballX + ctx.attackDir * (4 + pick01(ctx) * 5), 5, FIELD_LENGTH - 5),
        targetZ: wideTarget,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Combined entry-point — verdict + resolution + telemetry
// ---------------------------------------------------------------------------

/**
 * Threshold mínimo para a ação top dominar.
 * Quando margem entre top-1 e top-2 < threshold, comportamento é menos
 * estável — caller pode aplicar fallback ou aceitar com ressalva.
 *
 * Calibrado conservadoramente (0.05) — coberta pelo inertia bonus de 0.05.
 */
export const FULLBACK_MIN_MARGIN = 0.05;

export function shouldFireFullbackUtility(
  ctx: DecisionContext,
  reading: ContextReading,
  inputs: FullbackUtilityInputs,
  isLeft: boolean,
  pick01: (ctx: DecisionContext) => number,
  previousActionId?: string | null,
): { action: OffBallAction; verdict: FullbackUtilityVerdict } {
  // Per-agent action memory (anti-flickering via inertia bonus).
  const memoryPrev = previousActionId ?? getLastFullbackAction(ctx.self.id);
  const verdict = selectFullbackAction(ctx, inputs, memoryPrev);
  const action = resolveFullbackUtilityAction(verdict.actionId, ctx, reading, isLeft, pick01);
  recordFullbackAction(ctx.self.id, verdict.actionId);

  // Telemetria observacional (DEV-only, no-op em prod).
  recordFullbackTelemetry({
    agentId: ctx.self.id,
    slot: ctx.self.slotId,
    isLeft,
    sector: ctx.ballSector,
    teamPhase: reading.teamPhase,
    inputs,
    actionId: verdict.actionId,
    score: verdict.score,
    margin: verdict.marginOverRunnerUp,
    candidates: verdict.allCandidates,
    minute: reading.minute,
  });

  return { action, verdict };
}
