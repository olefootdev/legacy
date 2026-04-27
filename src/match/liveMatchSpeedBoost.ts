/**
 * Live Match Speed Boost — Aumenta dinamismo das ações SEM alterar tempo da partida.
 *
 * OBJETIVO: Mais eventos, mais movimento, mais emoção no mesmo espaço de tempo.
 *
 * ESTRATÉGIA:
 * - Jogadores se movem mais rápido (corrida, caminhada, sprint)
 * - Bola viaja mais rápido (passes, chutes, cruzamentos)
 * - Decisões mais rápidas (menos tempo de deliberação)
 * - Transições mais rápidas (recuperação de bola → ataque)
 * - Animações mais rápidas (tokens no canvas)
 *
 * IMPORTANTE: O relógio da partida NÃO muda — apenas a velocidade das ações.
 */

// ============================================================================
// MULTIPLICADORES GLOBAIS (ajustar aqui para calibrar toda a experiência)
// ============================================================================

/**
 * Multiplicador MASTER de velocidade de movimento dos jogadores.
 * 1.0 = velocidade original
 * 1.5 = 50% mais rápido
 * 2.0 = 2x mais rápido
 *
 * RECOMENDADO: 1.6 - 1.8 (sweet spot entre realismo e emoção)
 */
export const SPEED_BOOST_PLAYER_MOVEMENT = 1.7;

/**
 * Multiplicador de velocidade da bola (passes, chutes, cruzamentos).
 * RECOMENDADO: 1.4 - 1.6 (bola mais rápida = menos tempo para interceptar)
 */
export const SPEED_BOOST_BALL_VELOCITY = 1.5;

/**
 * Multiplicador de velocidade de deliberação (tempo de pensar antes de agir).
 * Valores MENORES = decisões mais rápidas.
 * 0.5 = metade do tempo de deliberação
 * 0.3 = 70% mais rápido
 *
 * RECOMENDADO: 0.4 - 0.6 (decisões mais instintivas)
 */
export const SPEED_BOOST_DELIBERATION_MULT = 0.5;

/**
 * Multiplicador de velocidade de animação dos tokens no canvas 2D.
 * RECOMENDADO: 1.3 - 1.5 (movimento visual mais fluido)
 */
export const SPEED_BOOST_TOKEN_ANIMATION = 1.4;

/**
 * Multiplicador de velocidade de recuperação após tackle/desarme.
 * Valores MENORES = recuperação mais rápida.
 * RECOMENDADO: 0.6 - 0.8 (transições mais rápidas)
 */
export const SPEED_BOOST_RECOVERY_MULT = 0.7;

/**
 * Multiplicador de intervalo entre decisões (DECISION_TICK_MS).
 * Valores MENORES = mais decisões por segundo.
 * RECOMENDADO: 0.7 - 0.85 (mais reativo)
 */
export const SPEED_BOOST_DECISION_TICK_MULT = 0.75;

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Aplica speed boost a velocidade máxima de jogador (Yuka Vehicle.maxSpeed).
 * Usa atributos do jogador para manter diferenciação (rápidos ficam ainda mais rápidos).
 */
export function applySpeedBoostToPlayerMaxSpeed(baseMaxSpeed: number, velocidadeAttr: number = 50): number {
  // Jogadores mais rápidos ganham boost maior (mantém diferenciação)
  const attrBonus = 1 + ((velocidadeAttr - 50) / 100) * 0.3;
  return baseMaxSpeed * SPEED_BOOST_PLAYER_MOVEMENT * attrBonus;
}

/**
 * Aplica speed boost a velocidade da bola (BallSystem).
 */
export function applySpeedBoostToBallVelocity(baseVelocity: number): number {
  return baseVelocity * SPEED_BOOST_BALL_VELOCITY;
}

/**
 * Aplica speed boost a tempo de deliberação (reduz tempo de pensar).
 */
export function applySpeedBoostToDeliberation(baseDeliberationSec: number): number {
  return baseDeliberationSec * SPEED_BOOST_DELIBERATION_MULT;
}

/**
 * Aplica speed boost a intervalo de decisão (DECISION_TICK_MS).
 */
export function applySpeedBoostToDecisionTick(baseTickMs: number): number {
  return baseTickMs * SPEED_BOOST_DECISION_TICK_MULT;
}

/**
 * Aplica speed boost a velocidade de animação dos tokens (lerp factor).
 */
export function applySpeedBoostToTokenLerp(baseLerp: number): number {
  return Math.min(0.95, baseLerp * SPEED_BOOST_TOKEN_ANIMATION);
}

/**
 * Aplica speed boost a tempo de recuperação após tackle.
 */
export function applySpeedBoostToRecovery(baseRecoverySec: number): number {
  return baseRecoverySec * SPEED_BOOST_RECOVERY_MULT;
}

// ============================================================================
// PRESETS (para testes rápidos)
// ============================================================================

export type SpeedBoostPreset = 'normal' | 'dynamic' | 'arcade' | 'ultra';

export interface SpeedBoostConfig {
  playerMovement: number;
  ballVelocity: number;
  deliberation: number;
  tokenAnimation: number;
  recovery: number;
  decisionTick: number;
}

export const SPEED_BOOST_PRESETS: Record<SpeedBoostPreset, SpeedBoostConfig> = {
  normal: {
    playerMovement: 1.0,
    ballVelocity: 1.0,
    deliberation: 1.0,
    tokenAnimation: 1.0,
    recovery: 1.0,
    decisionTick: 1.0,
  },
  dynamic: {
    playerMovement: 1.7,
    ballVelocity: 1.5,
    deliberation: 0.5,
    tokenAnimation: 1.4,
    recovery: 0.7,
    decisionTick: 0.75,
  },
  arcade: {
    playerMovement: 2.2,
    ballVelocity: 1.8,
    deliberation: 0.3,
    tokenAnimation: 1.6,
    recovery: 0.5,
    decisionTick: 0.6,
  },
  ultra: {
    playerMovement: 2.8,
    ballVelocity: 2.2,
    deliberation: 0.2,
    tokenAnimation: 1.8,
    recovery: 0.4,
    decisionTick: 0.5,
  },
};

/**
 * Preset ativo (pode ser alterado via UI ou comando).
 * DEFAULT: 'dynamic' (sweet spot entre realismo e emoção)
 */
let activePreset: SpeedBoostPreset = 'dynamic';

export function getActiveSpeedBoostPreset(): SpeedBoostPreset {
  return activePreset;
}

export function setActiveSpeedBoostPreset(preset: SpeedBoostPreset): void {
  activePreset = preset;
  console.log(`[SpeedBoost] Preset alterado para: ${preset}`, SPEED_BOOST_PRESETS[preset]);
}

export function getActiveSpeedBoostConfig(): SpeedBoostConfig {
  return SPEED_BOOST_PRESETS[activePreset];
}

// ============================================================================
// LOGS DE DEBUG
// ============================================================================

export function logSpeedBoostStatus(): void {
  const config = getActiveSpeedBoostConfig();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 LIVE MATCH SPEED BOOST — STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Preset ativo: ${activePreset.toUpperCase()}`);
  console.log(`  🏃 Movimento jogadores: ${config.playerMovement}x`);
  console.log(`  ⚽ Velocidade bola: ${config.ballVelocity}x`);
  console.log(`  🧠 Deliberação: ${config.deliberation}x (menor = mais rápido)`);
  console.log(`  🎬 Animação tokens: ${config.tokenAnimation}x`);
  console.log(`  ⚡ Recuperação: ${config.recovery}x (menor = mais rápido)`);
  console.log(`  🎯 Decisão tick: ${config.decisionTick}x (menor = mais frequente)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
