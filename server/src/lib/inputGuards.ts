import type { Context, Next } from 'hono';

/** Rejeita requests cujo body excede maxBytes (default 32 KB). */
export function bodyLimit(maxBytes = 32_768) {
  return async (c: Context, next: Next) => {
    const len = Number(c.req.header('content-length') ?? 0);
    if (len > maxBytes) {
      return c.json({ error: 'Payload demasiado grande.' }, 413);
    }
    await next();
  };
}

/**
 * Sanitiza um string de input destinado a prompts OpenAI:
 * - Trunca ao limite
 * - Remove sequências de controlo e tentativas de injeção de prompt óbvias
 */
export function sanitizePrompt(raw: string, maxLen: number): string {
  return raw
    .slice(0, maxLen)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // caracteres de controlo
    .replace(/\bignore (all )?(previous|above|prior) instructions?\b/gi, '[blocked]')
    .replace(/\bsystem prompt\b/gi, '[blocked]')
    .trim();
}

/** Valida que um valor é string não vazia dentro de comprimento. */
export function requireString(val: unknown, min = 1, max = 2000): string | null {
  if (typeof val !== 'string') return null;
  const s = val.trim();
  if (s.length < min || s.length > max) return null;
  return s;
}
