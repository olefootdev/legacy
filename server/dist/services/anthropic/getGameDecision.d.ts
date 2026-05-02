/**
 * GameSpirit Decision — decisão acionável por tick de partida.
 * Substitui `services/openai/getGameDecision.ts`.
 *
 * Estratégia pós-migração:
 *   - NARRAÇÃO sai daqui e passa a vir do catálogo offline (ver
 *     `src/gamespirit/narrativeCatalog.ts` no cliente).
 *   - DECISÃO (string curta + confidence) continua podendo chamar LLM,
 *     com cache de 15s pra reduzir custo, e fallback local em caso de
 *     indisponibilidade.
 *
 * Modelo: Haiku 4.5 — decisão curta, rápida, barata.
 */
import type { GameSpiritDecisionCache } from './decisionCache.js';
import type { GameSpiritDecisionContext, GameSpiritDecisionResult } from './gameSpiritContext.js';
export interface GetGameDecisionOptions {
    cache?: GameSpiritDecisionCache;
}
export declare function getGameDecision(ctx: GameSpiritDecisionContext, options?: GetGameDecisionOptions): Promise<GameSpiritDecisionResult>;
