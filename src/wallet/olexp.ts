/**
 * OLEXP — lógica de staking (yield sobre principal, sem capitalização).
 * Seg–sex apenas; primeiro crédito 24h após adesão; yield sobre principal da SPOT.
 */

import type { WalletState, WalletResult, OlexpPlanId, OlexpPosition } from './types';
import { OLEXP_PLANS, OLEXP_FIRST_YIELD_DELAY_HOURS, OLEXP_SWAP_OLEXP_TO_SPOT_MIN_BRO_CENTS } from './constants';
import { appendLedger, generateLedgerId } from './ledger';

function isBusinessDay(d: Date): boolean {
  const day = d.getUTCDay();
  return day >= 1 && day <= 5;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function diffHours(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60);
}

export function getPlan(planId: OlexpPlanId) {
  return OLEXP_PLANS.find((p) => p.id === planId);
}

/**
 * Cria posição OLEXP: valida KYC, saldo mínimo, move BRO de SPOT para posição.
 */
export function createOlexpPosition(
  state: WalletState,
  planId: OlexpPlanId,
  amountCents: number,
  now: string = new Date().toISOString(),
): WalletResult {
  if (!state.kycOlexpDone) {
    return { ok: false, error: 'KYC OLEXP obrigatório.', code: 'OLEXP_KYC_REQUIRED' };
  }

  const plan = getPlan(planId);
  if (!plan) {
    return { ok: false, error: 'Plano inválido.', code: 'OLEXP_MIN_NOT_MET' };
  }

  if (amountCents < plan.minBroCents) {
    return { ok: false, error: `Mínimo de ${plan.minBroCents / 100} BRO.`, code: 'OLEXP_MIN_NOT_MET' };
  }

  if (state.spotBroCents < amountCents) {
    return { ok: false, error: 'Saldo SPOT BRO insuficiente.', code: 'INSUFFICIENT_SPOT_BRO' };
  }

  const posId = `olexp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const startDate = now.slice(0, 10);
  const endDate = addDays(startDate, plan.days);

  const position: OlexpPosition = {
    id: posId,
    planId,
    principalCents: amountCents,
    startDate,
    endDate,
    yieldAccruedCents: 0,
    yieldPaidCents: 0,
    status: 'active',
    lastAccrualDate: startDate,
  };

  let next: WalletState = {
    ...state,
    spotBroCents: state.spotBroCents - amountCents,
    olexpPositions: [...state.olexpPositions, position],
  };

  next = appendLedger(next, {
    userId: 'self',
    type: 'SWAP_SPOT_TO_OLEXP',
    currency: 'BRO',
    amount: -amountCents,
    status: 'confirmed',
    source: 'swap_spot_to_olexp_stake',
    refId: posId,
    createdAt: now,
    metadata: { planId, days: plan.days, olexpPositionId: posId },
  });

  return { ok: true, state: next };
}

/**
 * SWAP OLEXP → SPOT: devolve o principal de uma posição **ativa** ao saldo SPOT antes do vencimento.
 * Yield já creditado ao SPOT (accrual) mantém-se; não há novo crédito de yield aqui.
 */
export function earlyExitOlexpToSpot(
  state: WalletState,
  positionId: string,
  now: string = new Date().toISOString(),
): WalletResult {
  const idx = state.olexpPositions.findIndex((p) => p.id === positionId);
  if (idx === -1) {
    return { ok: false, error: 'Posição não encontrada.', code: 'OLEXP_POSITION_NOT_FOUND' };
  }
  const pos = state.olexpPositions[idx]!;
  if (pos.status !== 'active') {
    return {
      ok: false,
      error:
        pos.status === 'matured'
          ? 'Posição vencida: usa Resgatar para devolver o principal ao SPOT.'
          : 'Posição já foi encerrada.',
      code: 'OLEXP_NOT_ACTIVE',
    };
  }

  if (pos.principalCents < OLEXP_SWAP_OLEXP_TO_SPOT_MIN_BRO_CENTS) {
    return {
      ok: false,
      error: `SWAP OLEXP → SPOT: principal mínimo de ${OLEXP_SWAP_OLEXP_TO_SPOT_MIN_BRO_CENTS / 100} BRO por posição.`,
      code: 'OLEXP_MIN_NOT_MET',
    };
  }

  const positions = state.olexpPositions.map((p) =>
    p.id === positionId ? { ...p, status: 'claimed' as const } : p,
  );

  let next: WalletState = {
    ...state,
    spotBroCents: state.spotBroCents + pos.principalCents,
    olexpPositions: positions,
  };

  next = appendLedger(next, {
    userId: 'self',
    type: 'SWAP_OLEXP_TO_SPOT',
    currency: 'BRO',
    amount: pos.principalCents,
    status: 'confirmed',
    source: 'swap_olexp_to_spot_early',
    refId: `${positionId}:early`,
    createdAt: now,
    metadata: { principalCents: pos.principalCents },
  });

  return { ok: true, state: next };
}

/**
 * Accrual diário para todas as posições ativas.
 * Idempotente por data + positionId (não acumula duas vezes no mesmo dia).
 * Seg–sex apenas; yield = principal × dailyRate (sem capitalização).
 */
export function accrueOlexpDaily(state: WalletState, businessDate: string): WalletState {
  const dateObj = new Date(businessDate);
  const dateStr = toDateStr(dateObj);

  if (!isBusinessDay(dateObj)) return state;

  let next = { ...state };
  const updatedPositions = next.olexpPositions.map((pos) => {
    if (pos.status !== 'active') return pos;

    if (pos.lastAccrualDate >= dateStr) return pos;

    if (dateStr >= pos.endDate) {
      return { ...pos, status: 'matured' as const, lastAccrualDate: dateStr };
    }

    if (diffHours(pos.startDate, dateStr) < OLEXP_FIRST_YIELD_DELAY_HOURS) {
      return pos;
    }

    const plan = getPlan(pos.planId);
    if (!plan) return pos;

    const dailyYield = Math.round(pos.principalCents * plan.dailyRate);
    if (dailyYield <= 0) return pos;

    next = appendLedger(next, {
      userId: 'self',
      type: 'OLEXP_YIELD',
      currency: 'BRO',
      amount: dailyYield,
      status: 'confirmed',
      source: 'olexp_daily_yield',
      refId: `${pos.id}:${dateStr}`,
      createdAt: `${dateStr}T23:59:00Z`,
      metadata: { positionId: pos.id, rate: plan.dailyRate },
    });

    next = { ...next, spotBroCents: next.spotBroCents + dailyYield };

    return {
      ...pos,
      yieldAccruedCents: pos.yieldAccruedCents + dailyYield,
      yieldPaidCents: pos.yieldPaidCents + dailyYield,
      lastAccrualDate: dateStr,
    };
  });

  return { ...next, olexpPositions: updatedPositions };
}

/**
 * Claim do principal após vencimento → move de volta para SPOT.
 */
export function claimOlexpPrincipal(
  state: WalletState,
  positionId: string,
  now: string = new Date().toISOString(),
): WalletResult {
  const idx = state.olexpPositions.findIndex((p) => p.id === positionId);
  if (idx === -1) {
    return { ok: false, error: 'Posição não encontrada.', code: 'OLEXP_POSITION_NOT_FOUND' };
  }

  const pos = state.olexpPositions[idx]!;
  if (pos.status === 'claimed') {
    return { ok: false, error: 'Posição já resgatada.', code: 'OLEXP_ALREADY_CLAIMED' };
  }
  if (pos.status !== 'matured') {
    return { ok: false, error: 'Posição ainda não venceu.', code: 'OLEXP_NOT_MATURED' };
  }

  const updatedPos = { ...pos, status: 'claimed' as const };
  const positions = [...state.olexpPositions];
  positions[idx] = updatedPos;

  let next: WalletState = {
    ...state,
    spotBroCents: state.spotBroCents + pos.principalCents,
    olexpPositions: positions,
  };

  next = appendLedger(next, {
    userId: 'self',
    type: 'OLEXP_PRINCIPAL',
    currency: 'BRO',
    amount: pos.principalCents,
    status: 'confirmed',
    source: 'olexp_claim',
    refId: `${positionId}:claim`,
    createdAt: now,
  });

  return { ok: true, state: next };
}

/**
 * Projeção de yield total para UI (não modifica state).
 */
export function estimateYield(planId: OlexpPlanId, principalCents: number): {
  totalYieldCents: number;
  dailyYieldCents: number;
  businessDaysApprox: number;
} {
  const plan = getPlan(planId);
  if (!plan) return { totalYieldCents: 0, dailyYieldCents: 0, businessDaysApprox: 0 };

  const businessDaysApprox = Math.round(plan.days * (5 / 7));
  const dailyYieldCents = Math.round(principalCents * plan.dailyRate);
  const totalYieldCents = dailyYieldCents * businessDaysApprox;

  return { totalYieldCents, dailyYieldCents, businessDaysApprox };
}

/** Resumo agregado de todas as posições OLEXP */
export function olexpSummary(state: WalletState) {
  let totalPrincipal = 0;
  let totalYieldAccrued = 0;
  let activeCount = 0;
  let maturedCount = 0;

  for (const pos of state.olexpPositions) {
    if (pos.status === 'active' || pos.status === 'matured') {
      totalPrincipal += pos.principalCents;
      totalYieldAccrued += pos.yieldAccruedCents;
    }
    if (pos.status === 'active') activeCount++;
    if (pos.status === 'matured') maturedCount++;
  }

  return { totalPrincipal, totalYieldAccrued, activeCount, maturedCount };
}
