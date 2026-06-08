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

/**
 * Source whitelisteado no RPC `spend_olefoot`. Pra adicionar nova categoria,
 * atualizar `v_allowed_sources` na migration 20260608100000_spend_olefoot_rpc.sql.
 */
export type OlefootSpendSource = 'renovacao_contrato';

export interface SpendOlefootResult {
  ok: true;
  newBalance: number;
}

export interface SpendOlefootError {
  ok: false;
  code: 'INSUFFICIENT_BALANCE' | 'INVALID_SOURCE' | 'INVALID_AMOUNT' | 'NOT_AUTHENTICATED' | 'UNKNOWN';
  message: string;
}

/**
 * Debita OLEFOOT do user autenticado. Server valida saldo, faz lock atômico
 * e escreve no ledger. Retorna novo saldo em caso de sucesso.
 *
 * Idempotência: NÃO é idempotente. Caller responsável por não chamar 2x
 * pra mesma intent (ex.: desabilitar botão durante async, usar source_ref).
 */
export async function spendMyOlefoot(args: {
  amount: number;
  source: OlefootSpendSource;
  sourceRef?: string;
}): Promise<SpendOlefootResult | SpendOlefootError> {
  const sb = getSupabase();
  if (!sb) {
    return { ok: false as const, code: 'NOT_AUTHENTICATED', message: 'Sem sessão Supabase.' };
  }

  const { data, error } = await sb.rpc('spend_olefoot', {
    p_amount: args.amount,
    p_source: args.source,
    p_source_ref: args.sourceRef ?? null,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('INSUFFICIENT_OLEXP_BALANCE')) {
      return { ok: false as const, code: 'INSUFFICIENT_BALANCE', message: 'Saldo OLEFOOT insuficiente.' };
    }
    if (msg.includes('INVALID_SOURCE')) {
      return { ok: false as const, code: 'INVALID_SOURCE', message: 'Origem não autorizada.' };
    }
    if (msg.includes('INVALID_AMOUNT')) {
      return { ok: false as const, code: 'INVALID_AMOUNT', message: 'Valor inválido.' };
    }
    if (msg.includes('NOT_AUTHENTICATED')) {
      return { ok: false as const, code: 'NOT_AUTHENTICATED', message: 'Faça login.' };
    }
    return { ok: false as const, code: 'UNKNOWN', message: msg || 'Erro ao gastar OLEFOOT.' };
  }

  return { ok: true as const, newBalance: Number(data ?? 0) };
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
