import { useMemo } from 'react';
import { Landmark, Lock, Users, Wallet } from 'lucide-react';
import { formatBroFromCents, formatExp } from '@/systems/economy';
import { cn } from '@/lib/utils';
import { computePlatformAggregate, useAdminPlatformStore } from '@/admin/platformStore';

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Wallet;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-4">
      <div className={cn('absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-20 blur-2xl', accent)} />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</p>
          <p className="mt-1 font-display text-2xl font-black tracking-tight text-white">{value}</p>
          {sub ? <p className="mt-0.5 text-xs text-white/45">{sub}</p> : null}
        </div>
        <Icon className="h-8 w-8 shrink-0 text-white/25" />
      </div>
    </div>
  );
}

/**
 * Resumo da plataforma (Admin). Só métricas de plataforma — não mistura
 * com o save local do browser (Admin não é clube). Dados vêm de
 * `AdminPlatformStore` populado por fetch real do Supabase.
 */
export function AdminOverviewPanel() {
  const platform = useAdminPlatformStore((s) => s);
  const platAg = useMemo(() => computePlatformAggregate(platform), [platform]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100/90">
        <strong className="text-white">Visão plataforma</strong> — agregados de todas as contas registadas.
        Use <strong className="text-white">Usuários</strong> pra sincronizar do Supabase. Tesouraria e fluxos
        crescem conforme managers reais interagem.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Contas registadas"
          value={String(platAg.userCount)}
          sub={`${platAg.activeUsers} ativas`}
          icon={Users}
          accent="bg-cyan-500"
        />
        <KpiCard
          label="Σ BRO (utilizadores)"
          value={formatBroFromCents(platAg.sumBroCents)}
          sub="soma carteiras"
          icon={Wallet}
          accent="bg-emerald-500"
        />
        <KpiCard
          label="Σ SPOT BRO"
          value={formatBroFromCents(platAg.sumSpotBroCents)}
          sub={`Σ EXP ranking ${formatExp(platAg.sumOle)}`}
          icon={Wallet}
          accent="bg-sky-500"
        />
        <KpiCard
          label="Tesouraria OLEFOOT"
          value={formatBroFromCents(platAg.treasuryBroCents)}
          sub="caixa operacional"
          icon={Landmark}
          accent="bg-amber-500"
        />
        <KpiCard
          label="OLEXP trancado (Σ)"
          value={formatBroFromCents(platAg.sumOlexpLockedCents)}
          sub={`yield acc. ${formatBroFromCents(platAg.sumOlexpYieldAccruedCents)}`}
          icon={Lock}
          accent="bg-violet-500"
        />
      </div>
    </div>
  );
}
