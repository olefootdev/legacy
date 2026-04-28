/**
 * Painel de estatísticas em tempo real da partida ao vivo — substitui o "Relato ao vivo".
 *
 * Consome `live.homeStats` (populado pelo TacticalSimLoop + SIM_SYNC) e agrega
 * pra mostrar métricas globais do time da casa. Atualiza a cada tick do motor.
 */

import { memo, useMemo } from 'react';
import { BarChart3, Target, Shield, Users, Swords, Hand, Zap, Flag, AlertCircle } from 'lucide-react';
import { useGameStore } from '@/game/store';
import type { LiveMatchSnapshot } from '@/engine/types';

interface AggregatedStats {
  passesOk: number;
  passesAttempt: number;
  tackles: number;
  shotsOn: number;
  shotsOff: number;
  saves: number;
  dribblesOk: number;
  km: number;
}

function aggregateHomeStats(live: LiveMatchSnapshot | null): AggregatedStats {
  const out: AggregatedStats = {
    passesOk: 0, passesAttempt: 0, tackles: 0,
    shotsOn: 0, shotsOff: 0, saves: 0, dribblesOk: 0, km: 0,
  };
  if (!live?.homeStats) return out;
  for (const s of Object.values(live.homeStats)) {
    out.passesOk += s.passesOk ?? 0;
    out.passesAttempt += s.passesAttempt ?? 0;
    out.tackles += s.tackles ?? 0;
    out.shotsOn += (s as { shotsOn?: number }).shotsOn ?? 0;
    out.shotsOff += (s as { shotsOff?: number }).shotsOff ?? 0;
    out.saves += (s as { saves?: number }).saves ?? 0;
    out.dribblesOk += (s as { dribblesOk?: number }).dribblesOk ?? 0;
    out.km += s.km ?? 0;
  }
  return out;
}

function countCards(live: LiveMatchSnapshot | null): { yellow: number; red: number } {
  if (!live?.events) return { yellow: 0, red: 0 };
  let yellow = 0;
  let red = 0;
  for (const ev of live.events) {
    if (ev.kind === 'yellow_home') yellow++;
    else if (ev.kind === 'red_home') red++;
  }
  return { yellow, red };
}

function countFouls(live: LiveMatchSnapshot | null): number {
  if (!live?.causalLog?.entries) return 0;
  let n = 0;
  for (const e of live.causalLog.entries) {
    if (e.type === 'foul_committed' && 'payload' in e && e.payload?.foulerSide === 'home') {
      n++;
    }
  }
  return n;
}

function countCorners(live: LiveMatchSnapshot | null): { home: number; away: number } {
  // Conta escanteios via ball_state causal (reason: 'recovery_attack' disparado em
  // handleThrowIn restartType='corner_kick' → reason específico por time) — fonte
  // direta do motor, não parsing de texto.
  const out = { home: 0, away: 0 };
  const causal = live?.causalLog?.entries ?? [];
  for (const e of causal) {
    if (e.type === 'ball_state' && 'payload' in e) {
      const reason = String((e.payload as { reason?: string }).reason ?? '');
      if (reason === 'corner_home') out.home++;
      else if (reason === 'corner_away') out.away++;
    }
  }
  // Fallback: se o motor ainda não emite reasons canônicas, parseia o feed.
  if (out.home === 0 && out.away === 0 && live?.events) {
    for (const ev of live.events) {
      if (ev.kind !== 'whistle') continue;
      const t = ev.text?.toLowerCase() ?? '';
      if (!/(escanteio|canto\s+para)/.test(t)) continue;
      const homeShort = live.homeShort?.toLowerCase() ?? '';
      const awayShort = live.awayShort?.toLowerCase() ?? '';
      if (homeShort && t.includes(homeShort)) out.home++;
      else if (awayShort && t.includes(awayShort)) out.away++;
    }
  }
  return out;
}

function LiveStatsPanelInner() {
  const live = useGameStore((s) => s.liveMatch);
  const stats = useMemo(() => aggregateHomeStats(live), [live?.homeStats]);
  const cards = useMemo(() => countCards(live), [live?.events]);
  const fouls = useMemo(() => countFouls(live), [live?.causalLog?.entries]);
  const corners = useMemo(() => countCorners(live), [live?.events, live?.homeShort, live?.awayShort]);

  if (!live || live.phase !== 'playing') return null;

  const totalShots = stats.shotsOn + stats.shotsOff;
  const passAcc = stats.passesAttempt > 0
    ? Math.round((stats.passesOk / stats.passesAttempt) * 100)
    : null;
  const km = stats.km.toFixed(1);

  return (
    <div
      className="px-2.5 sm:px-3 py-2.5"
      aria-label="Estatísticas da partida em tempo real"
      style={{
        background: 'rgba(13,13,13,0.78)',
        border: '1px solid var(--color-divider-soft)',
        borderTop: '2px solid var(--color-event-save)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="h-3 w-3" style={{ color: 'var(--color-event-save)' }} />
          <span
            className="font-ui font-bold uppercase"
            style={{
              color: 'var(--color-event-save)',
              fontSize: '9px',
              letterSpacing: '0.32em',
            }}
          >
            Stats ao vivo · {live.homeShort ?? 'Casa'}
          </span>
        </div>
        <span
          className="font-display font-black tabular-nums leading-none"
          style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px' }}
        >
          {live.minute}'
        </span>
      </header>

      <div className="grid grid-cols-4 gap-1.5">
        <StatTile icon={Target} label="Chutes" value={totalShots.toString()} sub={`${stats.shotsOn} no gol`} accent="emerald" />
        <StatTile icon={Zap} label="Passes" value={stats.passesOk.toString()} sub={passAcc !== null ? `${passAcc}%` : '—'} accent="sky" />
        <StatTile icon={Swords} label="Desarmes" value={stats.tackles.toString()} accent="amber" />
        <StatTile icon={Hand} label="Dribles" value={stats.dribblesOk.toString()} accent="fuchsia" />
        <StatTile icon={Shield} label="Defesas GK" value={stats.saves.toString()} accent="indigo" />
        <StatTile icon={AlertCircle} label="Faltas" value={fouls.toString()} accent="rose" />
        <StatTile icon={Flag} label="Escanteios" value={corners.home.toString()} sub={`${corners.away} adv`} accent="teal" />
        <StatTile
          icon={Users}
          label="Cartões"
          value={`${cards.yellow}🟨`}
          sub={cards.red > 0 ? `${cards.red}🟥` : '—'}
          accent={cards.red > 0 ? 'rose' : 'yellow'}
        />
      </div>

      <p
        className="mt-2 text-center font-ui"
        style={{ color: 'rgba(255,255,255,0.32)', fontSize: '9px', letterSpacing: '0.18em' }}
      >
        {km} km · {Object.keys(live.homeStats ?? {}).length} ativos · tick contínuo
      </p>
    </div>
  );
}

export const LiveStatsPanel = memo(LiveStatsPanelInner);

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  sub?: string;
  accent: 'emerald' | 'sky' | 'amber' | 'fuchsia' | 'indigo' | 'rose' | 'teal' | 'yellow';
}) {
  const ACCENT: Record<string, string> = {
    emerald: 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200',
    sky: 'border-sky-500/25 bg-sky-500/[0.06] text-sky-200',
    amber: 'border-amber-500/25 bg-amber-500/[0.06] text-amber-200',
    fuchsia: 'border-fuchsia-500/25 bg-fuchsia-500/[0.06] text-fuchsia-200',
    indigo: 'border-indigo-500/25 bg-indigo-500/[0.06] text-indigo-200',
    rose: 'border-rose-500/30 bg-rose-500/[0.08] text-rose-200',
    teal: 'border-teal-500/25 bg-teal-500/[0.06] text-teal-200',
    yellow: 'border-yellow-500/25 bg-yellow-500/[0.06] text-yellow-200',
  };
  return (
    <div className={`rounded border px-1.5 py-1 text-center ${ACCENT[accent]}`}>
      <div className="flex items-center justify-center gap-1">
        <Icon className="h-2.5 w-2.5" />
        <span className="text-[8px] font-bold uppercase tracking-wider opacity-80">{label}</span>
      </div>
      <p className="font-mono text-sm font-black tabular-nums leading-none">{value}</p>
      {sub ? <p className="text-[8px] leading-none opacity-60">{sub}</p> : null}
    </div>
  );
}
