import type { Context, Next } from 'hono';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Token-bucket rate limiter por IP.
 * @param maxPerMinute  requests permitidos por minuto
 */
export function rateLimit(maxPerMinute: number) {
  const refillMs = 60_000;
  return async (c: Context, next: Next) => {
    // Prioridade: header injetado por edge confiável → header de proxy →
    // socket.remoteAddress do Node (dev sem proxy). Cloudflare em prod
    // sempre injeta cf-connecting-ip; Railway sempre injeta x-forwarded-for.
    const incoming: { socket?: { remoteAddress?: string } } | undefined = (c.env as any)?.incoming;
    const socketIp = incoming?.socket?.remoteAddress;
    const ip =
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      socketIp ??
      'unknown';

    // Rejeitar se não conseguir identificar IP (previne bypass via header spoofing)
    if (ip === 'unknown') {
      return c.json({ error: 'Unable to identify client' }, 400);
    }

    const now = Date.now();
    let bucket = buckets.get(ip);

    if (!bucket) {
      bucket = { tokens: maxPerMinute, lastRefill: now };
      buckets.set(ip, bucket);
    } else {
      const elapsed = now - bucket.lastRefill;
      if (elapsed >= refillMs) {
        bucket.tokens = maxPerMinute;
        bucket.lastRefill = now;
      }
    }

    if (bucket.tokens <= 0) {
      return c.json({ error: 'Too many requests — tente novamente em um minuto.' }, 429);
    }

    bucket.tokens--;
    await next();
  };
}
