import type { WalletLedgerEntry, WalletLedgerType } from '@/wallet/types';

const OLEXP_LEDGER_TYPES: WalletLedgerType[] = [
  'OLEXP_PRINCIPAL',
  'OLEXP_YIELD',
  'SWAP_SPOT_TO_OLEXP',
  'SWAP_OLEXP_TO_SPOT',
];

/** Últimas entradas relevantes para a conta OLEXP (Hold + swaps). */
export function recentOlexpLedger(ledger: WalletLedgerEntry[], limit = 5): WalletLedgerEntry[] {
  return [...ledger]
    .filter((e) => OLEXP_LEDGER_TYPES.includes(e.type))
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, limit);
}
