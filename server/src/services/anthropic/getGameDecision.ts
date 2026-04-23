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

import { callAnthropic } from '../../lib/anthropic.js';
import type { GameSpiritDecisionCache } from './decisionCache.js';
import { noopGameSpiritDecisionCache } from './decisionCache.js';
import type { GameSpiritDecisionContext, GameSpiritDecisionResult } from './gameSpiritContext.js';
import { stableCacheKey } from './gameSpiritContext.js';
import { intelligentFallbackDecision } from './fallbackDecision.js';
import { logGameSpiritAiFireAndForget } from './logGameSpiritAi.js';

const SYSTEM = `Você é um jogador profissional no simulador OLEFOOT.
Analisa UM instante de jogo e responde APENAS com um objeto JSON válido
(sem markdown, sem texto extra), com as chaves exatas:

{"decision": string, "confidence": number, "narration": string}

- decision: identificador curto e acionável, ex.: pass_to_MC_8, driblar, chutar, recuar, conduzir.
- confidence: número entre 0 e 1.
- narration: UMA frase curta em português brasileiro, estilo relato técnico.`;

function parseModelJson(text: string): GameSpiritDecisionResult | null {
  let data: unknown;
  try { data = JSON.parse(text) as unknown; }
  catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { data = JSON.parse(match[0]) as unknown; } catch { return null; }
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

export interface GetGameDecisionOptions {
  cache?: GameSpiritDecisionCache;
}

export async function getGameDecision(
  ctx: GameSpiritDecisionContext,
  options: GetGameDecisionOptions = {},
): Promise<GameSpiritDecisionResult> {
  const cache = options.cache ?? noopGameSpiritDecisionCache;
  const cacheKey = stableCacheKey(ctx);
  const t0 = Date.now();

  // Cache primeiro.
  try {
    const hit = await cache.get(cacheKey);
    if (hit) {
      const parsed = parseModelJson(hit);
      if (parsed) {
        logGameSpiritAiFireAndForget({
          ctx,
          result: parsed,
          source: 'cache_hit',
          latencyMs: Date.now() - t0,
        });
        return parsed;
      }
    }
  } catch { /* cache é best-effort */ }

  // Chama Anthropic (Haiku).
  const r = await callAnthropic({
    model: 'haiku',
    system: SYSTEM,
    user: `Analisa esta jogada e devolve o JSON:\n${JSON.stringify(ctx)}`,
    expectJson: true,
    temperature: 0.25,
    maxTokens: 128,
    timeoutMs: 6000,
  });

  if (r.ok && r.text) {
    const parsed = parseModelJson(r.text);
    if (parsed) {
      try { await cache.set(cacheKey, JSON.stringify(parsed), 15_000); }
      catch { /* ignora */ }
      logGameSpiritAiFireAndForget({
        ctx,
        result: parsed,
        source: 'responses',
        model: r.model,
        latencyMs: Date.now() - t0,
      });
      return parsed;
    }
    console.error('[gamespirit] Resposta Anthropic inválida.');
  } else {
    console.error('[gamespirit] Falha Anthropic:', r.error);
  }

  // Fallback local.
  const fb = intelligentFallbackDecision(ctx);
  logGameSpiritAiFireAndForget({
    ctx,
    result: fb,
    source: 'fallback',
    latencyMs: Date.now() - t0,
    error: r.error ?? 'parse falhou',
  });
  return fb;
}
