/**
 * Affiliate Commissions — cliente Supabase.
 *
 * Super-Bônus de Depósito: 5% L1 + 5% L2 + 5% L3 sobre cada wallet_credit
 * confirmado (applied_at ≠ null). Backend: migration 20260527000100.
 *
 * Convive com o sistema antigo `referral_exp_commissions` (que só conta
 * comissão sobre EXP ganho em match/compra). Esse aqui cobre DEPÓSITOS.
 */

import { getSupabase } from '@/supabase/client';

export type CommissionCurrency = 'BRO' | 'EXP' | 'OLEXP' | 'USDT' | 'USD';
export type CommissionLevel = 1 | 2 | 3;

export interface AffiliateCommissionSummary {
  level: CommissionLevel;
  currency: CommissionCurrency;
  totalPendingCents: number;
  totalClaimedCents: number;
  entryCount: number;
}

export interface ClaimResult {
  currency: CommissionCurrency;
  totalCents: number;
}

export async function fetchMyAffiliateCommissions(): Promise<AffiliateCommissionSummary[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb.rpc('get_my_affiliate_commissions');
  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => ({
    level: Number(row.level) as CommissionLevel,
    currency: row.currency as CommissionCurrency,
    totalPendingCents: Number(row.total_pending_cents ?? 0),
    totalClaimedCents: Number(row.total_claimed_cents ?? 0),
    entryCount: Number(row.entry_count ?? 0),
  }));
}

export async function claimMyAffiliateCommissions(
  currency?: CommissionCurrency,
): Promise<ClaimResult[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb.rpc('claim_my_affiliate_commissions', {
    p_currency: currency ?? null,
  });
  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => ({
    currency: row.currency as CommissionCurrency,
    totalCents: Number(row.total_cents ?? 0),
  }));
}

/** Agrega por currency: { BRO: pending, EXP: pending, ... } */
export function totalPendingByCurrency(
  summaries: AffiliateCommissionSummary[],
): Record<CommissionCurrency, number> {
  const out: Partial<Record<CommissionCurrency, number>> = {};
  for (const s of summaries) {
    out[s.currency] = (out[s.currency] ?? 0) + s.totalPendingCents;
  }
  return out as Record<CommissionCurrency, number>;
}

export function totalPendingByLevel(
  summaries: AffiliateCommissionSummary[],
): Record<CommissionLevel, number> {
  const out: Record<CommissionLevel, number> = { 1: 0, 2: 0, 3: 0 };
  for (const s of summaries) {
    if (s.currency === 'BRO' || s.currency === 'USDT' || s.currency === 'USD') {
      out[s.level] += s.totalPendingCents;
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Breakdown por indicado — pra mostrar "ganhos vindos deste user" no card
// e modal de detalhe (Eye view).
// ─────────────────────────────────────────────────────────────────────────

export interface AffiliateCommissionEntry {
  id: string;
  referredId: string;
  level: CommissionLevel;
  source: string;
  currency: CommissionCurrency;
  amountCents: number;
  status: 'pending' | 'confirmed' | 'reversed';
  claimedAt: string | null;
  createdAt: string;
}

export interface ReferredCommissionTotals {
  /** EXP comissão (pending + claimed) */
  expCents: number;
  expPending: number;
  /** USDT-equivalente (BRO/USDT/USD), em cents */
  usdCents: number;
  usdPending: number;
  /** Quantidade total de eventos */
  entries: number;
}

/**
 * Retorna comissões granulares (1 row por evento) do referrer atual,
 * filtrável por referredId. Usado pelo modal "Eye view".
 *
 * RLS já permite SELECT onde referrer_id = auth.uid().
 */
export async function fetchAffiliateCommissionEntries(
  referredId?: string,
): Promise<AffiliateCommissionEntry[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  let query = sb
    .from('affiliate_commissions')
    .select('id, referred_id, level, source, currency, amount_cents, status, claimed_at, created_at')
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false });

  if (referredId) query = query.eq('referred_id', referredId);

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    referredId: row.referred_id as string,
    level: Number(row.level) as CommissionLevel,
    source: row.source as string,
    currency: row.currency as CommissionCurrency,
    amountCents: Number(row.amount_cents ?? 0),
    status: (row.status ?? 'confirmed') as 'pending' | 'confirmed' | 'reversed',
    claimedAt: (row.claimed_at ?? null) as string | null,
    createdAt: row.created_at as string,
  }));
}

/** Agrega comissões por referredId — usado nos cards. */
export function groupCommissionsByReferred(
  entries: AffiliateCommissionEntry[],
): Map<string, ReferredCommissionTotals> {
  const out = new Map<string, ReferredCommissionTotals>();

  for (const e of entries) {
    if (e.status !== 'confirmed') continue;

    const cur = out.get(e.referredId) ?? {
      expCents: 0,
      expPending: 0,
      usdCents: 0,
      usdPending: 0,
      entries: 0,
    };

    if (e.currency === 'EXP') {
      cur.expCents += e.amountCents;
      if (e.claimedAt == null) cur.expPending += e.amountCents;
    } else if (e.currency === 'BRO' || e.currency === 'USDT' || e.currency === 'USD') {
      cur.usdCents += e.amountCents;
      if (e.claimedAt == null) cur.usdPending += e.amountCents;
    }

    cur.entries += 1;
    out.set(e.referredId, cur);
  }

  return out;
}
