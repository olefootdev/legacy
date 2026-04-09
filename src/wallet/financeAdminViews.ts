import type { WalletLedgerEntry, WalletLedgerType, WalletState } from './types';
import { OLEXP_PLANS } from './constants';

const DEPOSIT_TYPES: WalletLedgerType[] = ['FIAT_DEPOSIT'];
const WITHDRAW_TYPES: WalletLedgerType[] = ['FIAT_WITHDRAWAL'];

/** Movimentos de “depósito” simulados + créditos SPOT BRO genéricos (ex.: reward). */
export function ledgerDepositEntries(ledger: WalletLedgerEntry[]): WalletLedgerEntry[] {
  return ledger.filter(
    (e) =>
      DEPOSIT_TYPES.includes(e.type) ||
      (e.type === 'SPOT_BRO' && e.amount > 0 && e.status === 'confirmed'),
  );
}

export function ledgerWithdrawalEntries(ledger: WalletLedgerEntry[]): WalletLedgerEntry[] {
  return ledger.filter(
    (e) =>
      WITHDRAW_TYPES.includes(e.type) ||
      (e.type === 'TRANSFER' && e.amount < 0 && e.currency === 'BRO') ||
      (e.type === 'SPOT_BRO' && e.amount < 0 && e.status === 'confirmed'),
  );
}

export function sumConfirmedBroAmount(entries: WalletLedgerEntry[]): number {
  return entries.filter((e) => e.currency === 'BRO' && e.status === 'confirmed').reduce((s, e) => s + e.amount, 0);
}

export function olexpCustodyTotals(wallet: WalletState) {
  const active = wallet.olexpPositions.filter((p) => p.status === 'active');
  const matured = wallet.olexpPositions.filter((p) => p.status === 'matured');
  const principalLocked = active.reduce((s, p) => s + p.principalCents, 0);
  const yieldAccrued = wallet.olexpPositions.reduce((s, p) => s + p.yieldAccruedCents, 0);
  const yieldPaid = wallet.olexpPositions.reduce((s, p) => s + p.yieldPaidCents, 0);
  return {
    positionsCount: wallet.olexpPositions.length,
    activeCount: active.length,
    maturedUnclaimed: matured.length,
    principalLockedCents: principalLocked,
    yieldAccruedCents: yieldAccrued,
    yieldPaidCents: yieldPaid,
  };
}

export function olexpPlanLabel(planId: string): string {
  return OLEXP_PLANS.find((p) => p.id === planId)?.label ?? planId;
}

export function gatCustodyTotals(wallet: WalletState) {
  const positions = wallet.gatPositions ?? [];
  const base = positions.reduce((s, p) => s + p.baseEligibleCents, 0);
  const accrued = positions.reduce((s, p) => s + p.accruedCents, 0);
  const paid = positions.reduce((s, p) => s + p.paidCents, 0);
  return { positionsCount: positions.length, baseEligibleCents: base, accruedCents: accrued, paidCents: paid };
}
