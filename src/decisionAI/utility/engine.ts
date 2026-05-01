import type { CandidateAction, UtilityResult } from './types';
import { evaluateCurve } from './curves';

/**
 * Score de uma ação = produto de todos os axes (não soma).
 * Outliers vetam: um axis com score 0 zera a ação inteira.
 *
 * Compensation factor (Dave Mark):
 *   modFactor = 1 - (1 / N)
 *   final = raw ^ (1 - (1 - raw) * (modFactor / N))
 *
 * Isso suaviza a penalidade do produto quando N é grande.
 */
export function scoreAction(
  action: CandidateAction,
  inputs: Record<string, number>,
): UtilityResult {
  const rawScores: Record<string, number> = {};
  const N = action.axes.length;

  if (N === 0) {
    return { id: action.id, score: 0, rawScores };
  }

  let product = 1;
  for (const axis of action.axes) {
    const x = inputs[axis.input] ?? 0;
    const raw = evaluateCurve(axis.curve, x, axis.m, axis.k, axis.b, axis.c);
    const weighted = axis.weight !== undefined ? raw * axis.weight : raw;
    const clamped = weighted < 0 ? 0 : weighted > 1 ? 1 : weighted;
    rawScores[axis.input] = clamped;
    product *= clamped;
  }

  // Compensation factor
  const modFactor = 1 - 1 / N;
  const score = Math.pow(product, 1 - (1 - product) * (modFactor / N));

  return { id: action.id, score, rawScores };
}

export function selectBestAction(
  candidates: CandidateAction[],
  inputs: Record<string, number>,
): UtilityResult {
  if (candidates.length === 0) {
    return { id: '', score: 0, rawScores: {} };
  }

  let best: UtilityResult = { id: '', score: -1, rawScores: {} };
  for (const candidate of candidates) {
    const result = scoreAction(candidate, inputs);
    if (result.score > best.score) {
      best = result;
    }
  }
  return best;
}

/**
 * 1.6 — Dual-utility: top-N com sampling por peso (não só max).
 * Seleciona entre os topN candidatos com probabilidade proporcional ao score.
 */
export function sampleWeightedAction(
  candidates: CandidateAction[],
  inputs: Record<string, number>,
  rng01: () => number,
  topN = 3,
): UtilityResult {
  if (candidates.length === 0) {
    return { id: '', score: 0, rawScores: {} };
  }

  const scored = candidates
    .map((c) => scoreAction(c, inputs))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  const total = scored.reduce((sum, r) => sum + r.score, 0);
  if (total <= 0) {
    return scored[0];
  }

  const roll = rng01() * total;
  let cumulative = 0;
  for (const result of scored) {
    cumulative += result.score;
    if (roll <= cumulative) {
      return result;
    }
  }
  return scored[scored.length - 1];
}

/**
 * 1.4 — Inertia bonus: aplica +bonusFraction ao score da ação anterior.
 * Evita flip-flopping entre ações de score similar.
 */
export function applyInertiaBonus(
  results: UtilityResult[],
  previousActionId: string | null,
  bonusFraction = 0.07,
): UtilityResult[] {
  if (previousActionId === null) return results;
  return results.map((r) => {
    if (r.id === previousActionId) {
      const boosted = Math.min(1, r.score + r.score * bonusFraction);
      return { ...r, score: boosted };
    }
    return r;
  });
}

/**
 * 1.5 — Hesitation: retorna true se top-2 têm delta < threshold.
 * Quando true, o caller pode introduzir um delay ou fallback neutro.
 */
export function shouldHesitate(
  results: UtilityResult[],
  deltaThreshold = 0.05,
): boolean {
  if (results.length < 2) return false;
  const sorted = [...results].sort((a, b) => b.score - a.score);
  return sorted[0].score - sorted[1].score < deltaThreshold;
}
