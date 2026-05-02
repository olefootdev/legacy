import { Hono } from 'hono';
import { postGameSpiritDecision } from '../controllers/gameSpiritDecisionController.js';
import { postMatchTick } from '../controllers/matchTickController.js';
import { rateLimit } from '../lib/rateLimit.js';
import { sanitizePrompt } from '../lib/inputGuards.js';
import { hasAnthropicKey, MODELS } from '../lib/anthropic.js';
import { generatePlayerPersonaCombined, runScoutAgent, runAttributesAgent, runBioAgent, runValuationAgent, } from '../services/anthropic/playerPersona.js';
import { runGrowthAnalyst } from '../services/anthropic/growthAnalyst.js';
import { runTeach } from '../services/anthropic/teach.js';
// Os prompts e tipos do legado OpenAI foram migrados pra
// `server/src/services/anthropic/*`. Mantemos aqui só a composição de rotas.
export const gameSpiritRoutes = new Hono();
/** Decisão acionável + narração curta (motor GameSpirit; chave só no servidor). */
gameSpiritRoutes.post('/api/gamespirit', rateLimit(30), postGameSpiritDecision);
/** Tick de partida Quick Match (anti-cheat + replay determinístico). */
gameSpiritRoutes.post('/api/match/tick', rateLimit(120), postMatchTick);
gameSpiritRoutes.get('/api/game-spirit/status', (c) => {
    const anthropicConfigured = hasAnthropicKey();
    return c.json({
        ok: true,
        provider: 'anthropic',
        anthropicConfigured,
        /** Back-compat para o client antigo que verifica `openaiConfigured`. */
        openaiConfigured: anthropicConfigured,
        model: MODELS.haiku,
        gamespiritModel: MODELS.haiku,
        sonnetModel: MODELS.sonnet,
    });
});
/** Admin Create Player — modo combined (compat). Preferir os 4 agentes abaixo. */
gameSpiritRoutes.post('/api/admin/player-from-prompt', rateLimit(20), async (c) => {
    if (!hasAnthropicKey()) {
        return c.json({ ok: false, error: 'ANTHROPIC_API_KEY em falta no servidor.' }, 503);
    }
    let body;
    try {
        body = (await c.req.json());
    }
    catch {
        return c.json({ ok: false, error: 'JSON inválido.' }, 400);
    }
    const userPrompt = sanitizePrompt(body.userPrompt ?? '', 4000);
    if (userPrompt.length < 4) {
        return c.json({ ok: false, error: 'Prompt demasiado curto (mín. 4 caracteres).' }, 400);
    }
    const locked = body.locked;
    if (!locked || typeof locked.name !== 'string' || !locked.name.trim()) {
        return c.json({ ok: false, error: 'Campo "locked.name" obrigatório.' }, 400);
    }
    if (typeof locked.pos !== 'string' || !locked.pos.trim()) {
        return c.json({ ok: false, error: 'Campo "locked.pos" obrigatório.' }, 400);
    }
    const r = await generatePlayerPersonaCombined(locked, userPrompt);
    if (!r.ok)
        return c.json({ ok: false, error: r.error ?? 'Falha Anthropic.' }, 502);
    return c.json({ ok: true, rawAssistant: r.rawAssistant, json: r.json });
});
// ─── Create Player — 4 agentes especializados (novo fluxo) ─────────────
// Use na UI em sequência: scout → attributes → bio → valuation.
// Cada passo pode ser editado pelo admin antes de prosseguir.
gameSpiritRoutes.post('/api/admin/player/scout', rateLimit(10), async (c) => {
    if (!hasAnthropicKey())
        return c.json({ ok: false, error: 'ANTHROPIC_API_KEY ausente.' }, 503);
    const body = await c.req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name)
        return c.json({ ok: false, error: 'name obrigatório.' }, 400);
    const r = await runScoutAgent({
        name,
        nickname: typeof body.nickname === 'string' ? body.nickname : undefined,
        hintPosition: typeof body.hintPosition === 'string' ? body.hintPosition : undefined,
        hintEra: typeof body.hintEra === 'string' ? body.hintEra : undefined,
        sources: Array.isArray(body.sources)
            ? body.sources.filter((s) => typeof s === 'string' && s.trim().length > 0).slice(0, 5)
            : undefined,
    });
    if (!r.ok)
        return c.json({ ok: false, error: r.error ?? 'Falha no scout.' }, 502);
    return c.json({ ok: true, research: r.research });
});
gameSpiritRoutes.post('/api/admin/player/attributes', rateLimit(10), async (c) => {
    if (!hasAnthropicKey())
        return c.json({ ok: false, error: 'ANTHROPIC_API_KEY ausente.' }, 503);
    const body = await c.req.json().catch(() => ({}));
    if (!body || typeof body !== 'object' || !body.research) {
        return c.json({ ok: false, error: 'research obrigatório.' }, 400);
    }
    const r = await runAttributesAgent({
        research: body.research,
        targetRarity: body.targetRarity,
    });
    if (!r.ok)
        return c.json({ ok: false, error: r.error ?? 'Falha nos atributos.' }, 502);
    return c.json({ ok: true, attrs: r.attrs });
});
gameSpiritRoutes.post('/api/admin/player/bio', rateLimit(10), async (c) => {
    if (!hasAnthropicKey())
        return c.json({ ok: false, error: 'ANTHROPIC_API_KEY ausente.' }, 503);
    const body = await c.req.json().catch(() => ({}));
    if (!body || typeof body !== 'object' || !body.research) {
        return c.json({ ok: false, error: 'research obrigatório.' }, 400);
    }
    const r = await runBioAgent({
        research: body.research,
        attrs: body.attrs,
    });
    if (!r.ok)
        return c.json({ ok: false, error: r.error ?? 'Falha na bio.' }, 502);
    return c.json({ ok: true, bio: r.bio });
});
gameSpiritRoutes.post('/api/admin/player/valuation', rateLimit(10), async (c) => {
    if (!hasAnthropicKey())
        return c.json({ ok: false, error: 'ANTHROPIC_API_KEY ausente.' }, 503);
    const body = await c.req.json().catch(() => ({}));
    if (!body?.attrs)
        return c.json({ ok: false, error: 'attrs obrigatório.' }, 400);
    const r = await runValuationAgent({
        attrs: body.attrs,
        research: body.research,
        collectionContext: typeof body.collectionContext === 'string' ? body.collectionContext : undefined,
    });
    if (!r.ok)
        return c.json({ ok: false, error: r.error ?? 'Falha na valuation.' }, 502);
    return c.json({ ok: true, valuation: r.valuation });
});
gameSpiritRoutes.post('/api/admin/growth-analyst', rateLimit(20), async (c) => {
    if (!hasAnthropicKey()) {
        return c.json({ ok: false, error: 'ANTHROPIC_API_KEY em falta no servidor.' }, 503);
    }
    let body;
    try {
        body = (await c.req.json());
    }
    catch {
        return c.json({ ok: false, error: 'JSON inválido.' }, 400);
    }
    const snap = body.snapshot;
    if (snap == null || typeof snap !== 'object') {
        return c.json({ ok: false, error: 'Campo "snapshot" (object) obrigatório.' }, 400);
    }
    const founderNote = sanitizePrompt(body.founderNote ?? '', 2000);
    const r = await runGrowthAnalyst({ snapshot: snap, founderNote });
    if (!r.ok)
        return c.json({ ok: false, error: r.error ?? 'Falha Anthropic.' }, 502);
    return c.json({ ok: true, rawAssistant: r.rawAssistant, analysis: r.analysis });
});
gameSpiritRoutes.post('/api/game-spirit/teach', rateLimit(20), async (c) => {
    if (!hasAnthropicKey()) {
        return c.json({ ok: false, error: 'ANTHROPIC_API_KEY em falta no servidor.' }, 503);
    }
    let body;
    try {
        body = (await c.req.json());
    }
    catch {
        return c.json({ ok: false, error: 'JSON inválido.' }, 400);
    }
    const rawKind = body.kind ?? 'narrative';
    const kind = rawKind === 'tactical' || rawKind === 'position' || rawKind === 'narrative' ? rawKind : 'narrative';
    const userMessage = sanitizePrompt(body.userMessage ?? '', 3000);
    if (userMessage.length < 8) {
        return c.json({ ok: false, error: 'Mensagem demasiado curta (mín. 8 caracteres).' }, 400);
    }
    const contextJson = body.contextJson ? sanitizePrompt(body.contextJson, 12000) : undefined;
    const r = await runTeach({ kind, userMessage, contextJson });
    if (!r.ok) {
        return c.json({ ok: false, error: r.error ?? 'Falha Anthropic.', rawAssistant: r.rawAssistant }, 502);
    }
    return c.json({ ok: true, data: r.data, rawAssistant: r.rawAssistant });
});
//# sourceMappingURL=gameSpirit.js.map