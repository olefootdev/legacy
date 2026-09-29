import { Hono } from 'hono';
import { rateLimit } from '../lib/rateLimit.js';
import { regrasDeEarnings } from '../lib/earningsRegras.js';

/**
 * GET /api/earnings — as regras de Vault, Produção e Stake.
 *
 * Pública de leitura: é regra publicada, não dado de ninguém. O que é de cada
 * um (cotas, fatias recebidas) continua atrás de sessão, em `/api/vault/:slug/*`.
 *
 * 🔴 A tela MOSTRA, não decide. Split, prazo, multiplicador e backtest saem
 * daqui; a carteira não guarda cópia de nenhum.
 */
export const earningsRoutes = new Hono();

earningsRoutes.get('/api/earnings', rateLimit(60), (c) => {
  c.header('Cache-Control', 'public, max-age=300');
  return c.json({ ok: true, ...regrasDeEarnings() });
});
