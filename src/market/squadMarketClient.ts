/**
 * Client do MERCADO DE ELENCO em OLEFOOT ("compra por $1, treina, vende por $3").
 * Backend: server/src/routes/squadMarket.ts. Mesmo padrão do marketOffers:
 * Bearer da sessão, o servidor decide tudo.
 */
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import { getSupabase } from '@/supabase/client';
import type { PlayerEntity } from '@/entities/types';

async function authHeaders(): Promise<Record<string, string> | null> {
  const sb = getSupabase();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  if (!token) return null;
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function chamar<T>(path: string, body?: unknown): Promise<T> {
  const headers = await authHeaders();
  if (!headers) throw new Error('Sessão expirada — faz login novamente.');
  const r = await fetch(`${olefootApiBase()}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = (await r.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;
  if (!r.ok || !data || data.ok === false) {
    throw new Error(data?.error ?? 'Não foi possível concluir a operação.');
  }
  return data as T;
}

/** Snapshot de vitrine que o servidor guarda no anúncio. */
export interface VitrinePlayer {
  id: string;
  name: string;
  pos: string;
  age: number | null;
  rarity: string | null;
  attrs: Record<string, number>;
  mintOverall: number | null;
  marketValueBroCents: number | null;
}

export interface VitrineTeam {
  jogadores: number;
  destaques: { name: string; pos: string }[];
  refOlefoot: string | null;
}

export interface SquadListing {
  id: string;
  kind: 'player' | 'team';
  mine: boolean;
  seller: { username: string | null; club: string | null };
  gamePlayerId: string | null;
  player: VitrinePlayer | null;
  team: VitrineTeam | null;
  /** OLEFOOT inteiro, como string (numeric(78,0) do banco). */
  priceOlefoot: string;
  refOlefoot: string | null;
  createdAt: string;
}

export interface MeuAnuncio {
  id: string;
  kind: 'player' | 'team';
  gamePlayerId: string | null;
  player: VitrinePlayer | null;
  team: VitrineTeam | null;
  priceOlefoot: string;
  createdAt: string;
}

export interface VendaNaoAplicada {
  id: string;
  kind: 'player' | 'team';
  gamePlayerId: string | null;
  player: VitrinePlayer | null;
  team: VitrineTeam | null;
  priceOlefoot: string;
  buyerClub: string;
  soldAt: string | null;
}

export const fetchVitrine = () =>
  chamar<{ ok: true; listings: SquadListing[] }>('/api/squad-market/listings').then((r) => r.listings);

export const fetchMeusAnuncios = () =>
  chamar<{ ok: true; ativos: MeuAnuncio[]; vendidosNaoAplicados: VendaNaoAplicada[] }>('/api/squad-market/mine');

export const anunciarJogador = (playerId: string, priceOlefoot: number) =>
  chamar<{ ok: true; listingId: string }>('/api/squad-market/list', { playerId, priceOlefoot });

export const anunciarTime = (priceOlefoot: number) =>
  chamar<{ ok: true; listingId: string }>('/api/squad-market/list-team', { priceOlefoot });

export const cancelarAnuncio = (listingId: string) =>
  chamar<{ ok: true }>('/api/squad-market/unlist', { listingId });

/** Compra: o servidor liquida o OLEFOOT e devolve os jogadores ENTREGUES (vivos). */
export const comprarAnuncio = (listingId: string) =>
  chamar<{ ok: true; players: PlayerEntity[]; priceOlefoot: string; kind: 'player' | 'team' }>(
    '/api/squad-market/buy',
    { listingId },
  );

export const confirmarVendasAplicadas = (listingIds: string[]) =>
  chamar<{ ok: true }>('/api/squad-market/ack-sold', { listingIds });
