/**
 * Previsões operacionais OLEXP (Admin) — ordem de grandeza para vencimentos / yield restante.
 * Accrual oficial: `accrueOlexpDaily` no cliente (seg–sex, 24h após adesão).
 */

import type { PlatformOlexpPosition } from '@/admin/platformTypes';
import { OLEXP_FIRST_YIELD_DELAY_HOURS } from '@/wallet/constants';
import { getPlan } from '@/wallet/olexp';

function parseUtcDate(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

export function addDaysUtc(iso: string, days: number): string {
  const x = parseUtcDate(iso);
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
}

function isBusinessDay(d: Date): boolean {
  const day = d.getUTCDay();
  return day >= 1 && day <= 5;
}

/** Dias úteis no intervalo [startIso, endIso], inclusivo, UTC. */
export function countBusinessDaysInclusive(startIso: string, endIso: string): number {
  const a = parseUtcDate(startIso);
  const b = parseUtcDate(endIso);
  if (b < a) return 0;
  let n = 0;
  for (let d = new Date(a); d <= b; d.setUTCDate(d.getUTCDate() + 1)) {
    if (isBusinessDay(d)) n++;
  }
  return n;
}

function diffHoursUtc(startIso: string, endIso: string): number {
  return (parseUtcDate(endIso).getTime() - parseUtcDate(startIso).getTime()) / (1000 * 60 * 60);
}

/**
 * Yield restante estimado até ao vencimento (último dia útil antes de `endDate`, como no reducer).
 */
export function estimateRemainingYieldCents(pos: PlatformOlexpPosition, asOfIso: string): number | null {
  if (pos.status !== 'active') return null;
  const plan = getPlan(pos.planId);
  if (!plan) return null;
  if (asOfIso >= pos.endDate) return 0;
  const daily = Math.round(pos.principalCents * plan.dailyRate);
  if (daily <= 0) return 0;

  let startFrom = asOfIso > pos.startDate ? asOfIso : pos.startDate;
  if (diffHoursUtc(pos.startDate, startFrom) < OLEXP_FIRST_YIELD_DELAY_HOURS) {
    startFrom = addDaysUtc(pos.startDate, 1);
    if (startFrom >= pos.endDate) return 0;
  }

  const lastAccrualDate = addDaysUtc(pos.endDate, -1);
  if (startFrom > lastAccrualDate) return 0;
  const biz = countBusinessDaysInclusive(startFrom, lastAccrualDate);
  return biz * daily;
}

export function daysUntilEnd(pos: PlatformOlexpPosition, asOfIso: string): number | null {
  if (pos.status === 'pending_activation') return null;
  const a = parseUtcDate(asOfIso);
  const e = parseUtcDate(pos.endDate);
  return Math.ceil((e.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function forecastPrincipalPayoutCents(pos: PlatformOlexpPosition): number {
  if (pos.status === 'active' || pos.status === 'matured') return pos.principalCents;
  return 0;
}

export type MaturityMonthBucket = { monthKey: string; label: string; principalCents: number; positionCount: number };

export function bucketMaturitiesByMonth(
  positions: PlatformOlexpPosition[],
  asOfIso: string,
): MaturityMonthBucket[] {
  const map = new Map<string, { principalCents: number; positionCount: number }>();
  for (const p of positions) {
    if (p.status !== 'active' && p.status !== 'matured') continue;
    if (p.endDate < asOfIso) continue;
    const d = parseUtcDate(p.endDate);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const cur = map.get(key) ?? { principalCents: 0, positionCount: 0 };
    cur.principalCents += p.principalCents;
    cur.positionCount += 1;
    map.set(key, cur);
  }
  const out: MaturityMonthBucket[] = [];
  for (const [monthKey, v] of map) {
    const [y, m] = monthKey.split('-').map(Number);
    const label = `${String(m).padStart(2, '0')}/${y}`;
    out.push({ monthKey, label, principalCents: v.principalCents, positionCount: v.positionCount });
  }
  out.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  return out;
}
