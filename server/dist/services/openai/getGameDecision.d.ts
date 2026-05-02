import type { GameSpiritDecisionCache } from './decisionCache.js';
import type { GameSpiritDecisionContext, GameSpiritDecisionResult } from './gameSpiritContext.js';
export interface GetGameDecisionOptions {
    cache?: GameSpiritDecisionCache;
}
/**
 * Obtém decisão + narração via OpenAI, com cache opcional e fallback local.
 */
export declare function getGameDecision(ctx: GameSpiritDecisionContext, options?: GetGameDecisionOptions): Promise<GameSpiritDecisionResult>;
