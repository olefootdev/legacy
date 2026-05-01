/**
 * utilityBridge.ts
 *
 * Expõe helpers de Utility AI (inertia + hesitation) para uso em
 * OnBallDecision.ts e OffBallDecision.ts sem reescrever a lógica existente.
 *
 * Padrão de uso:
 *   import { applyUtilityInertia, applyUtilityHesitation } from './utilityBridge';
 *
 *   // No final de decideOnBall / decideOffBall:
 *   const finalAction = applyUtilityInertia(chosenAction, previousActionId);
 *   const hesitating = applyUtilityHesitation(topCandidateScores);
 */

import {
  applyInertiaBonus,
  shouldHesitate,
  scoreAction,
  sampleWeightedAction,
} from '@/decisionAI/utility';
import type { CandidateAction, UtilityResult } from '@/decisionAI/utility';

export type { CandidateAction, UtilityResult };

// ── Inertia ───────────────────────────────────────────────────────────────────

/**
 * Dado um array de UtilityResult já calculados, aplica o bônus de inércia
 * para a ação anterior e retorna o array atualizado.
 *
 * Uso típico: chamar após calcular scores, antes de selecionar o melhor.
 */
export function applyUtilityInertia(
  results: UtilityResult[],
  previousActionId: string | null,
  bonusFraction = 0.07,
): UtilityResult[] {
  return applyInertiaBonus(results, previousActionId, bonusFraction);
}

// ── Hesitation ────────────────────────────────────────────────────────────────

/**
 * Retorna true se os dois melhores candidatos estão muito próximos em score
 * (delta < deltaThreshold). O caller pode usar isso para introduzir um delay
 * de decisão ou escolher uma ação neutra de fallback.
 */
export function applyUtilityHesitation(
  results: UtilityResult[],
  deltaThreshold = 0.05,
): boolean {
  return shouldHesitate(results, deltaThreshold);
}

// ── Score helpers ─────────────────────────────────────────────────────────────

/**
 * Pontua uma única ação candidata contra um mapa de inputs.
 * Wrapper fino sobre scoreAction para evitar import direto do engine.
 */
export function scoreCandidate(
  action: CandidateAction,
  inputs: Record<string, number>,
): UtilityResult {
  return scoreAction(action, inputs);
}

/**
 * Seleciona entre os topN candidatos com sampling ponderado por score.
 * Útil para adicionar variabilidade sem perder qualidade de decisão.
 */
export function sampleFromCandidates(
  candidates: CandidateAction[],
  inputs: Record<string, number>,
  rng01: () => number,
  topN = 3,
): UtilityResult {
  return sampleWeightedAction(candidates, inputs, rng01, topN);
}

// ── Convenience: score rápido de ação nomeada ─────────────────────────────────

/**
 * Cria um UtilityResult simples a partir de um id e score direto.
 * Útil para converter scores legados (if-else) em UtilityResult para
 * passar por applyUtilityInertia / applyUtilityHesitation.
 */
export function makeResult(id: string, score: number): UtilityResult {
  return { id, score, rawScores: {} };
}

/**
 * Seleciona o melhor UtilityResult de um array (maior score).
 */
export function pickBest(results: UtilityResult[]): UtilityResult | null {
  if (results.length === 0) return null;
  return results.reduce((best, r) => (r.score > best.score ? r : best), results[0]);
}
