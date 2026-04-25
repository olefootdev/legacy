import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  CalendarDays,
  Clock,
  AlertTriangle,
  Trophy,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Play,
  Shield,
  Flag,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { GameBannerBackdrop } from '@/components/GameBannerBackdrop';
import { cn } from '@/lib/utils';
import type { TrainingPlan } from '@/game/types';
import {
  fixtureKickoffMs,
  fixtureInvolvesUser,
  userTeamIdForLeague,
  type ScheduledLeagueFixture,
} from '@/match/leagueSchedule';
import {
  FULL_CALENDAR_DAY_SLOT_TIMES,
  OFFICIAL_MATCH_SLOT_TIMES,
  OFFICIAL_TRAINING_SLOT_TIMES,
  trainingWindowLabelForCalendarSlot,
  evaluateOfficialSquad,
} from '@/match/squadEligibility';

function formatDayLabel(dateIso: string): string {
  try {
    const d = new Date(`${dateIso}T12:00:00`);
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateIso;
  }
}

function formatDayShort(dateIso: string): { weekday: string; day: string } {
  try {
    const d = new Date(`${dateIso}T12:00:00`);
    const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3).toUpperCase();
    const day = String(d.getDate()).padStart(2, '0');
    return { weekday, day };
  } catch {
    return { weekday: '—', day: '–' };
  }
}

function localDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return localDateIso(d);
}

function planTouchesDay(plan: TrainingPlan, dayIso: string): boolean {
  if (plan.status !== 'running') return false;
  const start = plan.startedAt.slice(0, 10);
  const end = plan.endAt.slice(0, 10);
  return start <= dayIso && end >= dayIso;
}

function trainingPlanLabel(plan: TrainingPlan): string {
  const mode = plan.mode === 'coletivo' ? 'Coletivo' : 'Individual';
  const type = plan.trainingType.replace(/_/g, ' ');
  return `${mode} · ${type}`;
}

function statusBadge(fx: ScheduledLeagueFixture): { text: string; className: string } {
  if (fx.status === 'scheduled') return { text: 'Agendado', className: 'bg-white/10 text-gray-300' };
  if (fx.status === 'walkover')
    return { text: 'WO', className: 'bg-red-500/20 text-red-300 border border-red-500/30' };
  return { text: 'FT', className: 'bg-neon-green/15 text-neon-green border border-neon-green/30' };
}

/** Countdown humanizado "em 2d 4h", "em 47min", "começou há 12min". */
function formatCountdown(targetMs: number, nowMs: number): { label: string; urgent: boolean; live: boolean } {
  const diff = targetMs - nowMs;
  if (Math.abs(diff) < 60_000) return { label: 'agora', urgent: true, live: true };
  if (diff < 0) {
    const mins = Math.round(-diff / 60_000);
    if (mins < 60) return { label: `começou há ${mins}min`, urgent: true, live: true };
    const h = Math.round(mins / 60);
    return { label: `há ${h}h`, urgent: false, live: false };
  }
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return { label: `em ${mins}min`, urgent: true, live: false };
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    const m = mins - hours * 60;
    return { label: m > 0 ? `em ${hours}h ${m}min` : `em ${hours}h`, urgent: hours <= 2, live: false };
  }
  const days = Math.floor(hours / 24);
  const h2 = hours - days * 24;
  return { label: h2 > 0 ? `em ${days}d ${h2}h` : `em ${days}d`, urgent: false, live: false };
}

export function Calendar() {
  const adminLeagues = useGameStore((s) => s.adminLeagues);
  const adminPrimaryLeagueId = useGameStore((s) => s.adminPrimaryLeagueId);
  const leagueSchedule = useGameStore((s) => s.leagueSchedule);
  const club = useGameStore((s) => s.club);
  const lineup = useGameStore((s) => s.lineup);
  const players = useGameStore((s) => s.players);
  const trainingPlans = useGameStore((s) => s.manager.trainingPlans);

  const league = adminLeagues.find((l) => l.id === adminPrimaryLeagueId);
  const bucket = league ? leagueSchedule.byLeagueId[league.id] : undefined;
  const userTeamId = league ? userTeamIdForLeague(league, club) : undefined;
  const squad = evaluateOfficialSquad(lineup, players);

  /** Tick de 30s pra countdown se manter fresco. */
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const todayIso = useMemo(() => localDateIso(new Date()), []);
  const [dayIso, setDayIso] = useState(() => todayIso);

  const slotTimeSet = useMemo(() => new Set(OFFICIAL_MATCH_SLOT_TIMES), []);
  const trainingSlotTimeSet = useMemo(() => new Set(OFFICIAL_TRAINING_SLOT_TIMES), []);

  const fixturesOnDay = useMemo(() => {
    if (!bucket?.fixtures.length) return [];
    return bucket.fixtures.filter((f) => f.dateIso === dayIso);
  }, [bucket?.fixtures, dayIso]);

  const fixtureAtKickoff = useMemo(() => {
    const m = new Map<string, ScheduledLeagueFixture>();
    for (const f of fixturesOnDay) {
      m.set(f.kickoffHHmm, f);
    }
    return m;
  }, [fixturesOnDay]);

  const orphanFixturesOnDay = useMemo(
    () => fixturesOnDay.filter((f) => !slotTimeSet.has(f.kickoffHHmm)),
    [fixturesOnDay, slotTimeSet],
  );

  const plansOnDay = useMemo(
    () => trainingPlans.filter((p) => planTouchesDay(p, dayIso)),
    [trainingPlans, dayIso],
  );

  const nextUser = useMemo(() => {
    if (!bucket?.fixtures?.length) return undefined;
    return bucket.fixtures
      .filter((f) => f.status === 'scheduled' && fixtureInvolvesUser(f, userTeamId))
      .sort((a, b) => fixtureKickoffMs(a) - fixtureKickoffMs(b))
      .find((f) => fixtureKickoffMs(f) > nowMs - 15 * 60_000);
  }, [bucket?.fixtures, userTeamId, nowMs]);

  /** 7 dias a partir de hoje pra strip da semana. */
  const weekDays = useMemo(() => {
    const out: Array<{ iso: string; userMatchCount: number; anyMatchCount: number }> = [];
    for (let i = 0; i < 7; i++) {
      const iso = addDaysIso(todayIso, i);
      const dayFx = bucket?.fixtures.filter((f) => f.dateIso === iso) ?? [];
      out.push({
        iso,
        userMatchCount: dayFx.filter((f) => fixtureInvolvesUser(f, userTeamId)).length,
        anyMatchCount: dayFx.length,
      });
    }
    return out;
  }, [todayIso, bucket?.fixtures, userTeamId]);

  const [showRivalMatches, setShowRivalMatches] = useState(false);
  const [showOrphans, setShowOrphans] = useState(false);

  const nextUserKickoffMs = nextUser ? fixtureKickoffMs(nextUser) : null;
  const countdown = nextUserKickoffMs ? formatCountdown(nextUserKickoffMs, nowMs) : null;
  const canPlayNow = nextUser && countdown && (countdown.live || (nextUserKickoffMs! - nowMs) <= 2 * 60 * 60_000);

  const myOpponent = useMemo(() => {
    if (!nextUser || !userTeamId) return null;
    const isHome = nextUser.homeTeamId === userTeamId;
    return isHome
      ? { isHome: true, opponent: nextUser.awayName }
      : { isHome: false, opponent: nextUser.homeName };
  }, [nextUser, userTeamId]);

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-5 pb-28 md:pb-12">
      {/* ── HERO ─────────────────────────────────────────────────── */}
      {!squad.ok ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-md border-2 border-red-500/50 bg-red-950/40 shadow-xl shadow-red-950/40"
        >
          <div className="relative z-10 p-5 md:p-6">
            <div className="flex items-center gap-2 text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="font-display text-[10px] font-black uppercase tracking-widest">
                Risco de WO se começar agora
              </span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
              Ajusta o plantel
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-red-100/90">{squad.reason}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-red-100/70">
              Precisa de <strong className="text-white">11 titulares</strong> disponíveis (sem lesão/suspensão) e pelo
              menos <strong className="text-white">5 no banco</strong>.
            </p>
            {nextUser && countdown ? (
              <p className="mt-3 text-[11px] text-red-100/90">
                Próximo jogo: <strong className="text-white">{nextUser.homeName} × {nextUser.awayName}</strong>
                {' · '}{formatDayLabel(nextUser.dateIso)} {nextUser.kickoffHHmm}
                {' · '}<span className="text-red-300 font-bold">{countdown.label}</span>
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/team"
                className="inline-flex items-center gap-1.5 rounded-lg bg-neon-yellow px-4 py-2 font-display text-xs font-black uppercase tracking-wider text-black hover:bg-white"
              >
                <Shield className="h-3.5 w-3.5" /> Ajustar escalação
              </Link>
              <Link
                to="/transfer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10"
              >
                Ir ao mercado
              </Link>
            </div>
          </div>
        </motion.section>
      ) : nextUser && myOpponent && countdown ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-md border border-neon-yellow/30"
        >
          <GameBannerBackdrop slot="leagues_header" imageOpacity={0.35} />
          <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/55 to-black/80" aria-hidden />
          <div className="relative z-10 p-5 md:p-6">
            <div className="flex items-center gap-2 text-neon-yellow">
              <Clock className={cn('h-4 w-4 shrink-0', countdown.live && 'animate-pulse')} />
              <span className="font-display text-[10px] font-black uppercase tracking-widest">
                Próximo jogo · {countdown.label}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-display text-[10px] font-bold uppercase tracking-wider text-white/50">
                  {myOpponent.isHome ? 'Em casa contra' : 'Fora, contra'}
                </p>
                <h1 className="truncate font-display text-2xl font-black tracking-tight text-white md:text-3xl">
                  {myOpponent.opponent}
                </h1>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-xs text-white/70">
                  {formatDayLabel(nextUser.dateIso).replace(/,/g, '')}
                </p>
                <p className="font-display text-2xl font-black text-neon-yellow md:text-3xl">
                  {nextUser.kickoffHHmm}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {canPlayNow ? (
                <Link
                  to="/match/quick"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-neon-yellow px-4 py-2 font-display text-xs font-black uppercase tracking-wider text-black hover:bg-white"
                >
                  <Play className="h-3.5 w-3.5" /> Jogar agora
                </Link>
              ) : (
                <Link
                  to="/team"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-neon-yellow px-4 py-2 font-display text-xs font-black uppercase tracking-wider text-black hover:bg-white"
                >
                  <Shield className="h-3.5 w-3.5" /> Preparar escalação
                </Link>
              )}
              <Link
                to="/team/treino"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10"
              >
                Treino
              </Link>
            </div>
          </div>
        </motion.section>
      ) : (
        <section className="relative overflow-hidden rounded-md border border-white/10">
          <GameBannerBackdrop slot="leagues_header" imageOpacity={0.22} />
          <div className="absolute inset-0 bg-black/55" aria-hidden />
          <div className="relative z-10 p-5 md:p-6">
            <div className="flex items-center gap-2 text-neon-yellow/80">
              <CalendarDays className="h-4 w-4" />
              <span className="font-display text-[10px] font-black uppercase tracking-widest">Calendário</span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-black tracking-tight text-white md:text-3xl">
              Sem jogos agendados
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-400">
              Cria uma liga em <strong className="text-white">pontos corridos</strong> para gerar o calendário e ver
              teus próximos jogos aqui.
            </p>
          </div>
        </section>
      )}

      {/* ── Week strip ──────────────────────────────────────────── */}
      {bucket?.fixtures.length ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-2 flex items-center gap-2">
            <Flag className="h-3.5 w-3.5 text-neon-yellow/70" />
            <span className="font-display text-[10px] font-black uppercase tracking-widest text-white/60">
              Próximos 7 dias
            </span>
          </div>
          <div className="-mx-1 flex gap-1 overflow-x-auto hide-scrollbar">
            {weekDays.map((d) => {
              const short = formatDayShort(d.iso);
              const isToday = d.iso === todayIso;
              const isSelected = d.iso === dayIso;
              const hasUserMatch = d.userMatchCount > 0;
              return (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => setDayIso(d.iso)}
                  className={cn(
                    'flex shrink-0 min-w-[54px] flex-col items-center gap-0.5 rounded-lg border px-2 py-2 transition-colors',
                    isSelected
                      ? 'border-neon-yellow bg-neon-yellow/15'
                      : hasUserMatch
                      ? 'border-neon-yellow/25 bg-neon-yellow/[0.05] hover:bg-neon-yellow/10'
                      : 'border-white/10 bg-black/30 hover:bg-white/5',
                  )}
                >
                  <span
                    className={cn(
                      'font-display text-[9px] font-bold uppercase tracking-wider',
                      isSelected ? 'text-black bg-neon-yellow px-1 rounded' : 'text-gray-500',
                      !isSelected && isToday && 'text-neon-yellow',
                    )}
                  >
                    {isToday ? 'HOJE' : short.weekday}
                  </span>
                  <span className={cn('font-display text-base font-black', isSelected ? 'text-neon-yellow' : 'text-white')}>
                    {short.day}
                  </span>
                  <span className="flex gap-0.5 h-1.5">
                    {hasUserMatch
                      ? Array.from({ length: d.userMatchCount }).map((_, i) => (
                          <span key={i} className="h-1.5 w-1.5 rounded-full bg-neon-yellow" />
                        ))
                      : d.anyMatchCount > 0
                      ? <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                      : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ── Day navigator + timeline ────────────────────────────── */}
      <div className="rounded-md border border-white/12 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDayIso((d) => addDaysIso(d, -1))}
              className="rounded-lg border border-white/10 p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
              aria-label="Dia anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-display text-[11px] font-bold uppercase tracking-wider text-white">
              {formatDayLabel(dayIso)}
            </span>
            <button
              type="button"
              onClick={() => setDayIso((d) => addDaysIso(d, 1))}
              className="rounded-lg border border-white/10 p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
              aria-label="Dia seguinte"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {dayIso !== todayIso ? (
            <button
              type="button"
              onClick={() => setDayIso(todayIso)}
              className="rounded-lg border border-neon-yellow/40 px-2 py-1 font-display text-[10px] font-bold uppercase text-neon-yellow hover:bg-neon-yellow/10"
            >
              Hoje
            </button>
          ) : null}
        </div>

        {plansOnDay.length > 0 ? (
          <div className="mb-3 rounded-lg border border-neon-green/25 bg-neon-green/[0.06] p-3">
            <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-wider text-neon-green/90">
              Treinos em andamento
            </p>
            <ul className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
              {plansOnDay.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/team/treino"
                    className="flex flex-col rounded-lg border border-white/10 bg-black/25 px-3 py-1.5 text-[11px] hover:bg-white/[0.04]"
                  >
                    <span className="font-bold text-white">{trainingPlanLabel(p)}</span>
                    <span className="text-[10px] text-gray-500">
                      {p.startedAt.slice(0, 16).replace('T', ' ')} → {p.endAt.slice(0, 16).replace('T', ' ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <ul className="space-y-1.5">
          {FULL_CALENDAR_DAY_SLOT_TIMES.map((t) => {
            const fx = fixtureAtKickoff.get(t);
            const isMatch = slotTimeSet.has(t);
            const isTrain = trainingSlotTimeSet.has(t);

            if (isMatch) {
              if (fx) {
                const mine = fixtureInvolvesUser(fx, userTeamId);
                const st = statusBadge(fx);
                if (!mine && !showRivalMatches) return null; // esconde rivais até o user abrir
                return (
                  <li key={t}>
                    <div
                      className={cn(
                        'rounded-lg border-l-[3px] px-3 py-2',
                        mine
                          ? 'border-l-neon-yellow border border-neon-yellow/35 bg-neon-yellow/[0.08]'
                          : 'border-l-white/15 border border-white/8 bg-black/20',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-[10px] text-gray-500">{t}</span>
                            {mine ? (
                              <span className="rounded bg-neon-yellow/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-neon-yellow">
                                Teu jogo
                              </span>
                            ) : null}
                          </div>
                          <p className={cn('font-display text-sm leading-tight', mine ? 'font-black text-white' : 'font-bold text-white/80')}>
                            {fx.homeName} <span className="text-gray-500">×</span> {fx.awayName}
                          </p>
                          {fx.status !== 'scheduled' && fx.scoreHome !== undefined && fx.scoreAway !== undefined ? (
                            <p className="mt-0.5 font-mono text-[11px] font-black text-white">
                              {fx.scoreHome}–{fx.scoreAway}
                            </p>
                          ) : null}
                        </div>
                        <span className={cn('shrink-0 rounded px-2 py-0.5 text-[9px] font-bold', st.className)}>
                          {st.text}
                        </span>
                      </div>
                      {mine && fx.status === 'scheduled' ? (
                        <Link
                          to="/match/quick"
                          className="mt-2 inline-flex items-center gap-1 rounded bg-neon-yellow px-2.5 py-1 font-display text-[10px] font-black uppercase tracking-wider text-black hover:bg-white"
                        >
                          <Play className="h-3 w-3" /> Jogar
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              }
              return (
                <li key={t}>
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-white/10 bg-white/[0.015] px-3 py-1.5 border-l-[3px] border-l-neon-yellow/25">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="font-mono text-[10px] text-gray-600">{t}</span>
                      <span className="text-[9px] uppercase tracking-wider text-gray-600">Slot livre</span>
                    </div>
                    <Link to="/leagues" className="shrink-0 text-[10px] font-bold text-neon-green/80 hover:underline">
                      Amistoso →
                    </Link>
                  </div>
                </li>
              );
            }

            if (isTrain) {
              return (
                <li key={t}>
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-neon-green/30 bg-neon-green/[0.04] px-3 py-1.5 border-l-[3px] border-l-neon-green/45">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="font-mono text-[10px] text-gray-500">{t}</span>
                      <span className="text-[9px] uppercase tracking-wider text-neon-green/70 truncate">
                        {trainingWindowLabelForCalendarSlot(t)}
                      </span>
                    </div>
                    <Link
                      to="/team/treino"
                      className="shrink-0 inline-flex items-center gap-1 rounded border border-neon-green/45 bg-neon-green/10 px-2 py-1 font-display text-[10px] font-bold text-neon-green hover:bg-neon-green/20"
                    >
                      <Plus className="h-3 w-3" /> Treino
                    </Link>
                  </div>
                </li>
              );
            }

            return null;
          })}
        </ul>

        {/* Toggle outros jogos da liga no dia */}
        {fixturesOnDay.some((f) => !fixtureInvolvesUser(f, userTeamId)) ? (
          <button
            type="button"
            onClick={() => setShowRivalMatches((v) => !v)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:bg-white/5 hover:text-white"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showRivalMatches && 'rotate-180')} />
            {showRivalMatches
              ? 'Ocultar jogos da liga'
              : `Ver ${fixturesOnDay.filter((f) => !fixtureInvolvesUser(f, userTeamId)).length} outros jogos`}
          </button>
        ) : null}
      </div>

      {/* ── Fora da grelha (accordion colapsável) ──────────────── */}
      {orphanFixturesOnDay.length > 0 ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04]">
          <button
            type="button"
            onClick={() => setShowOrphans((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3"
          >
            <span className="font-display text-[10px] font-bold uppercase tracking-wider text-amber-400/90">
              Fora da grelha · {orphanFixturesOnDay.length} jogo(s)
            </span>
            <ChevronDown className={cn('h-4 w-4 text-amber-400/80 transition-transform', showOrphans && 'rotate-180')} />
          </button>
          {showOrphans ? (
            <ul className="space-y-2 border-t border-amber-500/15 px-4 py-3">
              {orphanFixturesOnDay.map((fx) => {
                const mine = fixtureInvolvesUser(fx, userTeamId);
                const st = statusBadge(fx);
                return (
                  <li
                    key={fx.id}
                    className={cn(
                      'rounded-lg border p-2.5',
                      mine ? 'border-neon-yellow/30 bg-neon-yellow/[0.06]' : 'border-white/10 bg-black/30',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] text-gray-500">{fx.kickoffHHmm}</span>
                        <p className="font-display text-sm font-bold text-white">
                          {fx.homeName} <span className="text-gray-500">×</span> {fx.awayName}
                        </p>
                      </div>
                      <span className={cn('shrink-0 rounded px-2 py-0.5 text-[9px] font-bold', st.className)}>
                        {st.text}
                      </span>
                    </div>
                    {mine && fx.status === 'scheduled' ? (
                      <Link to="/match/quick" className="mt-2 block text-[10px] font-bold text-neon-yellow hover:underline">
                        Partida rápida →
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* ── Footer liga ────────────────────────────────────────── */}
      {league ? (
        <Link
          to="/leagues"
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 hover:bg-white/[0.05]"
        >
          <Trophy className="h-4 w-4 shrink-0 text-neon-yellow/80" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xs font-bold text-white">{league.name}</p>
            <p className="text-[10px] text-gray-500">
              {league.format === 'round_robin' ? 'Pontos corridos' : league.format} · {league.division} · Ver classificação →
            </p>
          </div>
        </Link>
      ) : null}
    </div>
  );
}
