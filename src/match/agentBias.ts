/**
 * agentBias — converte AgentProfile rico em multiplicadores aplicáveis a
 * resolvers de chute/passe nos modos Quick / Classic / Liga Global.
 *
 * Ponto único de tradução `DNA do jogador → boost numérico`. Mantém todos os
 * motores honestos: jogador com profile rico (campeão tokenizado) recebe
 * boost determinístico; sem profile → bias neutro (1.0).
 *
 * NB: NÃO use isto na engine do `/match/legacy` (TacticalSimLoop), que tem
 * seu próprio caminho via `applyAgentBiasToScore`.
 */

import type { AgentProfile } from '@/agents/types';

/** Bias multiplicativo sobre `shotSkill01` na resolução de chute. */
export function agentShotBiasFromProfile(profile: AgentProfile | null | undefined): number {
  if (!profile) return 1.0;
  // Ponderação: composure crítica (30%) + confiança em finalização (50%) +
  // execução técnica (20%). Centra em 1.0 quando atributos = 50.
  const c = profile.criticalProfile.finishingConfidence ?? 50;
  const k = profile.criticalProfile.criticalComposure ?? 50;
  const t = profile.individualProfile.technicalExecution ?? 50;
  const composite = c * 0.5 + k * 0.3 + t * 0.2;
  // Mapeia 0..100 para 0.82..1.18 — máx +18% / mín -18%.
  return Math.max(0.82, Math.min(1.18, 0.82 + (composite / 100) * 0.36));
}

/** Bias multiplicativo sobre score de passe (visão + decisão sob pressão). */
export function agentPassBiasFromProfile(profile: AgentProfile | null | undefined): number {
  if (!profile) return 1.0;
  const v = profile.individualProfile.vision ?? 50;
  const d = profile.individualProfile.decisionUnderPressure ?? 50;
  const s = profile.teamProfile.supportCarrier ?? 50;
  const composite = v * 0.4 + d * 0.4 + s * 0.2;
  return Math.max(0.85, Math.min(1.15, 0.85 + (composite / 100) * 0.3));
}

/**
 * Bias defensivo (marcação/interceptação). Usado pelo Classic em duelos.
 */
export function agentDefenseBiasFromProfile(profile: AgentProfile | null | undefined): number {
  if (!profile) return 1.0;
  const p = profile.spatialProfile.defensivePositioning ?? 50;
  const c = profile.teamProfile.defensiveCover ?? 50;
  const d = profile.individualProfile.decisionUnderPressure ?? 50;
  const composite = p * 0.45 + c * 0.3 + d * 0.25;
  return Math.max(0.85, Math.min(1.15, 0.85 + (composite / 100) * 0.3));
}
