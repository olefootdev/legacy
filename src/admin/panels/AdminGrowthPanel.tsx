import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Globe2,
  Landmark,
  LineChart,
  MousePointerClick,
  Percent,
  PiggyBank,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBroFromCents } from '@/systems/economy';
import { computePlatformAggregate, useAdminPlatformStore } from '@/admin/platformStore';
import {
  buildDailyRevenueSeries,
  commerceTotals,
  conversionSignupToFirstDeposit,
  countDepositEvents,
  countNewUsers,
  countUsersActiveInRange,
  filterLedgerCompletedFiat,
  growthTimeRange,
  olexpUptake,
  projectMonthEndRevenue,
  pulseTotals,
  sumFiatDepositsCents,
  sumFiatWithdrawalsCents,
  topCountries,
  type GrowthRangePreset,
} from '@/admin/growthMetrics';
import { GrowthAnalystSection } from '@/admin/panels/growth/GrowthAnalystSection';
import { GrowthCashflowSection } from '@/admin/panels/growth/GrowthCashflowSection';

type GrowthSectionTab = 'metrics' | 'analyst' | 'cashflow';

const SECTION_TABS: { id: GrowthSectionTab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'metrics', label: 'Métricas', icon: BarChart3 },
  { id: 'analyst', label: 'Analista IA', icon: Bot },
  { id: 'cashflow', label: 'Cashflow', icon: Wallet },
];

const PRESETS: { id: GrowthRangePreset; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'month', label: 'Mês' },
];

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Wallet;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-4">
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</p>
          <p className="mt-1 break-words font-display text-xl font-black tracking-tight text-white md:text-2xl">
            {value}
          </p>
          {sub ? <p className="mt-0.5 text-xs text-white/45">{sub}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Icon className="h-7 w-7 text-white/25" />
          {trend === 'up' ? <ArrowUpRight className="h-4 w-4 text-emerald-400/80" /> : null}
          {trend === 'down' ? <ArrowDownRight className="h-4 w-4 text-rose-400/80" /> : null}
        </div>
      </div>
    </div>
  );
}

export function AdminGrowthPanel() {
  const platform = useAdminPlatformStore((s) => s);
  const [preset, setPreset] = useState<GrowthRangePreset>('7d');
  const [section, setSection] = useState<GrowthSectionTab>('metrics');

  const range = useMemo(() => growthTimeRange(preset), [preset]);
  const ag = useMemo(() => computePlatformAggregate(platform), [platform]);

  const fiatInRange = useMemo(
    () => filterLedgerCompletedFiat(platform.platformLedger, range.start, range.end),
    [platform.platformLedger, range.start, range.end],
  );

  const depositsCents = useMemo(() => sumFiatDepositsCents(fiatInRange), [fiatInRange]);
  const withdrawalsCents = useMemo(() => sumFiatWithdrawalsCents(fiatInRange), [fiatInRange]);
  const depositCount = useMemo(() => countDepositEvents(fiatInRange), [fiatInRange]);
  const newUsers = useMemo(
    () => countNewUsers(platform.users, range.start, range.end),
    [platform.users, range.start, range.end],
  );
  const activeTouched = useMemo(
    () => countUsersActiveInRange(platform.users, range.start, range.end),
    [platform.users, range.start, range.end],
  );

  const commerce = useMemo(
    () => commerceTotals(platform.growthCommerceLines, range.start, range.end),
    [platform.growthCommerceLines, range.start, range.end],
  );

  const pulse = useMemo(
    () => pulseTotals(platform.growthDailyPulse, range.start, range.end),
    [platform.growthDailyPulse, range.start, range.end],
  );

  const conv = useMemo(
    () => conversionSignupToFirstDeposit(platform.users, platform.platformLedger, range.start, range.end),
    [platform.users, platform.platformLedger, range.start, range.end],
  );

  const uptake = useMemo(() => olexpUptake(platform), [platform]);
  const countries = useMemo(() => topCountries(platform.users, 6), [platform.users]);

  const projection = useMemo(() => projectMonthEndRevenue(platform, new Date(), 7), [platform]);

  const chartStart = useMemo(() => {
    const x = new Date();
    x.setUTCHours(0, 0, 0, 0);
    x.setUTCDate(x.getUTCDate() - 13);
    return x;
  }, []);
  const chartEnd = useMemo(() => {
    const x = new Date();
    x.setUTCHours(23, 59, 59, 999);
    return x;
  }, []);
  const chartSeries = useMemo(
    () => buildDailyRevenueSeries(platform, chartStart, chartEnd),
    [platform, chartStart, chartEnd],
  );
  const chartMax = useMemo(() => Math.max(1, ...chartSeries.map((p) => p.netGrowthCents)), [chartSeries]);

  const ticketMedioDeposito =
    depositCount > 0 ? Math.round(depositsCents / depositCount) : 0;

  const faturamentoPlataformaPeriodo = depositsCents + commerce.revenueCents;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-100/90">
        <strong className="text-white">Growth</strong> — métricas a partir do armazenamento local da plataforma (
        <code className="text-neon-yellow/80">olefoot-admin-platform-v1</code>
        ). Depósitos usam o ledger administrativo; loja e mercado usam{' '}
        <strong className="text-white">growthCommerceLines</strong>; CTA usa{' '}
        <strong className="text-white">growthDailyPulse</strong>; despesas reais em{' '}
        <strong className="text-white">Cashflow</strong> (R$). Para dados reais, liga estes feeds ao teu backend /
        warehouse (ex.: Supabase + ETL diário).
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-black tracking-tight text-white md:text-xl">Crescimento OLEFOOT</h2>
          <p className="mt-1 text-xs text-white/45">
            Período: <span className="text-white/70">{range.label}</span> · UTC · base{' '}
            <span className="text-white/55">{ag.userCount}</span> contas (
            <span className="text-emerald-200/90">{ag.activeUsers}</span> ativas)
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-black/30 p-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-[10px] font-black uppercase tracking-wide',
                preset === p.id ? 'bg-neon-yellow text-black' : 'text-white/45 hover:bg-white/10 hover:text-white',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-black/30 p-1">
        {SECTION_TABS.map((t) => {
          const Icon = t.icon;
          const on = section === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSection(t.id)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-[10px] font-black uppercase tracking-wide',
                on ? 'bg-white/15 text-white' : 'text-white/45 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {section === 'analyst' ? <GrowthAnalystSection platform={platform} preset={preset} /> : null}
      {section === 'cashflow' ? <GrowthCashflowSection preset={preset} /> : null}

      {section === 'metrics' ? (
        <>
      <div>
        <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">KPIs do período</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Novos registos"
            value={String(newUsers)}
            sub={`${activeTouched} contas com actividade no período`}
            icon={UserPlus}
          />
          <Kpi
            label="Volume de depósitos"
            value={formatBroFromCents(depositsCents)}
            sub={`${depositCount} operações · média ${formatBroFromCents(ticketMedioDeposito)}`}
            icon={PiggyBank}
            trend="up"
          />
          <Kpi
            label="Saques (volume)"
            value={formatBroFromCents(withdrawalsCents)}
            sub="Fiat concluído no ledger"
            icon={Landmark}
          />
          <Kpi
            label="Faturamento (proxy)"
            value={formatBroFromCents(faturamentoPlataformaPeriodo)}
            sub="Σ depósitos + receita loja/mercado"
            icon={Wallet}
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Kpi
          label="Receita — loja"
          value={formatBroFromCents(commerce.store_item)}
          sub={`${commerce.count} linhas comércio · bundles ${formatBroFromCents(commerce.bundle)}`}
          icon={ShoppingBag}
        />
        <Kpi
          label="Receita — mercado (jogadores)"
          value={formatBroFromCents(commerce.transfer_player)}
          sub={`Volume bruto Σ ${formatBroFromCents(commerce.grossCents)} (informativo)`}
          icon={TrendingUp}
        />
        <Kpi
          label="CTR (banner → CTA)"
          value={`${(pulse.ctr * 100).toFixed(2)}%`}
          sub={`${pulse.clicks.toLocaleString('pt-BR')} cliques / ${pulse.impressions.toLocaleString('pt-BR')} imp.`}
          icon={MousePointerClick}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Kpi
          label="Conversão registo → 1.º depósito"
          value={`${(conv.rate * 100).toFixed(1)}%`}
          sub={`${conv.converted} / ${conv.signups} novos no período (janela 14d após registo)`}
          icon={Percent}
        />
        <Kpi
          label="OLEXP — adopção"
          value={`${uptake.usersWithLock} / ${ag.userCount}`}
          sub={`${uptake.positionsActive} posições · ${formatBroFromCents(uptake.principalCents)} principal`}
          icon={LineChart}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/25 p-4">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-neon-yellow/80" />
            <h3 className="text-sm font-black uppercase tracking-wide text-white/85">Últimos 14 dias (UTC)</h3>
          </div>
          <p className="mb-4 text-[11px] text-white/40">
            Barras: depósitos + receita comércio por dia (<span className="text-white/55">netGrowth</span>).
          </p>
          <div className="flex h-36 items-end gap-1">
            {chartSeries.map((p) => {
              const h = Math.round((p.netGrowthCents / chartMax) * 100);
              return (
                <div key={p.date} className="group flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full max-w-[14px] rounded-t bg-gradient-to-t from-fuchsia-600/80 to-neon-yellow/90"
                    style={{ height: `${Math.max(8, h)}%` }}
                    title={`${p.date}: ${formatBroFromCents(p.netGrowthCents)}`}
                  />
                  <span className="hidden text-[8px] text-white/30 group-hover:block">{p.date.slice(8)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-5 w-5 text-emerald-400/90" />
            <h3 className="text-sm font-black uppercase tracking-wide text-white/85">Projeção — mês corrente</h3>
          </div>
          <p className="text-xs text-white/50">
            Acumulado (depósitos + comércio):{' '}
            <strong className="text-white">{formatBroFromCents(projection.monthToDateCents)}</strong>
          </p>
          <p className="mt-2 text-xs text-white/50">
            Média diária (últimos 7d):{' '}
            <strong className="text-neon-yellow/90">{formatBroFromCents(projection.avgLastWindowCents)}</strong>
          </p>
          <p className="mt-2 text-xs text-white/50">
            Dias úteis restantes (UTC):{' '}
            <strong className="text-white">{projection.daysRemainingInMonth}</strong>
          </p>
          <p className="mt-4 border-t border-white/10 pt-4 font-display text-2xl font-black text-white">
            {formatBroFromCents(projection.projectedMonthEndCents)}
          </p>
          <p className="text-[11px] text-white/35">
            Projeção linear: acumulado + média × dias restantes. Ajusta com sazonalidade quando tiveres histórico
            longo.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-sky-400/90" />
          <h3 className="text-sm font-black uppercase tracking-wide text-white/85">Base por país</h3>
        </div>
        <ul className="flex flex-wrap gap-2">
          {countries.map((c) => (
            <li
              key={c.country}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80"
            >
              <span className="font-bold">{c.country}</span>{' '}
              <span className="text-white/40">({c.count})</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-300/90" />
          <h3 className="text-sm font-black uppercase tracking-wide text-white/90">Próximas funções sugeridas</h3>
        </div>
        <ul className="grid gap-2 text-sm text-white/55 md:grid-cols-2">
          <li>
            — <strong className="text-white/75">Cohort retention</strong> (D1/D7/D30) por semana de registo
          </li>
          <li>
            — <strong className="text-white/75">LTV vs CAC</strong> quando houver custo de aquisição por canal
          </li>
          <li>
            — <strong className="text-white/75">Funil por UTM</strong> (campanha → registo → depósito → compra)
          </li>
          <li>
            — <strong className="text-white/75">Alertas</strong> (queda de CTR, pico de chargeback, anomalia de
            depósitos)
          </li>
          <li>
            — <strong className="text-white/75">Export CSV</strong> diário para o teu BI
          </li>
          <li>
            — <strong className="text-white/75">ARPU / ARPPU</strong> por segmento (OLEXP sim vs não)
          </li>
        </ul>
      </div>
        </>
      ) : null}
    </div>
  );
}
