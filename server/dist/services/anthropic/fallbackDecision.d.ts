import type { GameSpiritDecisionContext, GameSpiritDecisionResult } from './gameSpiritContext.js';
/**
 * Decisão local quando a API falha ou não está configurada.
 * Usa pressão, objectivo e colegas próximos — não é aleatório puro.
 */
export declare function intelligentFallbackDecision(ctx: GameSpiritDecisionContext): GameSpiritDecisionResult;
