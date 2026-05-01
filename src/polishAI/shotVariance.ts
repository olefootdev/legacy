/**
 * Variância em chutes "100% gol": RNG 1/1000 isola na bandeirinha.
 * Fator humano inexplicável — preserva realismo.
 */

/** Probabilidade padrão do "milagre negativo" (1/1000) */
const DEFAULT_MIRACLE_MISS_PROB = 0.001;

export interface ShotVarianceResult {
  /** xG ajustado após variância */
  adjustedXG: number;
  /** true se o "milagre negativo" foi ativado */
  miracleMiss: boolean;
  reason?: string;
}

/**
 * Aplica variância humana ao xG base.
 *
 * Lógica:
 * 1. Se xG > 0.85 (chance clara), há 1/1000 de chance de "milagre negativo":
 *    o xG cai para 0.02 (quase impossível de converter).
 * 2. Fora isso, aplica pequena variância gaussiana aproximada (±5%) para
 *    evitar que xG seja sempre determinístico.
 */
export function applyShotVariance(
  baseXG: number,
  rng01: () => number,
  miracleMissProb: number = DEFAULT_MIRACLE_MISS_PROB,
): ShotVarianceResult {
  // Milagre negativo: só ativa em chances claras (xG alto)
  if (baseXG > 0.85 && rng01() < miracleMissProb) {
    return {
      adjustedXG: 0.02,
      miracleMiss: true,
      reason: 'miracle_miss: chance clara desperdiçada (fator humano inexplicável)',
    };
  }

  // Variância normal: pequeno ruído ±5% para realismo
  // Usa dois draws RNG para aproximar distribuição normal (Box-Muller simplificado)
  const u1 = rng01();
  const u2 = rng01();
  // Aproximação de normal com média 0 e desvio ~0.025
  const noise = (u1 + u2 - 1) * 0.05;

  const adjustedXG = Math.max(0.01, Math.min(0.99, baseXG + noise));

  return {
    adjustedXG,
    miracleMiss: false,
  };
}
