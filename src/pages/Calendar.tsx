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
  Play,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { GameBannerBackdrop } from '@/components/GameBannerBackdrop';
import { BackButton } from '@/components/BackButton';
import { cn } from '@/lib/utils';
import {
  fixtureKickoffMs,
  fixtureInvolvesUser,
  userTeamIdForLeague,
  type ScheduledLeagueFixture,
} from '@/match/leagueSchedule';
import { evaluateOfficialSquad } from '@/match/squadEligibility';

function formatDayLabel(dateIso: string): string {
  try {
    const d = new Date(`${dateIso}T12:00:00`);
    return d.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return dateIso;
  }
}

function formatDayShort(dateIso: string): { weekday: string; day: string } {
  try {
    const d = new Date(`${dateIso}T12:00:00`);
    const weekday = d
      .toLocaleDateString('pt-BR', { weekday: 'short' })
      .replace('.', '')
      .slice(0, 3)
      .toUpperCase();
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

function statusBadge(fx: ScheduledLeagueFixture): { text: string; className: string } {
  if (fx.status === 'scheduled')
    return { text: 'Agendado', className: 'bg-white/10 text-gray-300' };
  if (fx.status === 'walkover')
    return {
      text: 'WO',
      className: 'bg-red-500/20 text-red-300 border border-red-500/30',
    };
  return {
    text: 'FT',
    className: 'bg-neon-green/15 text-neon-green border border-neon-green/30',
  };
}

function formatCountdown(
  targetMs: number,
  nowMs: number,
): { label: string; urgent: boolean; live: boolean } {
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

interface FixtureCardProps {
  fx: ScheduledLeagueFixture;
  mine: boolean;
}

function FixtureCard({ fx, mine }: FixtureCardProps) {
  const st = statusBadge(fx);
  const hasScore =
    fx.status !== 'scheduled' && fx.scoreHome !== undefined && fx.scoreAway !== undefined;
  return (
    <div
      className={cn(
        'relative px-4 py-3 transition-colors',
        mine
          ? 'bg-neon-yellow/[0.08] border-l-[3px] border-l-neon-yellow border border-neon-yellow/30'
          : 'bg-white/[0.03] border-l-[3px] border-l-white/10 border border-white/8 hover:bg-white/[0.06]',
      )}
      style={{ borderRadius: 'var(--radius-sm, 6px)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] tabular-nums text-white/45">
              {fx.kickoffHHmm}
            </span>
            {mine && (
              <span className="bg-neon-yellow text-black px-1.5 py-0.5 font-display text-[8px] font-black uppercase tracking-[0.18em]">
                Teu jogo
              </span>
            )}
          </div>
          <p
            className={cn(
              'font-display text-sm leading-tight truncate',
              mine ? 'font-black text-white' : 'font-bold text-white/85',
            )}
          >
            {fx.homeName} <span className="text-white/40">×</span> {fx.awayName}
          </p>
          {hasScore && (
            <p className="mt-1 font-display italic font-black tabular-nums text-white text-base">
              {fx.scoreHome}–{fx.scoreAway}
            </p>
          )}
        </div>
        <span
          className={cn(
            'shrink-0 rounded px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase',
            st.className,
          )}
        >
          {st.text}
        </span>
      </div>
      {mine && fx.status === 'scheduled' && (
        <Link
          to="/match/quick"
          className="mt-3 inline-flex items-center gap-1.5 bg-neon-yellow text-black px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-[0.2em] -skew-x-6 hover:bg-white transition-colors"
        >
          <Play className="h-3 w-3 -skew-x-[-6deg]" /> Jogar
        </Link>
      )}
    </div>
  );
}

export function Calendar() {
  const adminLeagues = useGameStore((s) => s.adminLeagues);
  const adminPrimaryLeagueId = useGameStore((s) => s.adminPrimaryLeagueId);
  const leagueSchedule = useGameStore((s) => s.leagueSchedule);
  const club = useGameStore((s) => s.club);
  const lineup = useGameStore((s) => s.lineup);
  const players = useGameStore((s) => s.players);

  const league = adminLeagues.find((l) => l.id === adminPrimaryLeagueId);
  const bucket = league ? leagueSchedule.byLeagueId[league.id] : undefined;
  const userTeamId = league ? userTeamIdForLeague(league, club) : undefined;
  const squad = evaluateOfficialSquad(lineup, players);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const todayIso = useMemo(() => localDateIso(new Date()), []);
  const [dayIso, setDayIso] = useState(() => todayIso);

  const fixturesOnDay = useMemo(() => {
    if (!bucket?.fixtures.length) return [];
    return [...bucket.fixtures]
      .filter((f) => f.dateIso === dayIso)
      .sort((a, b) => fixtureKickoffMs(a) - fixtureKickoffMs(b));
  }, [bucket?.fixtures, dayIso]);

  const myFixturesOnDay = useMemo(
    () => fixturesOnDay.filter((f) => fixtureInvolvesUser(f, userTeamId)),
    [fixturesOnDay, userTeamId],
  );
  const otherFixturesOnDay = useMemo(
    () => fixturesOnDay.filter((f) => !fixtureInvolvesUser(f, userTeamId)),
    [fixturesOnDay, userTeamId],
  );

  const nextUser = useMemo(() => {
    if (!bucket?.fixtures?.length) return undefined;
    return [...bucket.fixtures]
      .filter((f) => f.status === 'scheduled' && fixtureInvolvesUser(f, userTeamId))
      .sort((a, b) => fixtureKickoffMs(a) - fixtureKickoffMs(b))
      .find((f) => fixtureKickoffMs(f) > nowMs - 15 * 60_000);
  }, [bucket?.fixtures, userTeamId, nowMs]);

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

  const [showOthers, setShowOthers] = useState(false);

  const nextUserKickoffMs = nextUser ? fixtureKickoffMs(nextUser) : null;
  const countdown = nextUserKickoffMs ? formatCountdown(nextUserKickoffMs, nowMs) : null;
  const canPlayNow =
    nextUser &&
    countdown &&
    (countdown.live || (nextUserKickoffMs! - nowMs) <= 2 * 60 * 60_000);

  const myOpponent = useMemo(() => {
    if (!nextUser || !userTeamId) return null;
    const isHome = nextUser.homeTeamId === userTeamId;
    return isHome
      ? { isHome: true, opponent: nextUser.awayName }
      : { isHome: false, opponent: nextUser.homeName };
  }, [nextUser, userTeamId]);

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-4 pb-28 md:pb-12">
      <BackButton to="/competicao" label="Competição" />

      {/* ── HERO ─────────────────────────────────────────────────── */}
      {!squad.ok ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden border-2 border-red-500/50 bg-red-950/40 shadow-xl shadow-red-950/40"
          style={{ borderRadius: 'var(--radius-sm, 6px)' }}
        >
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2 text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="font-display text-[10px] font-black uppercase tracking-[0.25em]">
                Risco de WO
              </span>
            </div>
            <h1 className="ole-headline-italic mt-2 text-white" style={{ fontSize: 'clamp(28px, 7vw, 40px)' }}>
              Ajusta o plantel
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-red-100/85">
              Precisa de <strong className="text-white">11 titulares</strong> e{' '}
              <strong className="text-white">5 no banco</strong>, todos sem lesão ou suspensão.
            </p>
            {nextUser && countdown && (
              <p className="mt-2 text-[11px] text-red-100/80">
                Próximo: <strong className="text-white">{nextUser.homeName} × {nextUser.awayName}</strong>
                {' · '}
                <span className="font-bold text-red-200">{countdown.label}</span>
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/clube/elenco"
                className="inline-flex items-center bg-neon-yellow text-black px-4 py-2 font-display text-[11px] font-black uppercase tracking-[0.2em] -skew-x-6 hover:bg-white transition-colors"
              >
                Ajustar escalação
              </Link>
              <Link
                to="/mercado/transfer"
                className="inline-flex items-center border border-white/30 px-4 py-2 font-display text-[11px] font-bold uppercase tracking-[0.2em] text-white/85 hover:bg-white/10 transition-colors"
              >
                Mercado
              </Link>
            </div>
          </div>
        </motion.section>
      ) : nextUser && myOpponent && countdown ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden border border-neon-yellow/30"
          style={{ borderRadius: 'var(--radius-sm, 6px)' }}
        >
          <GameBannerBackdrop slot="leagues_header" imageOpacity={0.35} />
          <div className="absolute inset-0 bg-gradient-to-br from-black/75 via-black/55 to-black/85" aria-hidden />
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2 text-neon-yellow">
              <Clock className={cn('h-4 w-4 shrink-0', countdown.live && 'animate-pulse')} />
              <span className="font-display text-[10px] font-black uppercase tracking-[0.25em]">
                Próximo · {countdown.label}
              </span>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                  {myOpponent.isHome ? 'Em casa contra' : 'Fora, contra'}
                </p>
                <h1
                  className="ole-headline-italic mt-1 truncate text-white"
                  style={{ fontSize: 'clamp(28px, 7vw, 44px)', lineHeight: 1 }}
                >
                  {myOpponent.opponent}
                </h1>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-[10px] uppercase tracking-wider text-white/55">
                  {formatDayLabel(nextUser.dateIso)}
                </p>
                <p
                  className="font-display italic font-black tabular-nums text-neon-yellow"
                  style={{ fontSize: 'clamp(28px, 7vw, 40px)' }}
                >
                  {nextUser.kickoffHHmm}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {canPlayNow ? (
                <Link
                  to="/match/quick"
                  className="inline-flex items-center bg-neon-yellow text-black px-5 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.22em] -skew-x-6 hover:bg-white transition-colors shadow-[0_4px_14px_rgba(253,225,0,0.18)]"
                >
                  Jogar agora
                </Link>
              ) : (
                <Link
                  to="/clube/elenco"
                  className="inline-flex items-center bg-neon-yellow text-black px-5 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.22em] -skew-x-6 hover:bg-white transition-colors"
                >
                  Preparar escalação
                </Link>
              )}
              <Link
                to="/clube/treino"
                className="inline-flex items-center border border-white/20 bg-deep-black px-5 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.22em] text-white/85 hover:border-neon-yellow hover:text-neon-yellow transition-colors"
              >
                Treino
              </Link>
            </div>
          </div>
        </motion.section>
      ) : (
        <section
          className="relative overflow-hidden border border-white/10"
          style={{ borderRadius: 'var(--radius-sm, 6px)' }}
        >
          <GameBannerBackdrop slot="leagues_header" imageOpacity={0.22} />
          <div className="absolute inset-0 bg-black/55" aria-hidden />
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2 text-neon-yellow/80">
              <CalendarDays className="h-4 w-4" />
              <span className="font-display text-[10px] font-black uppercase tracking-[0.25em]">
                Calendário
              </span>
            </div>
            <h1 className="ole-headline-italic mt-2 text-white" style={{ fontSize: 'clamp(28px, 7vw, 44px)' }}>
              Sem jogos agendados
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Cria uma liga em <strong className="text-white">pontos corridos</strong> para gerar o calendário.
            </p>
          </div>
        </section>
      )}

      {/* ── Week strip ──────────────────────────────────────────── */}
      {bucket?.fixtures.length ? (
        <div
          className="border border-white/10 bg-white/[0.03] p-3"
          style={{ borderRadius: 'var(--radius-sm, 6px)' }}
        >
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
                    'flex shrink-0 min-w-[54px] flex-col items-center gap-0.5 rounded-md border px-2 py-2 transition-colors',
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
                      isSelected ? 'text-black bg-neon-yellow px-1 rounded' : 'text-white/45',
                      !isSelected && isToday && 'text-neon-yellow',
                    )}
                  >
                    {isToday ? 'HOJE' : short.weekday}
                  </span>
                  <span
                    className={cn(
                      'font-display text-base font-black',
                      isSelected ? 'text-neon-yellow' : 'text-white',
                    )}
                  >
                    {short.day}
                  </span>
                  <span className="flex gap-0.5 h-1.5">
                    {hasUserMatch ? (
                      Array.from({ length: d.userMatchCount }).map((_, i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full bg-neon-yellow" />
                      ))
                    ) : d.anyMatchCount > 0 ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ── Day fixtures ────────────────────────────────────────── */}
      <div
        className="border border-white/12 bg-white/[0.03] p-4"
        style={{ borderRadius: 'var(--radius-sm, 6px)' }}
      >
        {/* Day navigator */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setDayIso((d) => addDaysIso(d, -1))}
              className="rounded-md border border-white/10 p-1.5 text-white/55 hover:bg-white/10 hover:text-white"
              aria-label="Dia anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-white truncate">
              {formatDayLabel(dayIso)}
            </span>
            <button
              type="button"
              onClick={() => setDayIso((d) => addDaysIso(d, 1))}
              className="rounded-md border border-white/10 p-1.5 text-white/55 hover:bg-white/10 hover:text-white"
              aria-label="Dia seguinte"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {dayIso !== todayIso ? (
            <button
              type="button"
              onClick={() => setDayIso(todayIso)}
              className="rounded-md border border-neon-yellow/40 px-2 py-1 font-display text-[10px] font-bold uppercase text-neon-yellow hover:bg-neon-yellow/10"
            >
              Hoje
            </button>
          ) : null}
        </div>

        {/* Fixtures list — só jogos da liga */}
        {fixturesOnDay.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.25em] text-white/35">
              Sem jogos da liga neste dia
            </p>
          </div>
        ) : (
          <>
            {/* Meus jogos primeiro */}
            {myFixturesOnDay.length > 0 && (
              <ul className="space-y-2">
                {myFixturesOnDay.map((fx) => (
                  <li key={fx.id}>
                    <FixtureCard fx={fx} mine />
                  </li>
                ))}
              </ul>
            )}

            {/* Outros jogos da liga, colapsáveis */}
            {otherFixturesOnDay.length > 0 && (
              <>
                {myFixturesOnDay.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowOthers((v) => !v)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] py-2 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/55 hover:bg-white/5 hover:text-white"
                  >
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform',
                        showOthers && 'rotate-180',
                      )}
                    />
                    {showOthers
                      ? 'Ocultar liga'
                      : `Ver ${otherFixturesOnDay.length} ${otherFixturesOnDay.length === 1 ? 'jogo' : 'jogos'} da liga`}
                  </button>
                )}
                {(showOthers || myFixturesOnDay.length === 0) && (
                  <ul className={cn('space-y-2', myFixturesOnDay.length > 0 && 'mt-2')}>
                    {otherFixturesOnDay.map((fx) => (
                      <li key={fx.id}>
                        <FixtureCard fx={fx} mine={false} />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Footer liga ────────────────────────────────────────── */}
      {league ? (
        <Link
          to="/leagues"
          className="flex items-center gap-2 border border-white/10 bg-white/[0.02] px-4 py-3 hover:bg-white/[0.05] transition-colors"
          style={{ borderRadius: 'var(--radius-sm, 6px)' }}
        >
          <Trophy className="h-4 w-4 shrink-0 text-neon-yellow/80" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xs font-bold text-white truncate">{league.name}</p>
            <p className="text-[10px] text-white/45">
              {league.format === 'round_robin' ? 'Pontos corridos' : league.format} ·{' '}
              {league.division} · Ver classificação →
            </p>
          </div>
        </Link>
      ) : null}
    </div>
  );
}
