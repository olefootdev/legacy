/** Contexto mínimo enviado pelo cliente (motor / painel) para decisão GameSpirit. */
export type PressureLevel = 'low' | 'medium' | 'high' | string;
export interface GameSpiritDecisionContext {
    player: string;
    position: string;
    ballOwner: boolean;
    pressureLevel: PressureLevel;
    nearbyPlayers: string[];
    objective: string;
    /** Opcional: liga o log Supabase à partida online (`game_spirit_ai_logs`). */
    matchId?: string;
    clubId?: string;
}
export interface GameSpiritDecisionResult {
    decision: string;
    confidence: number;
    narration: string;
}
export declare function stableCacheKey(ctx: GameSpiritDecisionContext): string;
/** Aceita `{ context: { player, ... } }` (padrão Express) ou o objeto de contexto na raiz. */
export declare function parseGameSpiritRequestBody(raw: unknown): GameSpiritDecisionContext | null;
export declare function parseGameSpiritDecisionBody(raw: unknown): GameSpiritDecisionContext | null;
