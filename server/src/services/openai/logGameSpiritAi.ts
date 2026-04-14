import { getSupabaseAdmin } from '../../lib/supabaseAdmin.js';
import type { GameSpiritDecisionContext, GameSpiritDecisionResult } from './gameSpiritContext.js';
import { stableCacheKey } from './gameSpiritContext.js';

export type GameSpiritAiLogSource = 'responses' | 'fallback' | 'cache_hit';

/**
 * Grava uma linha em `public.game_spirit_ai_logs` quando
 * `GAMESPIRIT_AI_LOG_SUPABASE=1` e o cliente admin Supabase está configurado.
 * Fire-and-forget: nunca deve falhar o pedido HTTP.
 */
export function logGameSpiritAiFireAndForget(input: {
  ctx: GameSpiritDecisionContext;
  result: GameSpiritDecisionResult;
  source: GameSpiritAiLogSource;
  model?: string | null;
  latencyMs?: number | null;
  error?: string | null;
}): void {
  if (process.env.GAMESPIRIT_AI_LOG_SUPABASE !== '1') return;
  const sb = getSupabaseAdmin();
  if (!sb) return;

  const fingerprint = stableCacheKey(input.ctx);
  const row = {
    match_id: input.ctx.matchId ?? null,
    club_id: input.ctx.clubId ?? null,
    request_fingerprint: fingerprint,
    provider: 'openai',
    model: input.model ?? null,
    source: input.source,
    input_summary: {
      player: input.ctx.player,
      position: input.ctx.position,
      ballOwner: input.ctx.ballOwner,
      pressureLevel: input.ctx.pressureLevel,
      objective: input.ctx.objective,
      nearbyCount: input.ctx.nearbyPlayers.length,
    },
    output_json: input.result as unknown as Record<string, unknown>,
    latency_ms: input.latencyMs ?? null,
    error: input.error ?? null,
  };

  void sb
    .from('game_spirit_ai_logs')
    .insert(row as never)
    .then(({ error }) => {
      if (error) console.warn('[gamespirit] log supabase:', error.message);
    });
}
