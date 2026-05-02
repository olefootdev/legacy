import type { GameSpiritDecisionContext, GameSpiritDecisionResult } from './gameSpiritContext.js';
export type GameSpiritAiLogSource = 'responses' | 'fallback' | 'cache_hit';
/**
 * Grava uma linha em `public.game_spirit_ai_logs` quando
 * `GAMESPIRIT_AI_LOG_SUPABASE=1` e o cliente admin Supabase está configurado.
 * Fire-and-forget: nunca deve falhar o pedido HTTP.
 */
export declare function logGameSpiritAiFireAndForget(input: {
    ctx: GameSpiritDecisionContext;
    result: GameSpiritDecisionResult;
    source: GameSpiritAiLogSource;
    model?: string | null;
    latencyMs?: number | null;
    error?: string | null;
}): void;
