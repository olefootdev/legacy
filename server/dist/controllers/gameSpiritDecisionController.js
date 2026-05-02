import { getGameDecision } from '../services/anthropic/getGameDecision.js';
import { parseGameSpiritRequestBody } from '../services/anthropic/gameSpiritContext.js';
export async function postGameSpiritDecision(c) {
    let raw;
    try {
        raw = await c.req.json();
    }
    catch {
        return c.json({ error: 'JSON inválido.' }, 400);
    }
    const ctx = parseGameSpiritRequestBody(raw);
    if (!ctx) {
        return c.json({ error: 'Campo "player" obrigatório (string não vazia).' }, 400);
    }
    const result = await getGameDecision(ctx);
    return c.json(result);
}
//# sourceMappingURL=gameSpiritDecisionController.js.map