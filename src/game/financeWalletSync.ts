import type { FinanceState } from '@/entities/types';
import type { WalletState } from '@/wallet/types';

function appendExpHistory(finance: FinanceState, amount: number, source: string): FinanceState {
  if (!amount) return finance;
  const next = [
    {
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      amount: Math.round(amount),
      source,
      createdAt: new Date().toISOString(),
    },
    ...(finance.expHistory ?? []),
  ].slice(0, 120);
  return { ...finance, expHistory: next };
}

/**
 * Aplica deltas de `spotBroCents` / `spotExpBalance` do wallet sobre `finance`.
 *
 * Deltas positivos (crédito) só são aceitos quando `fromServer = true` —
 * isso impede que valores inflados no localStorage sejam convertidos em saldo real.
 * Deltas negativos (gasto confirmado pelo cliente) sempre são aplicados.
 */
export function mergeWalletIntoFinance(
  prev: FinanceState,
  wallet: WalletState,
  fromServer = false,
): FinanceState {
  const prevW = prev.wallet;
  const broDelta = wallet.spotBroCents - (prevW?.spotBroCents ?? 0);
  const expDelta = wallet.spotExpBalance - (prevW?.spotExpBalance ?? 0);

  const safeBreDelta = broDelta > 0 && !fromServer ? 0 : broDelta;
  const safeExpDelta = expDelta > 0 && !fromServer ? 0 : expDelta;

  let nextFin: FinanceState = {
    ...prev,
    broCents: Math.max(0, prev.broCents + safeBreDelta),
    ole: Math.max(0, prev.ole + safeExpDelta),
    wallet,
  };
  if (safeExpDelta > 0) {
    nextFin = {
      ...nextFin,
      expLifetimeEarned: (nextFin.expLifetimeEarned ?? 0) + safeExpDelta,
    };
    nextFin = appendExpHistory(nextFin, safeExpDelta, 'Game Assets Treasury (diário)');
  } else if (safeExpDelta < 0) {
    nextFin = appendExpHistory(nextFin, safeExpDelta, 'Carteira (ajuste EXP)');
  }
  return nextFin;
}
