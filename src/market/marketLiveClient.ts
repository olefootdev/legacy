/**
 * Client do MERCADO AO VIVO — ticker, OLE-100, índice, leilão do MVP, cotas
 * de clube e salário (yield). Tudo fala DIRETO com o Supabase: as funções são
 * `authenticated` com as regras no banco (migrations 20261001200000/210000) —
 * não há decisão de preço no cliente.
 */
import { getSupabase } from '@/supabase/client';
import type { PlayerEntity } from '@/entities/types';

const linha = <T>(data: unknown): T | null => (Array.isArray(data) ? (data[0] as T) : (data as T)) ?? null;

// ─── snapshots (a fundação LIVE) ─────────────────────────────────────────────

export interface SnapshotDeValor {
  gamePlayerId: string;
  name: string;
  pos: string;
  ovr: number;
  marketBroCents: number;
  rating: number | null;
  source: 'match' | 'training' | 'checkpoint' | 'sale';
}

/**
 * Empurra os valores pro servidor (fire-and-forget). É isto que alimenta o
 * ticker, o OLE-100 e o SALÁRIO — o yield é pago em cima destes registros,
 * com teto no banco.
 */
export async function pushValueSnapshots(rows: SnapshotDeValor[]): Promise<void> {
  const sb = getSupabase();
  if (!sb || rows.length === 0) return;
  const { data: sess } = await sb.auth.getUser();
  const uid = sess.user?.id;
  if (!uid) return;
  await sb.from('player_value_snapshots').insert(
    rows.slice(0, 40).map((r) => ({
      user_id: uid,
      game_player_id: r.gamePlayerId,
      name: r.name,
      pos: r.pos,
      ovr: Math.round(r.ovr),
      market_bro_cents: Math.max(0, Math.round(r.marketBroCents)),
      rating: r.rating == null ? null : Number(r.rating.toFixed(2)),
      source: r.source,
    })),
  );
}

/** Snapshot de jogadores, pronto pro push (usado pós-jogo e no checkpoint). */
export function snapshotRows(
  players: PlayerEntity[],
  opts: { source: SnapshotDeValor['source']; ratingDe?: (id: string) => number | null; ovrDe: (p: PlayerEntity) => number; valorDe: (p: PlayerEntity) => number },
): SnapshotDeValor[] {
  return players.map((p) => ({
    gamePlayerId: p.id,
    name: p.name,
    pos: p.pos,
    ovr: opts.ovrDe(p),
    marketBroCents: opts.valorDe(p),
    rating: opts.ratingDe ? opts.ratingDe(p.id) : null,
    source: opts.source,
  }));
}

// ─── ticker + índice ─────────────────────────────────────────────────────────

export interface TickerItem {
  gamePlayerId: string;
  name: string;
  pos: string;
  ovr: number;
  marketBroCents: number;
  deltaCents: number;
  deltaPct: number | null;
  source: string;
  at: string;
  dono: string | null;
}

export async function lerTicker(limite = 40): Promise<TickerItem[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('market_ticker', { p_limite: limite });
  if (error || !Array.isArray(data)) return [];
  return data.map((r: Record<string, unknown>) => ({
    gamePlayerId: String(r.game_player_id),
    name: String(r.name),
    pos: String(r.pos ?? ''),
    ovr: Number(r.ovr),
    marketBroCents: Number(r.market_bro_cents),
    deltaCents: Number(r.delta_cents),
    deltaPct: r.delta_pct == null ? null : Number(r.delta_pct),
    source: String(r.source),
    at: String(r.at),
    dono: (r.dono as string | null) ?? null,
  }));
}

export interface Ole100Item {
  gamePlayerId: string;
  name: string;
  pos: string;
  ovr: number;
  marketBroCents: number;
  delta24hCents: number;
  dono: string | null;
}

export async function lerOle100(): Promise<Ole100Item[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('ole100', { p_limite: 100 });
  if (error || !Array.isArray(data)) return [];
  return data.map((r: Record<string, unknown>) => ({
    gamePlayerId: String(r.game_player_id),
    name: String(r.name),
    pos: String(r.pos ?? ''),
    ovr: Number(r.ovr),
    marketBroCents: Number(r.market_bro_cents),
    delta24hCents: Number(r.delta24h_cents ?? 0),
    dono: (r.dono as string | null) ?? null,
  }));
}

export async function lerIndiceHistorico(horas = 72): Promise<{ at: string; indiceBroCents: number }[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('ole100_history')
    .select('at, indice_bro_cents')
    .gt('at', new Date(Date.now() - horas * 3_600_000).toISOString())
    .order('at', { ascending: true })
    .limit(200);
  if (error || !Array.isArray(data)) return [];
  return data.map((r) => ({ at: String(r.at), indiceBroCents: Number(r.indice_bro_cents) }));
}

// ─── leilão do MVP ───────────────────────────────────────────────────────────

export interface MvpAuction {
  id: string;
  dia: string;
  playerName: string;
  player: Record<string, unknown>;
  minBidOlefoot: string;
  bidOlefoot: string | null;
  souOMaior: boolean;
  startsAt: string;
  endsAt: string;
  status: 'open' | 'settled' | 'void';
}

/** O leilão mais recente (aberto ou o último encerrado, pro placar). */
export async function lerLeilaoMvp(): Promise<MvpAuction | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const [{ data }, { data: sess }] = await Promise.all([
    sb.from('mvp_auctions')
      .select('id, dia, player_name, player_snapshot, min_bid_olefoot, bid_olefoot, bidder_user_id, starts_at, ends_at, status')
      .order('dia', { ascending: false })
      .limit(1),
    sb.auth.getUser(),
  ]);
  const r = Array.isArray(data) ? data[0] : null;
  if (!r) return null;
  return {
    id: String(r.id),
    dia: String(r.dia),
    playerName: String(r.player_name),
    player: (r.player_snapshot ?? {}) as Record<string, unknown>,
    minBidOlefoot: String(r.min_bid_olefoot),
    bidOlefoot: r.bid_olefoot == null ? null : String(r.bid_olefoot),
    souOMaior: r.bidder_user_id != null && r.bidder_user_id === sess.user?.id,
    startsAt: String(r.starts_at),
    endsAt: String(r.ends_at),
    status: String(r.status) as MvpAuction['status'],
  };
}

export async function darLanceMvp(auctionId: string, valor: number): Promise<{ ok: boolean; motivo: string | null; minimo: number | null }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, motivo: 'erro', minimo: null };
  const { data, error } = await sb.rpc('mvp_bid', { p_auction: auctionId, p_valor: valor });
  const r = linha<{ ok: boolean; motivo: string | null; minimo: string | null }>(data);
  if (error || !r) return { ok: false, motivo: 'erro', minimo: null };
  return { ok: r.ok === true, motivo: r.motivo ?? null, minimo: r.minimo == null ? null : Number(r.minimo) };
}

// ─── empréstimo: opção de compra (não move plantel — o jogador já está contigo) ─

export async function exercerOpcaoDeCompra(loanId: string): Promise<{ ok: boolean; motivo: string | null; price: number | null }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, motivo: 'erro', price: null };
  const { data, error } = await sb.rpc('squad_loan_buyout', { p_loan: loanId });
  const r = linha<{ ok: boolean; motivo: string | null; price: string | null }>(data);
  if (error || !r) return { ok: false, motivo: 'erro', price: null };
  return { ok: r.ok === true, motivo: r.motivo ?? null, price: r.price == null ? null : Number(r.price) };
}

// ─── salário (yield) ─────────────────────────────────────────────────────────

export async function reivindicarSalario(): Promise<{ ok: boolean; pago: number; atuacoesHoje: number; teto: number }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, pago: 0, atuacoesHoje: 0, teto: 30 };
  const { data, error } = await sb.rpc('yield_reivindicar');
  const r = linha<{ ok: boolean; pago: string; atuacoes_hoje: number; teto: number }>(data);
  if (error || !r) return { ok: false, pago: 0, atuacoesHoje: 0, teto: 30 };
  return { ok: r.ok === true, pago: Number(r.pago ?? 0), atuacoesHoje: Number(r.atuacoes_hoje ?? 0), teto: Number(r.teto ?? 30) };
}

// ─── cotas de clube ──────────────────────────────────────────────────────────

export interface OfertaDeCota {
  id: string;
  ownerUserId: string;
  percentBps: number;
  priceOlefoot: string;
  mine: boolean;
  createdAt: string;
}

export async function lerOfertasDeCotas(): Promise<OfertaDeCota[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const [{ data }, { data: sess }] = await Promise.all([
    sb.from('club_share_offers')
      .select('id, owner_user_id, percent_bps, price_olefoot, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(60),
    sb.auth.getUser(),
  ]);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    ownerUserId: String(r.owner_user_id),
    percentBps: Number(r.percent_bps),
    priceOlefoot: String(r.price_olefoot),
    mine: r.owner_user_id === sess.user?.id,
    createdAt: String(r.created_at),
  }));
}

export async function lerMinhasCotas(): Promise<{ comoDono: { holder: string; bps: number }[]; comoCotista: { owner: string; bps: number }[] }> {
  const sb = getSupabase();
  if (!sb) return { comoDono: [], comoCotista: [] };
  const { data: sess } = await sb.auth.getUser();
  const uid = sess.user?.id;
  if (!uid) return { comoDono: [], comoCotista: [] };
  const { data } = await sb.from('club_shares').select('owner_user_id, holder_user_id, percent_bps');
  const linhas = data ?? [];
  return {
    comoDono: linhas.filter((r) => r.owner_user_id === uid).map((r) => ({ holder: String(r.holder_user_id), bps: Number(r.percent_bps) })),
    comoCotista: linhas.filter((r) => r.holder_user_id === uid).map((r) => ({ owner: String(r.owner_user_id), bps: Number(r.percent_bps) })),
  };
}

export async function lerDividendos(limite = 20): Promise<{ olefoot: string; at: string; souHolder: boolean }[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data: sess } = await sb.auth.getUser();
  const { data } = await sb
    .from('club_share_dividends')
    .select('holder_user_id, olefoot, at')
    .order('at', { ascending: false })
    .limit(limite);
  return (data ?? []).map((r) => ({
    olefoot: String(r.olefoot),
    at: String(r.at),
    souHolder: r.holder_user_id === sess.user?.id,
  }));
}

export async function ofertarCotas(bps: number, priceOlefoot: number): Promise<{ ok: boolean; motivo: string | null }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, motivo: 'erro' };
  const { data, error } = await sb.rpc('club_share_ofertar', { p_bps: bps, p_price: priceOlefoot });
  const r = linha<{ ok: boolean; motivo: string | null }>(data);
  if (error || !r) return { ok: false, motivo: 'erro' };
  return { ok: r.ok === true, motivo: r.motivo ?? null };
}

export async function cancelarOfertaDeCotas(offerId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data, error } = await sb.rpc('club_share_cancelar', { p_offer: offerId });
  return !error && data === true;
}

export async function comprarCotas(offerId: string): Promise<{ ok: boolean; motivo: string | null; percentBps: number | null }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, motivo: 'erro', percentBps: null };
  const { data, error } = await sb.rpc('club_share_comprar', { p_offer: offerId });
  const r = linha<{ ok: boolean; motivo: string | null; percent_bps: number | null }>(data);
  if (error || !r) return { ok: false, motivo: 'erro', percentBps: null };
  return { ok: r.ok === true, motivo: r.motivo ?? null, percentBps: r.percent_bps == null ? null : Number(r.percent_bps) };
}
