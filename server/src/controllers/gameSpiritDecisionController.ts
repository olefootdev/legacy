import type { Context } from 'hono';
import { getGameDecision } from '../services/openai/getGameDecision.js';
import { parseGameSpiritRequestBody } from '../services/openai/gameSpiritContext.js';

export async function postGameSpiritDecision(c: Context): Promise<Response> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: 'JSON inválido.' }, 400);
  }

  const ctx = parseGameSpiritRequestBody(raw);
  if (!ctx) {
    return c.json({ error: 'Campo "player" obrigatório (string não vazia).' }, 400);
  }

  const result = await getGameDecision(ctx);
  return c.json(result);
}
