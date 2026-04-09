import { useMemo } from 'react';
import { Landmark, Lock, TrendingUp, Mail, Trophy, Users, Wallet } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { formatBroFromCents, formatExp } from '@/systems/economy';
import { isHiddenFromHomeInboxFeed } from '@/game/inboxTypes';
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

export function AdminOverviewPanel() {
  const platform = useAdminPlatformStore((s) => s);
  const platAg = useMemo(() => computePlatformAggregate(platform), [platform]);

  const ole = useGameStore((s) => s.finance.ole);
  const broCents = useGameStore((s) => s.finance.broCents);
  const spotBro = useGameStore((s) => s.finance.wallet?.spotBroCents ?? 0);
  const inbox = useGameStore((s) => s.inbox);
  const leagues = useGameStore((s) => s.adminLeagues.length);
  const players = useGameStore((s) => Object.keys(s.players).length);
  const form = useGameStore((s) => s.form);
  const live = useGameStore((s) => s.liveMatch);

  const feedUnread = useMemo(
    () => inbox.filter((i) => !i.read && !isHiddenFromHomeInboxFeed(i)).length,
    [inbox],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100/90">
        <strong className="text-white">Visão plataforma</strong> (cartões da primeira fila): soma de todas as contas em{' '}
        <span className="font-bold text-neon-yellow">Usuários</span> + tesouraria global. A fila seguinte é apenas o{' '}
        <strong className="text-white">save deste browser</strong>.
      </div>

      <h2 className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Plataforma</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Contas (registadas)"
          value={String(platAg.userCount)}
          sub={`${platAg.activeUsers} ativos`}
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
          sub="caixa operacional (Admin)"
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

      <h2 className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Sessão local (save)</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="EXP (saldo)" value={formatExp(ole)} icon={TrendingUp} accent="bg-neon-yellow" />
        <KpiCard
          label="BRO (jogo)"
          value={formatBroFromCents(broCents)}
          sub="finance.broCents"
          icon={Wallet}
          accent="bg-emerald-500"
        />
        <KpiCard
          label="SPOT (wallet)"
          value={formatBroFromCents(spotBro)}
          sub="wallet hub"
          icon={Wallet}
          accent="bg-sky-500"
        />
        <KpiCard label="Ligas ativas" value={String(leagues)} sub="competições" icon={Trophy} accent="bg-violet-500" />
        <KpiCard label="Plantel" value={String(players)} sub="jogadores" icon={Users} accent="bg-orange-500" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
              Forma recente (liga principal)
            </h3>
            <span className="text-[10px] text-white/35">{live ? 'Partida em curso' : 'Sem live match'}</span>
          </div>
          <div className="flex h-16 items-end gap-1">
            {form.slice(0, 8).map((f, i) => {
              const h = f === 'W' ? 100 : f === 'D' ? 55 : 30;
              const bg = f === 'W' ? 'bg-neon-green' : f === 'D' ? 'bg-gray-500' : 'bg-red-500';
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={cn('w-full max-w-[2.5rem] rounded-t transition-all', bg)}
                    style={{ height: `${h}%` }}
                  />
                  <span className="font-mono text-[10px] font-bold text-white/50">{f}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Mail className="h-4 w-4 text-white/40" />
            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">Inbox</h3>
          </div>
          <p className="font-display text-3xl font-black text-white">{feedUnread}</p>
          <p className="text-xs text-white/45">Notificações visíveis na home por ler</p>
          <p className="mt-2 text-[10px] text-white/30">Total itens: {inbox.length}</p>
        </div>
      </div>
    </div>
  );
}
