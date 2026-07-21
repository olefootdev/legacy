import type { FinanceState } from '@/entities/types';
import { createInitialWalletState } from './initial';
import { appendLedger } from './ledger';
import type { WalletCurrencyExt, WalletLedgerType } from './types';

/**
 * Emissão de ledger da wallet a partir das ações do jogo.
 *
 * O extrato (/wallet/extract) sempre soube FILTRAR os 8 tipos de entry, mas só
 * REFERRAL_* era produzido — os outros 6 nunca apareciam. Este helper é o ponto
 * único que o reducer usa pra registrar compra, venda, recompensa de partida,
 * upgrade de estrutura e operações de exchange no ledger.
 *
 * Só registra o histórico (não mexe em saldo — finance.ole/broCents continuam
 * sendo a fonte de saldo; o ledger é o espelho auditável).
 */
export function financeWithLedger(
  finance: FinanceState,
  entry: {
    type: WalletLedgerType;
    currency: WalletCurrencyExt;
    /** Positivo = crédito, negativo = débito. */
    amount: number;
    source: string;
    refId?: string;
    metadata?: Record<string, unknown>;
  },
): FinanceState {
  if (!entry.amount) return finance;
  const wallet = finance.wallet ?? createInitialWalletState();
  return {
    ...finance,
    wallet: appendLedger(wallet, {
      userId: 'self',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      ...entry,
    }),
  };
}
