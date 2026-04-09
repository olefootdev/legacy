/**
 * Wallet Ledger — operações imutáveis sobre o array de ledger entries.
 */

import type {
  WalletState,
  WalletLedgerEntry,
  WalletLedgerType,
  WalletCurrencyExt,
  LedgerFilter,
  LedgerStatus,
} from './types';

let _seqCounter = 0;

export function generateLedgerId(): string {
  return `wl-${Date.now()}-${(++_seqCounter).toString(36)}`;
}

/**
 * Append imutável. Rejeita duplicatas por refId+createdAt (idempotência).
 */
export function appendLedger(
  state: WalletState,
  entry: Omit<WalletLedgerEntry, 'id'> & { id?: string },
): WalletState {
  const id = entry.id || generateLedgerId();
  const prevLedger = Array.isArray(state.ledger) ? state.ledger : [];

  if (entry.refId) {
    const dup = prevLedger.some(
      (e) => e.refId === entry.refId && e.createdAt === entry.createdAt,
    );
    if (dup) return state;
  }

  const full: WalletLedgerEntry = { ...entry, id };
  return { ...state, ledger: [...prevLedger, full] };
}

/**
 * Filtra ledger por critérios combinados.
 */
export function queryLedger(
  state: WalletState,
  filter: LedgerFilter,
): WalletLedgerEntry[] {
  const entries = Array.isArray(state.ledger) ? state.ledger : [];
  return entries.filter((e) => {
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      if (!types.includes(e.type)) return false;
    }
    if (filter.currency && e.currency !== filter.currency) return false;
    if (filter.status && e.status !== filter.status) return false;
    if (filter.fromDate && e.createdAt < filter.fromDate) return false;
    if (filter.toDate && e.createdAt > filter.toDate) return false;
    return true;
  });
}

/**
 * Soma de amounts filtrados por tipo e moeda (só confirmed).
 */
export function balanceByType(
  state: WalletState,
  type: WalletLedgerType | WalletLedgerType[],
  currency: WalletCurrencyExt,
  status: LedgerStatus = 'confirmed',
): number {
  const types = Array.isArray(type) ? type : [type];
  const entries = Array.isArray(state.ledger) ? state.ledger : [];
  return entries
    .filter((e) => types.includes(e.type) && e.currency === currency && e.status === status)
    .reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Últimas N entries (mais recentes primeiro).
 */
export function recentLedger(state: WalletState, limit = 10): WalletLedgerEntry[] {
  const entries = Array.isArray(state.ledger) ? state.ledger : [];
  return [...entries]
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, limit);
}
