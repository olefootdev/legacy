/**
 * /src/tactical/timeScale.ts
 *
 * FONTE ÚNICA DE VERDADE para a compressão de tempo do motor ao vivo.
 *
 * O motor roda cada tempo em `HALF_SIM_SECONDS` segundos de simulação, mas as
 * distâncias estão em metros reais (105 × 68). Isso significa que toda velocidade
 * expressa em m/s de futebol precisa ser multiplicada por `TIME_SCALE` para que
 * a jogada aconteça na proporção certa dentro do campo.
 *
 * Antes desta constante, as velocidades eram números soltos batizados de
 * "virtual m/s" e cada um foi calibrado no olho, em momentos diferentes: o
 * jogador ficou ~2,4× lento e a bola ~10×. Como o que governa a cara do futebol
 * é a RAZÃO entre os dois, a bola passou a ser mais lenta que o jogador — o
 * inverso do futebol real, onde ela viaja ~2,4× mais rápido que um sprint.
 *
 * Regra: nenhuma velocidade nova entra no motor em unidade de simulação.
 * Escreva em m/s de futebol e converta com `footballMsToSim`.
 */

/** Duração de um tempo em segundos de simulação (`dt` acumulado, multiplier 1). */
export const HALF_SIM_SECONDS = 180;

/** Duração de um tempo em segundos de futebol. */
export const HALF_FOOTBALL_SECONDS = 45 * 60;

/** Segundos de futebol que passam a cada segundo de simulação. Hoje: 15. */
export const TIME_SCALE = HALF_FOOTBALL_SECONDS / HALF_SIM_SECONDS;

/** m/s de futebol → unidades de velocidade do motor. */
export function footballMsToSim(metersPerSecond: number): number {
  return metersPerSecond * TIME_SCALE;
}

/** Unidades de velocidade do motor → m/s de futebol. */
export function simToFootballMs(simSpeed: number): number {
  return simSpeed / TIME_SCALE;
}

/**
 * m/s² de futebol → unidades de aceleração do motor.
 *
 * Aceleração escala com o QUADRADO da compressão de tempo: se o tempo anda 15×
 * mais rápido e a distância é a mesma, a aceleração precisa ser 225× maior para
 * o jogador levar o mesmo número de segundos de futebol para atingir o sprint.
 * Ignorar isso foi o que deixou os agentes com arranque de caminhão.
 */
export function footballAccelToSim(metersPerSecondSquared: number): number {
  return metersPerSecondSquared * TIME_SCALE * TIME_SCALE;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CADÊNCIA DE DECISÃO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Intervalo entre decisões de um agente, em ms de FUTEBOL.
 *
 * O Football Manager decide a cada 250ms de futebol ("slice"). O motor usava
 * 280ms de SIMULAÇÃO, que com a compressão de 15× equivale a 4,2 segundos de
 * futebol entre decisões — tempo demais para reagir a um passe ou a uma bola
 * solta. 1000ms de futebol é o meio-termo: 4× mais decisões que antes, sem
 * quadruplicar o custo de `runAgentDecisions` a ponto de derrubar o frame.
 */
export const DECISION_INTERVAL_FOOTBALL_MS = 1000;
export const DECISION_JITTER_FOOTBALL_MS = 400;

/** Os mesmos valores em ms de simulação — é o que o `AgentRegulator` consome. */
export const DECISION_INTERVAL_SIM_MS = DECISION_INTERVAL_FOOTBALL_MS / TIME_SCALE;
export const DECISION_JITTER_SIM_MS = DECISION_JITTER_FOOTBALL_MS / TIME_SCALE;

// ═══════════════════════════════════════════════════════════════════════════════
// REFERÊNCIAS DE FUTEBOL REAL — usadas pelo tuning e pela régua de realismo
// ═══════════════════════════════════════════════════════════════════════════════

/** Sprint de elite, m/s. Pico de jogador rápido em partida. */
export const REF_SPRINT_FAST_MS = 9.0;
/** Sprint de jogador lento, m/s. */
export const REF_SPRINT_SLOW_MS = 6.8;
/** Corrida leve (jog), m/s. */
export const REF_JOG_MS = 4.2;
/** Caminhada, m/s. */
export const REF_WALK_MS = 1.6;
/** Passe curto/médio típico, m/s. */
export const REF_PASS_MS = 18;
/** Chute com força, m/s. */
export const REF_SHOT_MS = 28;

/**
 * Razão bola/jogador do futebol real: a bola viaja ~2,4× mais rápido que um
 * sprint. É o número que governa se um passe pode furar uma linha — e o que
 * estava invertido (0,5×) antes da unificação.
 */
export const REF_BALL_PLAYER_RATIO = REF_PASS_MS / REF_SPRINT_FAST_MS;
