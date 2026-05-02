import type { Context, Next } from 'hono';
/**
 * Token-bucket rate limiter por IP.
 * @param maxPerMinute  requests permitidos por minuto
 */
export declare function rateLimit(maxPerMinute: number): (c: Context, next: Next) => Promise<(Response & import("hono").TypedResponse<{
    error: string;
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 429, "json">) | undefined>;
