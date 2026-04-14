import OpenAI from 'openai';
import type { GameSpiritDecisionCache } from './decisionCache.js';
import { noopGameSpiritDecisionCache } from './decisionCache.js';
import type { GameSpiritDecisionContext, GameSpiritDecisionResult } from './gameSpiritContext.js';
import { stableCacheKey } from './gameSpiritContext.js';
import { intelligentFallbackDecision } from './fallbackDecision.js';
import { logGameSpiritAiFireAndForget } from './logGameSpiritAi.js';

const SYSTEM = `És um jogador de futebol profissional no simulador OLEFOOT.
Analisas UM instante de jogo e respondes APENAS com um objeto JSON válido (sem markdown, sem texto extra), com as chaves exatas:
{"decision": string, "confidence": number, "narration": string}
- decision: identificador curto e acionável, ex.: pass_to_MC_8, driblar, chutar, recuar, conduzir.
- confidence: número entre 0 e 1 (probabilidade subjetiva de ser a melhor opção).
- narration: UMA frase curta em português europeu, estilo relato técnico.`;

/** Alinhado ao fluxo local tipo Express: um único input com o contexto em JSON. */
function buildResponsesInput(ctx: GameSpiritDecisionContext): string {
  return `Analise esta jogada do OLEFOOT e responda só com o objeto JSON pedido nas instruções (sem markdown).\n${JSON.stringify(ctx)}`;
}

function parseModelJson(text: string): GameSpiritDecisionResult | null {
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const decision = typeof o.decision === 'string' ? o.decision.trim() : '';
  const narration = typeof o.narration === 'string' ? o.narration.trim() : '';
  const confRaw = o.confidence;
  const confidence =
    typeof confRaw === 'number' && Number.isFinite(confRaw)
      ? Math.max(0, Math.min(1, confRaw))
      : typeof confRaw === 'string' && confRaw.trim()
        ? Math.max(0, Math.min(1, parseFloat(confRaw)))
        : NaN;
  if (!decision || !narration || !Number.isFinite(confidence)) return null;
  return { decision, confidence, narration };
}

function gamespiritModel(): string {
  return (
    process.env.OPENAI_GAMESPIRIT_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    'gpt-4.1-mini'
  );
}

export interface GetGameDecisionOptions {
  cache?: GameSpiritDecisionCache;
}

/**
 * Obtém decisão + narração via OpenAI, com cache opcional e fallback local.
 */
export async function getGameDecision(
  ctx: GameSpiritDecisionContext,
  options: GetGameDecisionOptions = {},
): Promise<GameSpiritDecisionResult> {
  const cache = options.cache ?? noopGameSpiritDecisionCache;
  const cacheKey = stableCacheKey(ctx);
  const t0 = Date.now();

  try {
    const hit = await cache.get(cacheKey);
    if (hit) {
      const parsed = parseModelJson(hit);
      if (parsed) {
        logGameSpiritAiFireAndForget({
          ctx,
          result: parsed,
          source: 'cache_hit',
          model: gamespiritModel(),
          latencyMs: Date.now() - t0,
        });
        return parsed;
      }
    }
  } catch {
    /* cache opcional — nunca falha o fluxo */
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const fb = intelligentFallbackDecision(ctx);
    logGameSpiritAiFireAndForget({
      ctx,
      result: fb,
      source: 'fallback',
      latencyMs: Date.now() - t0,
      error: 'OPENAI_API_KEY ausente',
    });
    return fb;
  }

  const openai = new OpenAI({ apiKey });
  const model = gamespiritModel();

  try {
    const response = await openai.responses.create({
      model,
      instructions: SYSTEM,
      input: buildResponsesInput(ctx),
      temperature: 0.25,
      max_output_tokens: 128,
      text: { format: { type: 'json_object' } },
    });

    const text =
      typeof (response as { output_text?: unknown }).output_text === 'string'
        ? (response as { output_text: string }).output_text.trim()
        : '';
    const parsed = parseModelJson(text);
    if (parsed) {
      try {
        await cache.set(cacheKey, JSON.stringify(parsed), 15_000);
      } catch {
        /* ignore cache write */
      }
      logGameSpiritAiFireAndForget({
        ctx,
        result: parsed,
        source: 'responses',
        model,
        latencyMs: Date.now() - t0,
      });
      return parsed;
    }
    console.error('[gamespirit] Resposta OpenAI inválida ou vazia.');
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OpenAI request failed';
    console.error('[gamespirit] Falha OpenAI:', msg);
  }

  const fb = intelligentFallbackDecision(ctx);
  logGameSpiritAiFireAndForget({
    ctx,
    result: fb,
    source: 'fallback',
    model,
    latencyMs: Date.now() - t0,
    error: 'OpenAI inválida ou falhou',
  });
  return fb;
}
