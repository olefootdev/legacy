import type {
  AdminPlatformState,
  AdminPlatformUser,
  CashflowExpenseCategory,
  CashflowExpenseLine,
  GrowthCommerceLine,
  PlatformLedgerLine,
} from './platformTypes';

export type GrowthRangePreset = 'today' | '7d' | '30d' | 'month';

export interface GrowthTimeRange {
  label: string;
  start: Date;
  end: Date;
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

/** Limites do período (UTC) para comparação com `createdAt` ISO. */
export function growthTimeRange(preset: GrowthRangePreset, now = new Date()): GrowthTimeRange {
  const end = endOfUtcDay(now);
  if (preset === 'today') {
    const start = startOfUtcDay(now);
    return { label: 'Hoje', start, end };
  }
  if (preset === '7d') {
    const start = startOfUtcDay(now);
    start.setUTCDate(start.getUTCDate() - 6);
    return { label: '7 dias', start, end };
  }
  if (preset === '30d') {
    const start = startOfUtcDay(now);
    start.setUTCDate(start.getUTCDate() - 29);
    return { label: '30 dias', start, end };
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  return { label: 'Mês corrente', start, end };
}

function inRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= start.getTime() && t <= end.getTime();
}

export function filterLedgerCompletedFiat(
  ledger: PlatformLedgerLine[],
  start: Date,
  end: Date,
): PlatformLedgerLine[] {
  return ledger.filter((l) => {
    if (!inRange(l.createdAt, start, end)) return false;
    if (l.kind !== 'fiat_deposit' && l.kind !== 'fiat_withdrawal') return false;
    if (l.flowStatus === 'processing' || l.flowStatus === 'failed') return false;
    return true;
  });
}

export function sumFiatDepositsCents(lines: PlatformLedgerLine[]): number {
  return lines.filter((l) => l.kind === 'fiat_deposit').reduce((a, l) => a + Math.max(0, l.broCentsDelta), 0);
}

export function sumFiatWithdrawalsCents(lines: PlatformLedgerLine[]): number {
  return lines
    .filter((l) => l.kind === 'fiat_withdrawal')
    .reduce((a, l) => a + Math.abs(Math.min(0, l.broCentsDelta)), 0);
}

export function countDepositEvents(lines: PlatformLedgerLine[]): number {
  return lines.filter((l) => l.kind === 'fiat_deposit').length;
}

export function countNewUsers(users: AdminPlatformUser[], start: Date, end: Date): number {
  return users.filter((u) => inRange(u.createdAtIso, start, end)).length;
}

export function countUsersActiveInRange(users: AdminPlatformUser[], start: Date, end: Date): number {
  return users.filter((u) => u.status === 'active' && inRange(u.updatedAtIso, start, end)).length;
}

export function commerceTotals(lines: GrowthCommerceLine[], start: Date, end: Date) {
  const slice = lines.filter((l) => inRange(l.createdAt, start, end));
  const byKind = {
    store_item: 0,
    transfer_player: 0,
    bundle: 0,
    count: slice.length,
    revenueCents: 0,
    grossCents: 0,
  };
  for (const l of slice) {
    byKind.revenueCents += l.revenueBroCents;
    byKind.grossCents += l.grossBroCents ?? 0;
    byKind[l.kind] += l.revenueBroCents;
  }
  return byKind;
}

export function pulseTotals(
  pulse: { date: string; bannerImpressions: number; ctaClicks: number; attributedSignups?: number }[],
  start: Date,
  end: Date,
) {
  const startDay = start.toISOString().slice(0, 10);
  const endDay = end.toISOString().slice(0, 10);
  let impressions = 0;
  let clicks = 0;
  let attributed = 0;
  for (const row of pulse) {
    if (row.date < startDay || row.date > endDay) continue;
    impressions += row.bannerImpressions;
    clicks += row.ctaClicks;
    attributed += row.attributedSignups ?? 0;
  }
  const ctr = impressions > 0 ? clicks / impressions : 0;
  return { impressions, clicks, attributed, ctr };
}

/** Utilizadores novos no período com pelo menos um depósito concluído nos `depositGraceDays` seguintes ao registo. */
export function conversionSignupToFirstDeposit(
  users: AdminPlatformUser[],
  ledger: PlatformLedgerLine[],
  start: Date,
  end: Date,
  depositGraceDays = 14,
): { signups: number; converted: number; rate: number } {
  const newUsers = users.filter((u) => inRange(u.createdAtIso, start, end));
  const signups = newUsers.length;
  if (signups === 0) return { signups: 0, converted: 0, rate: 0 };

  const deposits = ledger.filter(
    (l) => l.kind === 'fiat_deposit' && l.flowStatus !== 'processing' && l.flowStatus !== 'failed',
  );

  let converted = 0;
  for (const u of newUsers) {
    const t0 = new Date(u.createdAtIso).getTime();
    if (Number.isNaN(t0)) continue;
    const t1 = t0 + depositGraceDays * 86400000;
    const has = deposits.some((d) => {
      if (d.target !== u.id) return false;
      const td = new Date(d.createdAt).getTime();
      return td >= t0 && td <= t1;
    });
    if (has) converted += 1;
  }
  return { signups, converted, rate: converted / signups };
}

export interface DailyRevenuePoint {
  date: string;
  depositsCents: number;
  withdrawalsCents: number;
  commerceRevenueCents: number;
  /** depósitos + receita comércio (visão “dinheiro novo” + taxas) */
  netGrowthCents: number;
}

/** Série diária agregada entre start e end (UTC dias). */
export function buildDailyRevenueSeries(
  s: AdminPlatformState,
  start: Date,
  end: Date,
): DailyRevenuePoint[] {
  const days: string[] = [];
  const cur = startOfUtcDay(new Date(start));
  const last = startOfUtcDay(new Date(end));
  while (cur.getTime() <= last.getTime()) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const ledger = filterLedgerCompletedFiat(s.platformLedger, start, end);
  const commerce = s.growthCommerceLines.filter((l) => inRange(l.createdAt, start, end));

  return days.map((date) => {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    const dayLed = ledger.filter((l) => inRange(l.createdAt, dayStart, dayEnd));
    const dep = sumFiatDepositsCents(dayLed.filter((x) => x.kind === 'fiat_deposit'));
    const wd = sumFiatWithdrawalsCents(dayLed.filter((x) => x.kind === 'fiat_withdrawal'));
    const cr = commerce
      .filter((l) => inRange(l.createdAt, dayStart, dayEnd))
      .reduce((a, l) => a + l.revenueBroCents, 0);
    return {
      date,
      depositsCents: dep,
      withdrawalsCents: wd,
      commerceRevenueCents: cr,
      netGrowthCents: dep + cr,
    };
  });
}

export function averageDaily(totalCents: number, dayCount: number): number {
  if (dayCount <= 0) return 0;
  return Math.round(totalCents / dayCount);
}

/** Projeção simples para o fim do mês civil UTC: média diária dos últimos `lookbackDays` × dias restantes + acumulado do mês. */
export function projectMonthEndRevenue(
  s: AdminPlatformState,
  now = new Date(),
  lookbackDays = 7,
): {
  monthToDateCents: number;
  projectedMonthEndCents: number;
  avgLastWindowCents: number;
  daysRemainingInMonth: number;
} {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  const series = buildDailyRevenueSeries(s, monthStart, endOfUtcDay(now));
  const monthToDateCents = series.reduce((a, p) => a + p.netGrowthCents, 0);

  const lbStart = startOfUtcDay(now);
  lbStart.setUTCDate(lbStart.getUTCDate() - (lookbackDays - 1));
  const lbSeries = buildDailyRevenueSeries(s, lbStart, endOfUtcDay(now));
  const sumWindow = lbSeries.reduce((a, p) => a + p.netGrowthCents, 0);
  const avgLastWindowCents = averageDaily(sumWindow, lbSeries.length);

  const todayUtc = startOfUtcDay(now);
  const lastDay = startOfUtcDay(monthEnd);
  const daysRemainingInMonth = Math.max(0, Math.round((lastDay.getTime() - todayUtc.getTime()) / 86400000));

  const projectedMonthEndCents = monthToDateCents + avgLastWindowCents * daysRemainingInMonth;

  return { monthToDateCents, projectedMonthEndCents, avgLastWindowCents, daysRemainingInMonth };
}

export function topCountries(users: AdminPlatformUser[], limit = 5): { country: string; count: number }[] {
  const m = new Map<string, number>();
  for (const u of users) {
    const c = (u.country || '—').trim() || '—';
    m.set(c, (m.get(c) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([country, count]) => ({ country, count }));
}

function expenseDayInRange(dateStr: string, start: Date, end: Date): boolean {
  return inRange(`${dateStr}T12:00:00.000Z`, start, end);
}

/**
 * Expande despesas recorrentes em instâncias mensais virtuais dentro de [start, end].
 * Despesas avulsas (sem `recurring`) passam direto.
 * Cada instância mantém a mesma struct, mas com `date` ajustado ao mês correspondente.
 */
export function expandRecurringExpenses(
  lines: CashflowExpenseLine[],
  start: Date,
  end: Date,
): CashflowExpenseLine[] {
  const result: CashflowExpenseLine[] = [];
  for (const l of lines) {
    if (!l.recurring) {
      result.push(l);
      continue;
    }
    const [sy, sm, sd] = l.date.split('-').map(Number);
    const day = sd;
    const limitDate = l.endDate ?? end.toISOString().slice(0, 10);
    let curY = sy;
    let curM = sm;
    for (let iter = 0; iter < 120; iter++) {
      const maxDay = new Date(curY, curM, 0).getDate();
      const d = Math.min(day, maxDay);
      const dateStr = `${String(curY).padStart(4, '0')}-${String(curM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (dateStr > limitDate) break;
      if (expenseDayInRange(dateStr, start, end)) {
        result.push({ ...l, date: dateStr });
      }
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }
  }
  return result;
}

export function formatBrlFromCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function sumCashflowBrlCents(lines: CashflowExpenseLine[], start: Date, end: Date): number {
  return expandRecurringExpenses(lines, start, end)
    .filter((l) => expenseDayInRange(l.date, start, end))
    .reduce((a, l) => a + l.amountBrlCents, 0);
}

export function cashflowTotalsByCategory(
  lines: CashflowExpenseLine[],
  start: Date,
  end: Date,
): Record<CashflowExpenseCategory, number> {
  const empty: Record<CashflowExpenseCategory, number> = {
    pessoas: 0,
    infra: 0,
    marketing: 0,
    legal: 0,
    ferramentas: 0,
    impostos: 0,
    outro: 0,
  };
  for (const l of expandRecurringExpenses(lines, start, end)) {
    if (!expenseDayInRange(l.date, start, end)) continue;
    empty[l.category] += l.amountBrlCents;
  }
  return empty;
}

/** Converte despesas em BRL para BRO centavos usando taxa manual (BRO centavos por 1,00 BRL). */
export function cashflowBrlToBroCentsApprox(
  amountBrlCents: number,
  broCentsPerBrl: number | undefined,
): number | null {
  if (broCentsPerBrl == null || broCentsPerBrl <= 0) return null;
  const brlWhole = amountBrlCents / 100;
  return Math.round(brlWhole * broCentsPerBrl);
}
