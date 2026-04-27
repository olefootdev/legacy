/**
 * Relógio de jogo: 90 minutos = 5400 segundos de futebol.
 * Partida rápida: ~50s reais → SECONDS_PER_TICK = 60 (1 tick = 1 minuto de jogo).
 * UI interpola entre ticks para mostrar MM:SS suave.
 */
export const FOOTBALL_TOTAL_SECONDS = 5400;
export const SECONDS_PER_TICK = 60;
/** Duração real (ms) da animação de antecipação antes de confirmar o golo na UI. */
export const PRE_GOAL_DURATION_MS = 3000;
//# sourceMappingURL=types.js.map