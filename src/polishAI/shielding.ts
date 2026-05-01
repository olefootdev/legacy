/**
 * Proteção de bola (Shielding): em vez de perder, atacante usa corpo.
 * Retorna true se o agente deve entrar em modo shield.
 */

import type { AgentSnapshot } from '@/simulation/InteractionResolver';

/** Raio padrão de shielding (metros) */
const DEFAULT_SHIELD_RADIUS_M = 0.8;

/**
 * Decide se o portador deve entrar em modo shield.
 * Leva em conta drible do portador vs marcação do oponente,
 * com RNG para variância realista.
 */
export function shouldShieldBall(
  carrier: AgentSnapshot,
  nearestOpponent: AgentSnapshot,
  carrierDrible: number,   // 0-100
  opponentMarcacao: number, // 0-100
  rng01: () => number,
): boolean {
  // Distância entre portador e oponente
  const dist = Math.hypot(
    carrier.x - nearestOpponent.x,
    carrier.z - nearestOpponent.z,
  );

  // Só faz sentido shieldar se oponente está muito próximo (< 2m)
  if (dist > 2.0) return false;

  // Probabilidade base: drible alto vs marcação alta
  const dribleAdv = (carrierDrible - opponentMarcacao) / 100;
  // Base de 0.35 — portador sempre tenta proteger quando pressionado
  const prob = Math.max(0.1, Math.min(0.85, 0.35 + dribleAdv * 0.5));

  return rng01() < prob;
}

/**
 * Computa posição de shielding: carrier se posiciona entre bola e oponente.
 * Retorna offset { dx, dz } a aplicar na posição do carrier.
 *
 * O carrier se move ligeiramente na direção oposta ao oponente,
 * interpondo o corpo entre a bola e o defensor.
 */
export function computeShieldPosition(
  carrierX: number,
  carrierZ: number,
  opponentX: number,
  opponentZ: number,
  shieldRadius: number = DEFAULT_SHIELD_RADIUS_M,
): { dx: number; dz: number } {
  const dx = carrierX - opponentX;
  const dz = carrierZ - opponentZ;
  const dist = Math.hypot(dx, dz);

  if (dist < 0.001) {
    // Oponente exatamente na mesma posição — offset lateral padrão
    return { dx: 0, dz: shieldRadius };
  }

  // Normaliza e escala pelo raio de shielding
  const nx = dx / dist;
  const nz = dz / dist;

  return {
    dx: nx * shieldRadius,
    dz: nz * shieldRadius,
  };
}
