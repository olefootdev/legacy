/**
 * CLIENT da negociação P2P entre managers (proposta → aceite / negação /
 * contraproposta). Fala com o olefoot-server (Hono) em server/src/routes/
 * marketOffers.ts. O cliente NUNCA grava market_offers direto — só o servidor
 * (service_role) escreve; aqui só chamamos os endpoints autenticados.
 *
 * Base URL + token seguem o MESMO padrão do restante do mercado (buy-legacy /
 * buy-prospect em Transfer.tsx): `olefootApiBase()` (VITE_OLEFOOT_API_URL, com
 * fallback localhost) + Bearer da sessão Supabase.
 */
import { getSupabase } from '@/supabase/client';
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import type { MarketOffer, MarketOfferStatus } from '@/game/types';

export type OfferAction = 'accept' | 'reject' | 'counter';

/** Snapshot serializado de PlayerEntity vindo do servidor no aceite. */
type PlayerSnapshot = Record<string, unknown> & { id: string };

async function authHeaders(): Promise<Record<string, string> | null> {
  const sb = getSupabase();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  if (!token) return null;
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const headers = await authHeaders();
  if (!headers) throw new Error('Sessão expirada — faz login novamente.');
  const base = olefootApiBase();
  const r = await fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = (await r.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;
  if (!r.ok || !data || data.ok === false) {
    throw new Error(data?.error ?? 'Não foi possível concluir a operação.');
  }
  return data as T;
}

/** POST /api/market/offer — comprador propõe (ou atualiza) um valor por uma listagem. */
export async function proposeOffer(
  listingId: string,
  offerExp: number,
  buyerClubName: string,
): Promise<MarketOffer> {
  const data = await postJson<{ ok: true; offer: MarketOffer }>('/api/market/offer', {
    listing_id: listingId,
    offer_exp: Math.round(offerExp),
    buyer_club_name: buyerClubName,
  });
  return data.offer;
}

/** POST /api/market/offer/respond — vendedor aceita / nega / contrapropõe. */
export async function respondToOffer(
  offerId: string,
  action: OfferAction,
  counterExp?: number,
): Promise<{
  status: MarketOfferStatus;
  playerSnapshot?: PlayerSnapshot;
  priceExp?: number;
  counterExp?: number;
  buyerUserId?: string;
  sellerUserId?: string;
}> {
  const data = await postJson<{
    ok: true;
    status: MarketOfferStatus;
    player_snapshot?: PlayerSnapshot;
    price_exp?: number;
    counter_exp?: number;
    buyer_user_id?: string;
    seller_user_id?: string;
  }>('/api/market/offer/respond', {
    offer_id: offerId,
    action,
    ...(action === 'counter' ? { counter_exp: Math.round(counterExp ?? 0) } : {}),
  });
  return {
    status: data.status,
    playerSnapshot: data.player_snapshot,
    priceExp: data.price_exp,
    counterExp: data.counter_exp,
    buyerUserId: data.buyer_user_id,
    sellerUserId: data.seller_user_id,
  };
}

/** POST /api/market/offer/accept-counter — comprador aceita a contraproposta. */
export async function acceptCounter(offerId: string): Promise<{
  status: MarketOfferStatus;
  playerSnapshot: PlayerSnapshot;
  priceExp: number;
  buyerUserId: string;
  sellerUserId: string;
}> {
  const data = await postJson<{
    ok: true;
    status: MarketOfferStatus;
    player_snapshot: PlayerSnapshot;
    price_exp: number;
    buyer_user_id: string;
    seller_user_id: string;
  }>('/api/market/offer/accept-counter', { offer_id: offerId });
  return {
    status: data.status,
    playerSnapshot: data.player_snapshot,
    priceExp: data.price_exp,
    buyerUserId: data.buyer_user_id,
    sellerUserId: data.seller_user_id,
  };
}

/** POST /api/market/offer/cancel — comprador cancela a própria proposta. */
export async function cancelOffer(offerId: string): Promise<void> {
  await postJson<{ ok: true }>('/api/market/offer/cancel', { offer_id: offerId });
}

/** GET /api/market/offers — propostas recebidas (vendedor) e enviadas (comprador). */
export async function fetchMyOffers(): Promise<{ incoming: MarketOffer[]; outgoing: MarketOffer[] }> {
  const headers = await authHeaders();
  if (!headers) return { incoming: [], outgoing: [] };
  const base = olefootApiBase();
  const r = await fetch(`${base}/api/market/offers`, { headers });
  const data = (await r.json().catch(() => null)) as
    | { ok: boolean; incoming?: MarketOffer[]; outgoing?: MarketOffer[] }
    | null;
  if (!r.ok || !data?.ok) return { incoming: [], outgoing: [] };
  return { incoming: data.incoming ?? [], outgoing: data.outgoing ?? [] };
}
