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
};
// ─── Cliente singleton ────────────────────────────────────────────────────
let cachedClient = null;
function getClient() {
    if (cachedClient)
        return cachedClient;
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY ausente. Configure no server/.env (dev) ou no Cloudflare Workers (prod).');
    }
    cachedClient = new Anthropic({ apiKey });
    return cachedClient;
}
export function hasAnthropicKey() {
    return !!process.env.ANTHROPIC_API_KEY?.trim();
}
// ─── Chamada principal ────────────────────────────────────────────────────
export async function callAnthropic(opts) {
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
        const response = await client.messages.create({
            model: modelId,
            max_tokens: opts.maxTokens ?? 1024,
            temperature: opts.temperature ?? (opts.expectJson ? 0.3 : 0.7),
            system: opts.system,
            messages: [{ role: 'user', content: opts.user }],
        }, { signal: abort.signal });
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
        const parsed = tryParseJson(text);
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message, model: modelId };
    }
    finally {
        clearTimeout(timer);
    }
}
// ─── Utilitários ──────────────────────────────────────────────────────────
function tryParseJson(text) {
    // Tenta direto.
    try {
        return JSON.parse(text);
    }
    catch { /* fallthrough */ }
    // Extrai primeiro bloco entre chaves/colchetes (tolera texto de enfeite).
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match)
        return null;
    try {
        return JSON.parse(match[0]);
    }
    catch {
        return null;
    }
}
/**
 * Cria um "system prompt" padronizado com regras de saída JSON.
 * Usar em todos os endpoints que esperam JSON estruturado.
 */
export function jsonSystemPrompt(persona, schemaHint) {
    return [
        persona.trim(),
        '',
        'REGRAS DE RESPOSTA:',
        '- Responda APENAS com JSON válido, sem texto adicional antes ou depois.',
        '- Sem comentários, sem markdown, sem blocos de código.',
        schemaHint ? `- Siga este schema exatamente: ${schemaHint}` : '',
    ].filter(Boolean).join('\n');
}
//# sourceMappingURL=anthropic.js.map