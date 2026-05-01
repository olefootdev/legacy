/**
 * Desespero contextual: zagueiros chutão cego aos 92min perdendo.
 * Retorna true se o agente deve entrar em modo desespero.
 */

import type { AgentSnapshot } from '@/simulation/InteractionResolver';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';

/** Minuto a partir do qual o desespero pode ser ativado */
const DESPERATION_MINUTE_THRESHOLD = 85;
/** Diferença de placar mínima para ativar (negativo = perdendo) */
const DESPERATION_SCORE_DIFF_THRESHOLD = -1;
/** Stamina mínima para ainda conseguir chutão (muito cansado = sem força) */
const MIN_STAMINA_FOR_CLEARANCE = 20;

/** Papéis que executam chutão em desespero */
const DESPERATION_ROLES = new Set(['zagueiro', 'lateral', 'volante', 'def', 'mid']);

/**
 * Verifica se o agente está em modo desespero.
 * Condições: minuto crítico, perdendo, papel defensivo/médio, stamina suficiente.
 */
export function isInDesperationMode(
  minute: number,
  scoreDiff: number,   // negativo = perdendo
  agentRole: string,
  stamina: number,     // 0-100
): boolean {
  if (minute < DESPERATION_MINUTE_THRESHOLD) return false;
  if (scoreDiff > DESPERATION_SCORE_DIFF_THRESHOLD) return false;
  if (stamina < MIN_STAMINA_FOR_CLEARANCE) return false;
  if (!DESPERATION_ROLES.has(agentRole)) return false;

  // Quanto mais tarde e mais perdendo, maior a probabilidade
  const minuteFactor = Math.min(1, (minute - DESPERATION_MINUTE_THRESHOLD) / 10);
  const scoreFactor = Math.min(1, Math.abs(scoreDiff) / 3);

  // Desespero aumenta com o tempo e com a desvantagem no placar
  return (minuteFactor * 0.6 + scoreFactor * 0.4) > 0.3;
}

/**
 * Em modo desespero: retorna ação de clearance cego (chutão para frente).
 * targetX/Z aponta para o terço ofensivo adversário com variância lateral.
 */
export function getDesperationClearance(
  carrier: AgentSnapshot,
  attackDir: 1 | -1,
  rng01: () => number,
): { targetX: number; targetZ: number; power: number } {
  // Chutão vai para o terço ofensivo — 70-90% do campo na direção de ataque
  const forwardFraction = 0.70 + rng01() * 0.20;
  const targetX = attackDir === 1
    ? FIELD_LENGTH * forwardFraction
    : FIELD_LENGTH * (1 - forwardFraction);

  // Variância lateral: pode ir para qualquer lado do campo
  const lateralBias = (rng01() - 0.5) * FIELD_WIDTH * 0.6;
  const targetZ = Math.max(2, Math.min(FIELD_WIDTH - 2, FIELD_WIDTH / 2 + lateralBias));

  // Potência alta — chutão com tudo
  const power = 0.75 + rng01() * 0.25;

  return { targetX, targetZ, power };
}
