/** Rejeita requests cujo body excede maxBytes (default 32 KB). */
export function bodyLimit(maxBytes = 32_768) {
    return async (c, next) => {
        const len = Number(c.req.header('content-length') ?? 0);
        if (len > maxBytes) {
            return c.json({ error: 'Payload demasiado grande.' }, 413);
        }
        await next();
    };
}
/**
 * Sanitiza um string de input destinado a prompts Anthropic:
 * - Trunca ao limite
 * - Remove sequências de controlo e tentativas de injeção de prompt
 */
export function sanitizePrompt(raw, maxLen) {
    return raw
        .slice(0, maxLen)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // caracteres de controlo
        .replace(/\b(ignore|disregard|forget|override|bypass)\s+(all\s+)?(previous|above|prior|earlier)\s+(instructions?|prompts?|rules?)\b/gi, '[blocked]')
        .replace(/\b(system|assistant|user)\s+(prompt|message|role)\b/gi, '[blocked]')
        .replace(/\b(reveal|show|print|output)\s+(your|the)\s+(prompt|instructions?|system)\b/gi, '[blocked]')
        .trim();
}
/** Valida que um valor é string não vazia dentro de comprimento. */
export function requireString(val, min = 1, max = 2000) {
    if (typeof val !== 'string')
        return null;
    const s = val.trim();
    if (s.length < min || s.length > max)
        return null;
    return s;
}
//# sourceMappingURL=inputGuards.js.map