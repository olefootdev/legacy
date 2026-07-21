/**
 * NEGOCIAÇÃO P2P ENTRE MANAGERS — proposta → aceite / negação / contraproposta.
 *
 * Complementa a compra direta (market.ts /buy-prospect): em vez de comprar pelo
 * preço listado, o comprador PROPÕE um valor; o vendedor aceita, nega ou
 * contrapropõe. A transferência no aceite reutiliza EXATAMENTE a mecânica
 * atômica do buy-prospect (lock condicional + move snapshot + credita EXP).
 *
 * Segurança: escrita só por service_role (este servidor). O cliente nunca grava
 * market_offers direto — RLS só permite SELECT às duas partes.
 */
import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { rateLimit } from '../lib/rateLimit.js';

export const marketOffersRoutes = new Hono();

const MAX_OFFER = 50_000_000;

async function resolveUser(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

type OfferRow = {
  offer_id: string;
  listing_id: string;
  game_player_id: string;
  player_snapshot: Record<string, unknown> & { id: string };
  player_name: string | null;
  player_overall: number | null;
  buyer_user_id: string;
  buyer_club_name: string | null;
  seller_user_id: string;
  offer_exp: number;
  status: string;
  counter_exp: number | null;
  created_at: string;
};

function toClientOffer(r: OfferRow) {
  return {
    offerId: r.offer_id,
    listingId: r.listing_id,
    gamePlayerId: r.game_player_id,
    playerName: r.player_name ?? String((r.player_snapshot as { name?: string }).name ?? 'Jogador'),
    playerOverall: r.player_overall ?? 0,
    buyerUserId: r.buyer_user_id,
    buyerClubName: r.buyer_club_name ?? 'Manager',
    sellerUserId: r.seller_user_id,
    offerExp: Number(r.offer_exp),
    status: r.status,
    counterExp: r.counter_exp != null ? Number(r.counter_exp) : undefined,
    createdAtIso: r.created_at,
  };
}

/**
 * Transferência atômica de um jogador vendedor→comprador por `priceExp`.
 * Espelha /api/market/buy-prospect (lock condicional + squads + wallet_credits).
 */
async function executeOfferTransfer(
  sb: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  args: { listingId: string; gamePlayerId: string; snapshot: Record<string, unknown> & { id: string }; buyerId: string; sellerId: string; priceExp: number },
): Promise<{ ok: true } | { ok: false; error: string; code: number }> {
  const { listingId, gamePlayerId, snapshot, buyerId, sellerId, priceExp } = args;

  // LOCK: só vence se ainda estava listed_on_market=true.
  const { data: locked, error: lockErr } = await sb
    .from('academy_managers')
    .update({ listed_on_market: false })
    .eq('listing_id', listingId)
    .eq('listed_on_market', true)
    .select('id');
  if (lockErr) return { ok: false, error: 'Erro ao reservar listagem.', code: 500 };
  if (!locked || locked.length === 0) return { ok: false, error: 'Listagem já não está disponível.', code: 409 };

  const rollbackLock = async () => {
    await sb.from('academy_managers').update({ listed_on_market: true }).eq('listing_id', listingId);
  };

  // Adiciona ao plantel do comprador (idempotente).
  const { data: buyerSquad } = await sb
    .from('manager_squad').select('players, lineup, formation_scheme').eq('user_id', buyerId).maybeSingle();
  const buyerPlayers = Array.isArray(buyerSquad?.players) ? (buyerSquad!.players as Array<{ id: string }>) : [];
  if (!buyerPlayers.some((p) => p.id === gamePlayerId)) {
    const { error: addErr } = await sb.from('manager_squad').upsert(
      { user_id: buyerId, players: [...buyerPlayers, snapshot], lineup: buyerSquad?.lineup ?? {}, formation_scheme: buyerSquad?.formation_scheme ?? null },
      { onConflict: 'user_id' },
    );
    if (addErr) { await rollbackLock(); return { ok: false, error: 'Falha ao entregar ao comprador.', code: 500 }; }
  }

  // Remove do plantel do vendedor (best-effort — comprador já recebeu).
  const { data: sellerSquad } = await sb
    .from('manager_squad').select('players, lineup, formation_scheme').eq('user_id', sellerId).maybeSingle();
  if (sellerSquad) {
    const sellerPlayers = Array.isArray(sellerSquad.players) ? (sellerSquad.players as Array<{ id: string }>) : [];
    const sellerLineup = (sellerSquad.lineup ?? {}) as Record<string, string>;
    const nextLineup: Record<string, string> = {};
    for (const [slot, pid] of Object.entries(sellerLineup)) if (pid !== gamePlayerId) nextLineup[slot] = pid;
    const { error: rmErr } = await sb.from('manager_squad').upsert(
      { user_id: sellerId, players: sellerPlayers.filter((p) => p.id !== gamePlayerId), lineup: nextLineup, formation_scheme: sellerSquad.formation_scheme ?? null },
      { onConflict: 'user_id' },
    );
    if (rmErr) console.error('[market/offer] remove from seller failed:', rmErr.message);
  }

  // Credita EXP pro vendedor (aplicado quando ele logar).
  const { error: creditErr } = await sb.from('wallet_credits').insert({
    user_id: sellerId, bro_cents: 0, exp_amount: priceExp, reason: `offer_sale:${listingId}`,
  });
  if (creditErr) console.error('[market/offer] credit seller failed:', creditErr.message);

  return { ok: true };
}

/** POST /api/market/offer — comprador propõe um valor por uma listagem. */
marketOffersRoutes.post('/api/market/offer', rateLimit(30), async (c) => {
  const buyerId = await resolveUser(c.req.header('Authorization'));
  if (!buyerId) return c.json({ ok: false, error: 'Unauthorized' }, 401);
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);

  const body = await c.req.json<{ listing_id?: string; offer_exp?: number; buyer_club_name?: string }>().catch(() => ({}) as Record<string, never>);
  const listingId = body.listing_id?.trim();
  const offerExp = Math.round(Number(body.offer_exp));
  if (!listingId) return c.json({ ok: false, error: 'listing_id obrigatório.' }, 400);
  if (!Number.isFinite(offerExp) || offerExp <= 0 || offerExp > MAX_OFFER) return c.json({ ok: false, error: 'Valor de proposta inválido.' }, 400);

  const { data: listing } = await sb
    .from('academy_managers')
    .select('listing_id, club_id, game_player_id, player_snapshot, listed_on_market')
    .eq('listing_id', listingId).maybeSingle();
  if (!listing) return c.json({ ok: false, error: 'Listagem não encontrada.' }, 404);
  if (!listing.listed_on_market) return c.json({ ok: false, error: 'Listagem não está disponível.' }, 409);

  const { data: sellerProfile } = await sb.from('profiles').select('id').eq('club_id', listing.club_id).maybeSingle();
  if (!sellerProfile?.id) return c.json({ ok: false, error: 'Vendedor não encontrado.' }, 404);
  const sellerId = sellerProfile.id as string;
  if (sellerId === buyerId) return c.json({ ok: false, error: 'Não dá pra propor pela tua própria listagem.' }, 400);

  const snap = listing.player_snapshot as Record<string, unknown> & { id: string; name?: string; overall?: number };
  // Upsert da proposta pendente do comprador nessa listagem (índice único garante 1).
  const { data: existing } = await sb
    .from('market_offers').select('offer_id')
    .eq('listing_id', listingId).eq('buyer_user_id', buyerId).eq('status', 'pending').maybeSingle();

  const row = {
    listing_id: listingId,
    game_player_id: String(listing.game_player_id),
    player_snapshot: snap,
    player_name: (snap.name as string) ?? null,
    player_overall: typeof snap.overall === 'number' ? snap.overall : null,
    buyer_user_id: buyerId,
    buyer_club_name: body.buyer_club_name?.slice(0, 40) ?? null,
    seller_user_id: sellerId,
    offer_exp: offerExp,
    status: 'pending',
    counter_exp: null,
    responded_at: null,
  };
  const q = existing
    ? sb.from('market_offers').update(row).eq('offer_id', existing.offer_id).select('*').single()
    : sb.from('market_offers').insert(row).select('*').single();
  const { data: saved, error: saveErr } = await q;
  if (saveErr || !saved) return c.json({ ok: false, error: 'Falha ao registrar proposta.', detail: saveErr?.message }, 500);
  return c.json({ ok: true, offer: toClientOffer(saved as OfferRow) });
});

/** POST /api/market/offer/respond — vendedor aceita / nega / contrapropõe. */
marketOffersRoutes.post('/api/market/offer/respond', rateLimit(30), async (c) => {
  const sellerId = await resolveUser(c.req.header('Authorization'));
  if (!sellerId) return c.json({ ok: false, error: 'Unauthorized' }, 401);
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);

  const body = await c.req.json<{ offer_id?: string; action?: string; counter_exp?: number }>().catch(() => ({}) as Record<string, never>);
  const offerId = body.offer_id?.trim();
  const act = body.action;
  if (!offerId || !['accept', 'reject', 'counter'].includes(act ?? '')) return c.json({ ok: false, error: 'Parâmetros inválidos.' }, 400);

  const { data: offer } = await sb.from('market_offers').select('*').eq('offer_id', offerId).maybeSingle();
  if (!offer) return c.json({ ok: false, error: 'Proposta não encontrada.' }, 404);
  if (offer.seller_user_id !== sellerId) return c.json({ ok: false, error: 'Proposta não é tua.' }, 403);
  if (offer.status !== 'pending') return c.json({ ok: false, error: 'Proposta já respondida.' }, 409);

  if (act === 'reject') {
    await sb.from('market_offers').update({ status: 'rejected', responded_at: new Date().toISOString() }).eq('offer_id', offerId);
    return c.json({ ok: true, status: 'rejected' });
  }
  if (act === 'counter') {
    const counter = Math.round(Number(body.counter_exp));
    if (!Number.isFinite(counter) || counter <= 0 || counter > MAX_OFFER) return c.json({ ok: false, error: 'Contraproposta inválida.' }, 400);
    await sb.from('market_offers').update({ status: 'countered', counter_exp: counter, responded_at: new Date().toISOString() }).eq('offer_id', offerId);
    return c.json({ ok: true, status: 'countered', counter_exp: counter });
  }

  // accept — transferência atômica pelo valor da proposta.
  const o = offer as OfferRow;
  const tx = await executeOfferTransfer(sb, {
    listingId: o.listing_id, gamePlayerId: o.game_player_id, snapshot: o.player_snapshot,
    buyerId: o.buyer_user_id, sellerId, priceExp: Number(o.offer_exp),
  });
  if (!tx.ok) return c.json({ ok: false, error: tx.error }, tx.code as 409 | 500);
  await sb.from('market_offers').update({ status: 'accepted', responded_at: new Date().toISOString() }).eq('offer_id', offerId);
  // Rejeita as demais propostas pendentes da mesma listagem.
  await sb.from('market_offers').update({ status: 'rejected', responded_at: new Date().toISOString() })
    .eq('listing_id', o.listing_id).eq('status', 'pending');
  return c.json({ ok: true, status: 'accepted', player_snapshot: o.player_snapshot, price_exp: Number(o.offer_exp), buyer_user_id: o.buyer_user_id, seller_user_id: sellerId });
});

/** POST /api/market/offer/accept-counter — comprador aceita a contraproposta. */
marketOffersRoutes.post('/api/market/offer/accept-counter', rateLimit(30), async (c) => {
  const buyerId = await resolveUser(c.req.header('Authorization'));
  if (!buyerId) return c.json({ ok: false, error: 'Unauthorized' }, 401);
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);

  const body = await c.req.json<{ offer_id?: string }>().catch(() => ({}) as Record<string, never>);
  const offerId = body.offer_id?.trim();
  if (!offerId) return c.json({ ok: false, error: 'offer_id obrigatório.' }, 400);

  const { data: offer } = await sb.from('market_offers').select('*').eq('offer_id', offerId).maybeSingle();
  if (!offer) return c.json({ ok: false, error: 'Proposta não encontrada.' }, 404);
  const o = offer as OfferRow;
  if (o.buyer_user_id !== buyerId) return c.json({ ok: false, error: 'Proposta não é tua.' }, 403);
  if (o.status !== 'countered' || o.counter_exp == null) return c.json({ ok: false, error: 'Sem contraproposta pendente.' }, 409);

  const tx = await executeOfferTransfer(sb, {
    listingId: o.listing_id, gamePlayerId: o.game_player_id, snapshot: o.player_snapshot,
    buyerId, sellerId: o.seller_user_id, priceExp: Number(o.counter_exp),
  });
  if (!tx.ok) return c.json({ ok: false, error: tx.error }, tx.code as 409 | 500);
  await sb.from('market_offers').update({ status: 'accepted', responded_at: new Date().toISOString() }).eq('offer_id', offerId);
  await sb.from('market_offers').update({ status: 'rejected', responded_at: new Date().toISOString() })
    .eq('listing_id', o.listing_id).eq('status', 'pending');
  return c.json({ ok: true, status: 'accepted', player_snapshot: o.player_snapshot, price_exp: Number(o.counter_exp), buyer_user_id: buyerId, seller_user_id: o.seller_user_id });
});

/** POST /api/market/offer/cancel — comprador cancela a própria proposta. */
marketOffersRoutes.post('/api/market/offer/cancel', rateLimit(30), async (c) => {
  const buyerId = await resolveUser(c.req.header('Authorization'));
  if (!buyerId) return c.json({ ok: false, error: 'Unauthorized' }, 401);
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);
  const body = await c.req.json<{ offer_id?: string }>().catch(() => ({}) as Record<string, never>);
  const offerId = body.offer_id?.trim();
  if (!offerId) return c.json({ ok: false, error: 'offer_id obrigatório.' }, 400);
  const { data: offer } = await sb.from('market_offers').select('buyer_user_id, status').eq('offer_id', offerId).maybeSingle();
  if (!offer || offer.buyer_user_id !== buyerId) return c.json({ ok: false, error: 'Proposta não encontrada.' }, 404);
  if (!['pending', 'countered'].includes(offer.status)) return c.json({ ok: false, error: 'Proposta não pode ser cancelada.' }, 409);
  await sb.from('market_offers').update({ status: 'cancelled', responded_at: new Date().toISOString() }).eq('offer_id', offerId);
  return c.json({ ok: true, status: 'cancelled' });
});

/** GET /api/market/offers — minhas propostas recebidas (vendedor) e enviadas (comprador). */
marketOffersRoutes.get('/api/market/offers', rateLimit(60), async (c) => {
  const userId = await resolveUser(c.req.header('Authorization'));
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401);
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'Serviço indisponível.' }, 503);

  const { data: incoming } = await sb.from('market_offers').select('*')
    .eq('seller_user_id', userId).in('status', ['pending', 'countered']).order('created_at', { ascending: false }).limit(50);
  const { data: outgoing } = await sb.from('market_offers').select('*')
    .eq('buyer_user_id', userId).in('status', ['pending', 'countered', 'accepted']).order('created_at', { ascending: false }).limit(50);
  return c.json({
    ok: true,
    incoming: (incoming ?? []).map((r) => toClientOffer(r as OfferRow)),
    outgoing: (outgoing ?? []).map((r) => toClientOffer(r as OfferRow)),
  });
});
