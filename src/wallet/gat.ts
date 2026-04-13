/**
 * Game Assets Treasury (GAT) — reward diário em EXP sobre BRO gasto (base elegível),
 * por faixas; + referral 1%/nível (até 3) em EXP sobre a mesma base.
 */

import type {
  WalletState,
  GatPosition,
  GatCategory,
  WalletResult,
  ReferralCommission,
  ReferralLevel,
} from './types';
import { GAT_DURATION_MONTHS, GAT_ELIGIBLE_CATEGORIES, GAT_REFERRAL_LEVEL_RATE } from './constants';
import { appendLedger } from './ledger';
import { normalizeReferralCode } from './referralCode';

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Taxa diária em EXP como fração da base em centavos de BRO (ex.: 0,015 = 1,5%). */
export function gatDailyExpRateForBaseBroCents(baseEligibleCents: number): number {
  const bro = baseEligibleCents / 100;
  if (bro <= 0) return 0;
  if (bro <= 100) return 0.015;
  if (bro <= 300) return 0.025;
  if (bro <= 999) return 0.035;
  return 0.055;
}

function gatReferralExpPerLevel(baseEligibleCents: number): number {
  return Math.max(0, Math.round(baseEligibleCents * GAT_REFERRAL_LEVEL_RATE));
}

/**
 * Percorre até 3 níveis na árvore (`userId` → `sponsorId`).
 * Cada nível recebe `round(base * 1%)` EXP em ledger; se o patrocinador for o teu código,
 * o valor entra também em `spotExpBalance` (útil quando o estado agrega vários atores).
 */
function applyGatReferralChain(
  state: WalletState,
  baseEligibleCents: number,
  positionId: string,
  dateStr: string,
): WalletState {
  const perLevel = gatReferralExpPerLevel(baseEligibleCents);
  if (perLevel <= 0) return state;

  const createdAt = `${dateStr}T23:59:00.000Z`;
  const myCode = state.myReferralCode ? normalizeReferralCode(state.myReferralCode) : null;

  let next = state;
  let currentUserId: string = 'self';

  for (let level = 1; level <= 3; level++) {
    const node = next.referralTree.find((n) => n.userId === currentUserId);
    if (!node) break;

    const sponsorRaw = String(node.sponsorId ?? '').trim();
    const sponsorId = normalizeReferralCode(sponsorRaw) || sponsorRaw;
    if (!sponsorId) break;

    const commEntry: ReferralCommission = {
      id: `gatref-${positionId}-L${level}-${dateStr}`,
      fromUserId: 'self',
      toUserId: sponsorId,
      level: level as ReferralLevel,
      sourceType: 'gat',
      sourceAmount: baseEligibleCents,
      commissionAmount: perLevel,
      currency: 'EXP',
      status: 'confirmed',
      createdAt,
    };

    next = {
      ...next,
      referralCommissions: [...next.referralCommissions, commEntry],
    };

    next = appendLedger(next, {
      userId: sponsorId,
      type: 'REFERRAL_GAT_EXP',
      currency: 'EXP',
      amount: perLevel,
      status: 'confirmed',
      source: `gat_referral_l${level}`,
      refId: `${positionId}:${dateStr}:gatref:L${level}`,
      createdAt,
      metadata: { fromUser: 'self', level, positionId, baseEligibleCents },
    });

    if (myCode && normalizeReferralCode(sponsorId) === myCode) {
      next = { ...next, spotExpBalance: next.spotExpBalance + perLevel };
    }

    currentUserId = sponsorId;
  }

  return next;
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
  const dailyRate = gatDailyExpRateForBaseBroCents(amountCents);

  const position: GatPosition = {
    id: `gat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: 'self',
    baseEligibleCents: amountCents,
    dailyRate,
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
 * Accrual diário para todas as posições GAT ativas — crédito em EXP + referral em EXP.
 * Idempotente por data + positionId. Todos os dias (não só úteis).
 */
export function accrueGatDaily(state: WalletState, currentDate: string): WalletState {
  const dateStr = toDateStr(new Date(currentDate));
  let next = { ...state };

  const updatedPositions = next.gatPositions.map((pos) => {
    if (pos.lastAccrualDate >= dateStr) return pos;
    if (dateStr >= pos.endDate) return pos;

    const rate = gatDailyExpRateForBaseBroCents(pos.baseEligibleCents);
    const dailyExp = Math.max(0, Math.round(pos.baseEligibleCents * rate));
    if (dailyExp <= 0) return pos;

    next = { ...next, spotExpBalance: next.spotExpBalance + dailyExp };

    next = appendLedger(next, {
      userId: 'self',
      type: 'GAT_REWARD',
      currency: 'EXP',
      amount: dailyExp,
      status: 'confirmed',
      source: 'gat_daily_reward',
      refId: `${pos.id}:${dateStr}`,
      createdAt: `${dateStr}T23:59:00.000Z`,
      metadata: {
        positionId: pos.id,
        category: pos.sourceCategory,
        dailyRate: rate,
        baseEligibleCents: pos.baseEligibleCents,
      },
    });

    next = applyGatReferralChain(next, pos.baseEligibleCents, pos.id, dateStr);

    return {
      ...pos,
      dailyRate: rate,
      accruedCents: pos.accruedCents + dailyExp,
      paidCents: pos.paidCents + dailyExp,
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
