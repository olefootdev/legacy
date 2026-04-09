/**
 * Game Assets Treasury (GAT) — reward diário sobre BRO gasto em categorias elegíveis.
 * 0,275%/dia, todos os dias, 24 meses.
 */

import type { WalletState, GatPosition, GatCategory, WalletResult } from './types';
import { GAT_DAILY_RATE, GAT_DURATION_MONTHS, GAT_ELIGIBLE_CATEGORIES } from './constants';
import { appendLedger } from './ledger';

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type RegisterGatBaseOptions = {
  /** Rótulo exibido na UI (estrutura, produto, etc.). */
  assetLabel?: string;
};

/**
 * Registra base elegível após uma compra em categoria válida.
 */
export function registerGatBase(
  state: WalletState,
  purchaseCategory: GatCategory,
  amountCents: number,
  now: string = new Date().toISOString(),
  options?: RegisterGatBaseOptions,
): WalletResult {
  if (!GAT_ELIGIBLE_CATEGORIES.includes(purchaseCategory)) {
    return { ok: false, error: 'Categoria não elegível para GAT.', code: 'GAT_INVALID_CATEGORY' };
  }

  const startDate = now.slice(0, 10);
  const endDate = addMonths(startDate, GAT_DURATION_MONTHS);

  const position: GatPosition = {
    id: `gat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: 'self',
    baseEligibleCents: amountCents,
    dailyRate: GAT_DAILY_RATE,
    startDate,
    endDate,
    accruedCents: 0,
    paidCents: 0,
    lastAccrualDate: startDate,
    sourceCategory: purchaseCategory,
    ...(options?.assetLabel ? { assetLabel: options.assetLabel } : {}),
  };

  let next: WalletState = {
    ...state,
    gatPositions: [...state.gatPositions, position],
  };

  next = appendLedger(next, {
    userId: 'self',
    type: 'GAT_BASE_DEBIT',
    currency: 'BRO',
    amount: -amountCents,
    status: 'confirmed',
    source: 'gat_base_register',
    refId: position.id,
    createdAt: now,
    metadata: {
      category: purchaseCategory,
      ...(options?.assetLabel ? { assetLabel: options.assetLabel } : {}),
    },
  });

  return { ok: true, state: next };
}

/**
 * Accrual diário para todas as posições GAT ativas.
 * Idempotente por data + positionId. Todos os dias (não só úteis).
 */
export function accrueGatDaily(state: WalletState, currentDate: string): WalletState {
  const dateStr = toDateStr(new Date(currentDate));
  let next = { ...state };

  const updatedPositions = next.gatPositions.map((pos) => {
    if (pos.lastAccrualDate >= dateStr) return pos;
    if (dateStr >= pos.endDate) return pos;

    const dailyReward = Math.round(pos.baseEligibleCents * pos.dailyRate);
    if (dailyReward <= 0) return pos;

    next = { ...next, spotBroCents: next.spotBroCents + dailyReward };

    next = appendLedger(next, {
      userId: 'self',
      type: 'GAT_REWARD',
      currency: 'BRO',
      amount: dailyReward,
      status: 'confirmed',
      source: 'gat_daily_reward',
      refId: `${pos.id}:${dateStr}`,
      createdAt: `${dateStr}T23:59:00Z`,
      metadata: { positionId: pos.id, category: pos.sourceCategory },
    });

    return {
      ...pos,
      accruedCents: pos.accruedCents + dailyReward,
      paidCents: pos.paidCents + dailyReward,
      lastAccrualDate: dateStr,
    };
  });

  return { ...next, gatPositions: updatedPositions };
}

/** Posições agrupadas por categoria */
export function listGatPositions(state: WalletState) {
  const byCategory: Record<string, GatPosition[]> = {};
  for (const pos of state.gatPositions) {
    if (!byCategory[pos.sourceCategory]) byCategory[pos.sourceCategory] = [];
    byCategory[pos.sourceCategory]!.push(pos);
  }
  return byCategory;
}

/** Resumo agregado do GAT */
export function gatSummary(state: WalletState) {
  let totalBase = 0;
  let totalAccrued = 0;
  let activeCount = 0;

  for (const pos of state.gatPositions) {
    const dateStr = toDateStr(new Date());
    const isActive = dateStr < pos.endDate;
    if (isActive) activeCount++;
    totalBase += pos.baseEligibleCents;
    totalAccrued += pos.accruedCents;
  }

  return { totalBase, totalAccrued, activeCount, positionCount: state.gatPositions.length };
}
