/**
 * PLAYERVIP — cliente das ações do atleta (saque / suporte / nova coleção).
 *
 * As LEITURAS do painel reusam módulos já existentes:
 *   - vendas:     @/supabase/proPayouts        (getMyProSummary / getMyProPayouts / subscribeMyProPayouts)
 *   - coleções:   @/admin/playerLinking        (getMyLinkedCards)
 *   - comissões:  @/wallet/affiliateCommissions (fetchMyAffiliateCommissions)
 *   - indicados:  @/supabase/referrals         (fetchMyReferrals / fetchMyReferralCode)
 *   - saldo OLEXP:@/wallet/olexpSync
 *
 * Backend das ações: migration 20260712120000_playervip_requests.sql.
 */

import { getSupabase } from '@/supabase/client';

export type WithdrawalStatus = 'pending' | 'approved' | 'paid' | 'rejected';
export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

export interface WithdrawalRow {
  id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  pix_key: string;
  pix_key_type: PixKeyType;
  status: WithdrawalStatus;
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

/** Cria um pedido de saque (aprovação manual). Exige KYC aprovado no servidor. */
export async function requestWithdrawal(params: {
  amountCents: number;
  pixKey: string;
  pixKeyType?: PixKeyType;
  note?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Serviço indisponível.' };
  const { data, error } = await sb.rpc('request_withdrawal', {
    p_amount_cents: Math.round(params.amountCents),
    p_pix_key: params.pixKey,
    p_pix_key_type: params.pixKeyType ?? 'cpf',
    p_note: params.note ?? null,
  });
  if (error) return { ok: false, error: mapError(error.message) };
  return { ok: true, id: data as string };
}

export async function getMyWithdrawals(): Promise<WithdrawalRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('get_my_withdrawals');
  if (error) {
    console.warn('[playerVip] get_my_withdrawals:', error.message);
    return [];
  }
  return (data ?? []) as WithdrawalRow[];
}

/** Envia mensagem de suporte para a OLEFOOT. */
export async function sendSupportMessage(params: {
  subject?: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Serviço indisponível.' };
  const { error } = await sb.rpc('send_support_message', {
    p_subject: params.subject ?? 'Suporte',
    p_body: params.body,
  });
  if (error) return { ok: false, error: mapError(error.message) };
  return { ok: true };
}

/** Solicita a criação de uma nova coleção de cards (aprovação do atleta). */
export async function requestNewCollection(params: {
  athleteName: string;
  notes?: string;
  referredName?: string;
  referredContact?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Serviço indisponível.' };
  const { error } = await sb.rpc('request_new_collection', {
    p_athlete_name: params.athleteName,
    p_notes: params.notes ?? null,
    p_referred_name: params.referredName ?? null,
    p_referred_contact: params.referredContact ?? null,
  });
  if (error) return { ok: false, error: mapError(error.message) };
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────
// PONTE 1/2/4 — leituras autoritativas de venda, saldo sacável e curtidas
// (migration 20260712130000_playervip_bridges.sql)
// ─────────────────────────────────────────────────────────────────────────

export interface CardSaleRow {
  id: string;
  legacy_player_id: string;
  collection_id: string | null;
  buyer_user_id: string | null;
  currency: 'BRO' | 'OLEFOOT' | string;
  gross_cents: number;
  owner_cents: number;
  payment_method: 'pix' | 'olefoot' | string;
  role: 'player' | 'facilitator' | string;
  created_at: string;
}

export interface CardSalesSummary {
  totalSales: number;
  broOwnerCents: number;
  olefootOwnerCents: number;
  facilitatorSales: number;
  facilitatorBroCents: number;
  lastSaleAt: string | null;
}

/** Vendas dos cards do atleta (fonte canônica: card_sales, PIX + OLEFOOT). */
export async function getMyCardSales(limit = 50): Promise<CardSaleRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('get_my_card_sales', { p_limit: limit });
  if (error) { console.warn('[playerVip] get_my_card_sales:', error.message); return []; }
  return (data ?? []) as CardSaleRow[];
}

export async function getMyCardSalesSummary(): Promise<CardSalesSummary> {
  const sb = getSupabase();
  const empty: CardSalesSummary = { totalSales: 0, broOwnerCents: 0, olefootOwnerCents: 0, facilitatorSales: 0, facilitatorBroCents: 0, lastSaleAt: null };
  if (!sb) return empty;
  const { data, error } = await sb.rpc('get_my_card_sales_summary');
  if (error) { console.warn('[playerVip] card_sales_summary:', error.message); return empty; }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return empty;
  return {
    totalSales: Number(row.total_sales ?? 0),
    broOwnerCents: Number(row.bro_owner_cents ?? 0),
    olefootOwnerCents: Number(row.olefoot_owner_cents ?? 0),
    facilitatorSales: Number(row.facilitator_sales ?? 0),
    facilitatorBroCents: Number(row.facilitator_bro_cents ?? 0),
    lastSaleAt: row.last_sale_at ?? null,
  };
}

/** Saldo sacável em R$ (BRO cents), autoritativo no servidor. */
export async function getMyWithdrawableBalance(): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const { data, error } = await sb.rpc('get_my_withdrawable_balance');
  if (error || data == null) return 0;
  return Number(data);
}

/** Total de curtidas somando todos os cards do atleta. */
export async function getMyCollectionLikes(): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const { data, error } = await sb.rpc('get_my_collection_likes');
  if (error || data == null) return 0;
  return Number(data);
}

/** Curte/descurte um card. Retorna estado + contagem novos. */
export async function toggleLegendLike(legacyPlayerId: string): Promise<{ liked: boolean; count: number } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('toggle_legend_like', { p_legacy_player_id: legacyPlayerId });
  if (error) { console.warn('[playerVip] toggle_legend_like:', error.message); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { liked: Boolean(row.liked), count: Number(row.like_count ?? 0) };
}

export async function getLegendLikeCount(legacyPlayerId: string): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const { data, error } = await sb.rpc('get_legend_like_count', { p_legacy_player_id: legacyPlayerId });
  if (error || data == null) return 0;
  return Number(data);
}

/** Realtime: novas vendas de card do atleta. Retorna cleanup. */
export function subscribeMyCardSales(
  beneficiaryUserId: string,
  onInsert: (row: CardSaleRow) => void,
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(`card_sales:${beneficiaryUserId}`)
    .on(
      'postgres_changes' as unknown as 'system',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'card_sales',
        filter: `beneficiary_user_id=eq.${beneficiaryUserId}`,
      } as unknown as Record<string, never>,
      (payload: { new: CardSaleRow }) => onInsert(payload.new),
    )
    .subscribe();
  return () => { try { sb.removeChannel(channel); } catch { /* noop */ } };
}

/** Traduz erros técnicos do backend em copy amigável pra lenda. */
function mapError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('não verificada') || m.includes('nao verificada')) {
    return 'Sua conta ainda não está verificada. Fale com a OLEFOOT para liberar saques.';
  }
  if (m.includes('saldo insuficiente')) return 'Valor acima do seu saldo disponível para saque.';
  if (m.includes('authenticated')) return 'Sua sessão expirou. Entre novamente.';
  if (m.includes('function') && m.includes('does not exist')) {
    return 'Este recurso está sendo ativado. Tente novamente em instantes.';
  }
  return 'Não foi possível concluir agora. Tente novamente.';
}
