import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { rateLimit } from '../lib/rateLimit.js';

export const marketRoutes = new Hono();

/** Fórmula idêntica à do cliente (playerContracts.ts). */
function genesisListingPriceExp(mintOverall: number): number {
  const o = Math.round(Math.max(0, Math.min(99, mintOverall)));
  const t = (Math.max(24, Math.min(72, o)) - 24) / 48;
  const raw = 250_000 + Math.round(t * (1_000_000 - 250_000));
  return Math.round(raw / 5000) * 5000;
}

async function resolveUser(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

/**
 * POST /api/market/buy
 * Valida e regista a compra de um jogador Genesis.
 * Body: { genesis_catalog_id: string }
 * Auth: Authorization: Bearer <jwt>
 *
 * Responde com { ok: true, price_exp, mint_overall } para o cliente confirmar o dispatch.
 */
marketRoutes.post('/api/market/buy', rateLimit(20), async (c) => {
  const userId = await resolveUser(c.req.header('Authorization'));
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);

  const body = await c.req.json<{ genesis_catalog_id?: string }>().catch(() => ({}));
  const genesisId = body.genesis_catalog_id?.trim();
  if (!genesisId) return c.json({ ok: false, error: 'genesis_catalog_id obrigatório.' }, 400);

  // Busca o jogador na fonte autoritativa (Supabase)
  const { data: player, error: fetchErr } = await sb
    .from('genesis_market_players')
    .select('id, mint_overall, listed_on_market')
    .eq('id', genesisId)
    .maybeSingle();

  if (fetchErr || !player) return c.json({ ok: false, error: 'Jogador não encontrado.' }, 404);
  if (!player.listed_on_market) return c.json({ ok: false, error: 'Jogador não está à venda.' }, 409);

  const mintOverall = player.mint_overall as number;
  const priceExp = genesisListingPriceExp(mintOverall);

  // Tenta registar a compra (unique constraint impede duplicados)
  const { error: insertErr } = await sb.from('market_purchases').insert({
    user_id: userId,
    genesis_id: genesisId,
    price_exp: priceExp,
    mint_overall: mintOverall,
  });

  if (insertErr) {
    // Código 23505 = violação de unique (compra duplicada)
    if (insertErr.code === '23505') {
      return c.json({ ok: false, error: 'Jogador já adquirido.' }, 409);
    }
    console.error('[market/buy] insert error:', insertErr.message);
    return c.json({ ok: false, error: 'Erro ao registar compra.' }, 500);
  }

  return c.json({ ok: true, price_exp: priceExp, mint_overall: mintOverall });
});
