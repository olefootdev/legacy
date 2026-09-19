import { Hono } from 'hono';
import { fetchUsdBrlQuote } from '../lib/usdBrlQuote.js';

/**
 * GET /api/quote/usd-brl — a cotação que a tela mostra.
 *
 * Pública de propósito: é o preço de vitrine, o mesmo número que o servidor
 * usa pra cobrar (server/src/lib/usdBrlQuote.ts). Existe pra tirar o terceiro
 * do caminho do navegador — com ele lá, a CSP bloqueia e o card em R$ aparece
 * com preço em OLE, que é a moeda errada.
 */
export const quoteRoutes = new Hono();

quoteRoutes.get('/api/quote/usd-brl', async (c) => {
  try {
    const quote = await fetchUsdBrlQuote();
    // 60s espelha o cache do servidor; stale-while-revalidate segura a tela
    // enquanto a próxima cotação não chega.
    c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return c.json({ ok: true, ...quote });
  } catch {
    return c.json({ ok: false, error: 'Cotação do dólar indisponível.' }, 502);
  }
});
