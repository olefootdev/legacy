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
 * Aplica deltas de `spotBroCents` / `spotExpBalance` do wallet sobre `finance`
 * (mantém `broCents` / `ole` alinhados com o hub da carteira).
 */
export function mergeWalletIntoFinance(prev: FinanceState, wallet: WalletState): FinanceState {
  const prevW = prev.wallet;
  const broDelta = wallet.spotBroCents - (prevW?.spotBroCents ?? 0);
  const expDelta = wallet.spotExpBalance - (prevW?.spotExpBalance ?? 0);
  let nextFin: FinanceState = {
    ...prev,
    broCents: prev.broCents + broDelta,
    ole: prev.ole + expDelta,
    wallet,
  };
  if (expDelta > 0) {
    nextFin = {
      ...nextFin,
      expLifetimeEarned: (nextFin.expLifetimeEarned ?? 0) + expDelta,
    };
    nextFin = appendExpHistory(nextFin, expDelta, 'Game Assets Treasury (diário)');
  } else if (expDelta < 0) {
    nextFin = appendExpHistory(nextFin, expDelta, 'Carteira (ajuste EXP)');
  }
  return nextFin;
}
