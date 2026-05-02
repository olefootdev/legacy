import type { Context, Next } from 'hono';
/**
 * CSRF: rejeita POSTs cross-origin sem Origin válida.
 * Browsers sempre enviam Origin em cross-origin requests; fetch de mesmo site envia-a também.
 */
export declare function csrfGuard(c: Context, next: Next): Promise<void | (Response & import("hono").TypedResponse<{
    error: string;
}, 403, "json">)>;
/**
 * Security headers para todas as respostas.
 */
export declare function securityHeaders(c: Context, next: Next): Promise<void>;
