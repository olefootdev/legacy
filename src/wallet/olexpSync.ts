/**
 * OLEXP Sync — bridge entre balance server-side (Supabase olexp_balances)
 * e WalletState Zustand (client).
 *
 * Source of truth: SERVIDOR.
 * Cliente apenas reflete. Qualquer divergência → server wins.
 */

import { getSupabase } from '@/supabase/client';

export interface OlexpLedgerEntry {
  id: string;
  delta: number;
  balanceAfter: number;
  source: string;
  sourceRef: string | null;
  createdAt: string;
}

/** Saldo OLEXP atual do user autenticado. Retorna 0 se sem sessão. */
export async function fetchMyOlexpBalance(): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;

  const { data, error } = await sb.rpc('get_my_olexp_balance');
  if (error || data == null) return 0;
  return Number(data);
}

/** Histórico de movimentos OLEXP — usado em UI de auditoria. */
export async function fetchMyOlexpLedger(limit = 50): Promise<OlexpLedgerEntry[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb.rpc('get_my_olexp_ledger', { p_limit: limit });
  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    delta: Number(row.delta),
    balanceAfter: Number(row.balance_after),
    source: row.source as string,
    sourceRef: (row.source_ref ?? null) as string | null,
    createdAt: row.created_at as string,
  }));
}
