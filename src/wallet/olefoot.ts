/**
 * OLEFOOT — a moeda do jogo, lado cliente.
 *
 * Fonte da verdade: `legacy_olefoot_credits` no Supabase — a MESMA tabela que a
 * Wallet exibe como "OLEFOOT" e que `/api/market/buy-legacy` debita ao comprar
 * card. O cliente só reflete; qualquer divergência, o servidor ganha.
 *
 * Histórico: até 2026-07-16 o gasto passava por `spend_olefoot` → `olexp_balances`,
 * uma tabela DIFERENTE da exibida. Renovar contrato gastava um saldo invisível.
 * OLEXP foi removido e o gasto repontado pra cá, então tela e débito falam do
 * mesmo saldo.
 *
 * Nota: só usuários migrados do v1 têm linha em `legacy_olefoot_credits` — quem
 * entrou no v11 tem saldo 0. Isso já valia pra compra de card e agora vale
 * também pra renovação de contrato.
 */

import { getSupabase } from '@/supabase/client';

/** Saldo OLEFOOT do usuário autenticado (unidades inteiras). 0 se sem sessão/linha. */
export async function fetchMyOlefootBalance(): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return 0;

  const { data, error } = await sb
    .from('legacy_olefoot_credits')
    .select('balance_human')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data?.balance_human) return 0;
  // balance_human é texto com até 18 casas ("116130125.17740472"). O jogo gasta
  // em unidade inteira, igual ao buy-legacy.
  const intPart = String(data.balance_human).split('.')[0] ?? '0';
  const n = Number(intPart);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Source whitelisteado no RPC `spend_legacy_olefoot`. Pra adicionar categoria,
 * atualize `v_allowed_sources` na migration 20260716120000_spend_legacy_olefoot.sql.
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
 * Debita OLEFOOT do usuário autenticado. O servidor valida saldo e faz o lock
 * atômico da linha. Retorna o novo saldo em caso de sucesso.
 *
 * Idempotência: NÃO é idempotente. O caller é responsável por não chamar 2x pra
 * mesma ação (ex.: desabilitar o botão durante o async).
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

  const { data, error } = await sb.rpc('spend_legacy_olefoot', {
    p_amount: args.amount,
    p_source: args.source,
    p_source_ref: args.sourceRef ?? null,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('INSUFFICIENT_OLEFOOT_BALANCE')) {
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
    if (msg.includes('function') && msg.includes('does not exist')) {
      return { ok: false as const, code: 'UNKNOWN', message: 'Recurso sendo ativado. Tente em instantes.' };
    }
    return { ok: false as const, code: 'UNKNOWN', message: msg || 'Erro ao gastar OLEFOOT.' };
  }

  return { ok: true as const, newBalance: Number(data ?? 0) };
}
