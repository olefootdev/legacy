import type { Context, Next } from 'hono';
/** Rejeita requests cujo body excede maxBytes (default 32 KB). */
export declare function bodyLimit(maxBytes?: number): (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
    error: string;
}, 413, "json">) | undefined>;
/**
 * Sanitiza um string de input destinado a prompts Anthropic:
 * - Trunca ao limite
 * - Remove sequências de controlo e tentativas de injeção de prompt
 */
export declare function sanitizePrompt(raw: string, maxLen: number): string;
/** Valida que um valor é string não vazia dentro de comprimento. */
export declare function requireString(val: unknown, min?: number, max?: number): string | null;
