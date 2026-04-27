import type { AdminPlatformState } from './platformTypes';
import { computePlatformAggregate } from './platformStore';
import {
  buildDailyRevenueSeries,
  cashflowBrlToBroCentsApprox,
  cashflowTotalsByCategory,
  commerceTotals,
  conversionSignupToFirstDeposit,
  countDepositEvents,
  countNewUsers,
  countUsersActiveInRange,
  expandRecurringExpenses,
  filterLedgerCompletedFiat,
  growthTimeRange,
  olexpUptake,
  projectMonthEndRevenue,
  pulseTotals,
  sumCashflowBrlCents,
  sumFiatDepositsCents,
  sumFiatWithdrawalsCents,
  topCountries,
  type GrowthRangePreset,
} from './growthMetrics';

/** Snapshot serializável enviado ao Analista de Growth (servidor + modelo). */
export function buildGrowthAnalystSnapshot(
  platform: AdminPlatformState,
  preset: GrowthRangePreset,
): Record<string, unknown> {
  const range = growthTimeRange(preset);
  const ag = computePlatformAggregate(platform);
  const fiatInRange = filterLedgerCompletedFiat(platform.platformLedger, range.start, range.end);
  const depositsBroCents = sumFiatDepositsCents(fiatInRange);
  const withdrawalsBroCents = sumFiatWithdrawalsCents(fiatInRange);
  const commerce = commerceTotals(platform.growthCommerceLines, range.start, range.end);
  const pulse = pulseTotals(platform.growthDailyPulse, range.start, range.end);
  const conv = conversionSignupToFirstDeposit(platform.users, platform.platformLedger, range.start, range.end);
  const uptake = olexpUptake(platform);
  const projection = projectMonthEndRevenue(platform, new Date(), 7);
  const expensesBrl = sumCashflowBrlCents(platform.growthCashflowExpenses ?? [], range.start, range.end);
  const expensesByCat = cashflowTotalsByCategory(platform.growthCashflowExpenses ?? [], range.start, range.end);
  const fx = platform.growthBroCentsPerBrl;
  const expensesBroApprox = cashflowBrlToBroCentsApprox(expensesBrl, fx);
  const revenueProxyBro = depositsBroCents + commerce.revenueCents;
  const netBroApprox =
    expensesBroApprox != null ? revenueProxyBro - expensesBroApprox : null;

  return {
    generatedAt: new Date().toISOString(),
    localeNote: 'Métricas em PT; BRO = token interno; despesas em BRL.',
    periodLabel: range.label,
    rangeUtc: { start: range.start.toISOString(), end: range.end.toISOString() },
    users: {
      total: ag.userCount,
      active: ag.activeUsers,
      newInPeriod: countNewUsers(platform.users, range.start, range.end),
      activeTouchedInPeriod: countUsersActiveInRange(platform.users, range.start, range.end),
    },
    revenueBroCents: {
      fiatDeposits: depositsBroCents,
      fiatWithdrawals: withdrawalsBroCents,
      commerceStore: commerce.store_item,
      commerceTransfers: commerce.transfer_player,
      commerceBundle: commerce.bundle,
      commerceLineCount: commerce.count,
      proxyTotal: revenueProxyBro,
      depositOperations: countDepositEvents(fiatInRange),
    },
    funnel: {
      bannerImpressions: pulse.impressions,
      ctaClicks: pulse.clicks,
      ctr: pulse.ctr,
      attributedSignups: pulse.attributed,
      signupToFirstDepositRate: conv.rate,
      signupToFirstDepositCounts: { converted: conv.converted, signups: conv.signups },
    },
    olexp: uptake,
    topCountries: topCountries(platform.users, 8),
    projectionMonthUtc: {
      monthToDateProxyBroCents: projection.monthToDateCents,
      projectedMonthEndProxyBroCents: projection.projectedMonthEndCents,
      avgLast7DaysProxyBroCents: projection.avgLastWindowCents,
      daysRemainingInMonthUtc: projection.daysRemainingInMonth,
    },
    cashflow: {
      expensesBrlCentsInPeriod: expensesBrl,
      expensesByCategoryBrlCents: expensesByCat,
      expenseLineCountInPeriod: expandRecurringExpenses(platform.growthCashflowExpenses ?? [], range.start, range.end).filter((l) => {
        const t = new Date(`${l.date}T12:00:00.000Z`).getTime();
        return t >= range.start.getTime() && t <= range.end.getTime();
      }).length,
      broCentsPerBrlReference: fx ?? null,
      expensesApproxBroCents: expensesBroApprox,
      netProxyBroMinusOpexApprox: netBroApprox,
    },
    last14DaysSeries: buildDailyRevenueSeries(
      platform,
      (() => {
        const x = new Date();
        x.setUTCHours(0, 0, 0, 0);
        x.setUTCDate(x.getUTCDate() - 13);
        return x;
      })(),
      (() => {
        const x = new Date();
        x.setUTCHours(23, 59, 59, 999);
        return x;
      })(),
    ).map((p) => ({
      date: p.date,
      netGrowthProxyBroCents: p.netGrowthCents,
      depositsBroCents: p.depositsCents,
      commerceRevenueBroCents: p.commerceRevenueCents,
    })),
  };
}
