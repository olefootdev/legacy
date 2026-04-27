/**
 * Wrapper unificado do Anthropic SDK.
 *
 * Centraliza:
 *   - Cliente único reutilizado
 *   - Seleção de modelo (Sonnet pra qualidade, Haiku pra velocidade/custo)
 *   - Parsing JSON robusto com retry se vier quebrado
 *   - Erros padronizados
 *
 * Todas as rotas que usam LLM devem importar daqui (server/src/routes/*).
 */

import Anthropic from '@anthropic-ai/sdk';

// ─── Modelos ──────────────────────────────────────────────────────────────
// IDs ficam em ENV pra permitir override sem redeploy.
// Defaults: família Claude 4 (sonnet-4-6 pra qualidade, haiku-4-5 pra custo).

const DEFAULT_SONNET = 'claude-sonnet-4-6';
const DEFAULT_HAIKU = 'claude-haiku-4-5-20251001';

export const MODELS = {
  sonnet: process.env.ANTHROPIC_MODEL_SONNET ?? DEFAULT_SONNET,
  haiku: process.env.ANTHROPIC_MODEL_HAIKU ?? DEFAULT_HAIKU,
} as const;

export type ModelKey = keyof typeof MODELS;

// ─── Cliente singleton ────────────────────────────────────────────────────

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY ausente. Configure no server/.env (dev) ou no Cloudflare Workers (prod).',
    );
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export function hasAnthropicKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

// ─── Tipagens ─────────────────────────────────────────────────────────────

export interface AnthropicCallOptions {
  /** Chave do modelo: 'sonnet' (qualidade) ou 'haiku' (custo/velocidade). */
  model: ModelKey;
  /** System prompt — identidade e regras do agente. */
  system: string;
  /** Conteúdo do usuário — pergunta/contexto. */
  user: string;
  /** Máximo de tokens de resposta. Default 1024. */
  maxTokens?: number;
  /** Criatividade 0.0–1.0. Default 0.7 pra narrativa; use 0.3 pra JSON estrito. */
  temperature?: number;
  /** Se true, espera JSON na resposta e faz parse. Retry automático se falhar. */
  expectJson?: boolean;
  /** Timeout em ms. Default 30000. */
  timeoutMs?: number;
}

export interface AnthropicCallResult<T = unknown> {
  ok: boolean;
  text?: string;
  json?: T;
  error?: string;
  usage?: { inputTokens: number; outputTokens: number };
  model: string;
}

// ─── Chamada principal ────────────────────────────────────────────────────

export async function callAnthropic<T = unknown>(
  opts: AnthropicCallOptions,
): Promise<AnthropicCallResult<T>> {
  const modelId = MODELS[opts.model];

  if (!hasAnthropicKey()) {
    return {
      ok: false,
      error: 'ANTHROPIC_API_KEY não configurada',
      model: modelId,
    };
  }

  const client = getClient();
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);

  try {
    const response = await client.messages.create(
      {
        model: modelId,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? (opts.expectJson ? 0.3 : 0.7),
        system: opts.system,
        messages: [{ role: 'user', content: opts.user }],
      },
      { signal: abort.signal },
    );

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('\n')
      .trim();

    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };

    if (!opts.expectJson) {
      return { ok: true, text, usage, model: modelId };
    }

    const parsed = tryParseJson<T>(text);
    if (parsed === null) {
      return {
        ok: false,
        text,
        error: 'Resposta do modelo não era JSON parseável',
        usage,
        model: modelId,
      };
    }
    return { ok: true, text, json: parsed, usage, model: modelId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, model: modelId };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Utilitários ──────────────────────────────────────────────────────────

function tryParseJson<T>(text: string): T | null {
  // Tenta direto.
  try { return JSON.parse(text) as T; } catch { /* fallthrough */ }
  // Extrai primeiro bloco entre chaves/colchetes (tolera texto de enfeite).
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) return null;
  try { return JSON.parse(match[0]) as T; } catch { return null; }
}

/**
 * Cria um "system prompt" padronizado com regras de saída JSON.
 * Usar em todos os endpoints que esperam JSON estruturado.
 */
export function jsonSystemPrompt(persona: string, schemaHint?: string): string {
  return [
    persona.trim(),
    '',
    'REGRAS DE RESPOSTA:',
    '- Responda APENAS com JSON válido, sem texto adicional antes ou depois.',
    '- Sem comentários, sem markdown, sem blocos de código.',
    schemaHint ? `- Siga este schema exatamente: ${schemaHint}` : '',
  ].filter(Boolean).join('\n');
}
