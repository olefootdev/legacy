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
import { Hashtag } from '@/components/ui';
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
    return { text: 'Agendado', className: 'border border-white/16 text-cimento' };
  if (fx.status === 'walkover')
    return {
      text: 'WO',
      className: 'border border-baixa/50 text-baixa',
    };
  return {
    text: 'FT',
    className: 'border border-alta/50 text-alta',
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
          ? 'bg-card border-l-[3px] border-l-neon-yellow border border-neon-yellow/40'
          : 'bg-panel border-l-[3px] border-l-white/10 border border-white/10 hover:bg-card',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10.5px] tabular-nums text-cimento">
              {fx.kickoffHHmm}
            </span>
            {mine && (
              <span className="bg-neon-yellow text-black px-[5px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em]">
                Seu jogo
              </span>
            )}
          </div>
          <p
            className={cn(
              'text-[14px] leading-tight truncate',
              mine ? 'font-bold text-white' : 'text-giz',
            )}
          >
            {fx.homeName} <span className="text-poeira">×</span> {fx.awayName}
          </p>
          {hasScore && (
            <p className="ole-num mt-1 text-white text-base">
              {fx.scoreHome}–{fx.scoreAway}
            </p>
          )}
        </div>
        <span
          className={cn(
            'shrink-0 px-[5px] py-0.5 font-mono text-[9.5px] tracking-[0.12em] uppercase',
            st.className,
          )}
        >
          {st.text}
        </span>
      </div>
      {mine && fx.status === 'scheduled' && (
        <Link
          to="/match/quick"
          className="mt-3 ole-num inline-flex h-11 items-center gap-1.5 whitespace-nowrap bg-neon-yellow px-4 text-[12px] uppercase text-black transition-colors hover:bg-white [--corte:10px] [clip-path:var(--clip-corte)]"
        >
          <Play className="h-3.5 w-3.5" /> Jogar
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
          className="relative overflow-hidden border border-baixa/60 bg-panel"
        >
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2 text-baixa">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em]">
                Risco de WO
              </span>
            </div>
            <h1 className="mt-2 font-impact uppercase leading-[1.1] text-white" style={{ fontSize: 'clamp(28px, 7vw, 40px)' }}>
              Ajuste o elenco
            </h1>
            <p className="mt-2 text-sm leading-snug text-giz">
              <strong className="text-white">11 titulares</strong> e{' '}
              <strong className="text-white">5 no banco</strong>, sem lesão ou suspensão.
            </p>
            {nextUser && countdown && (
              <p className="mt-2 truncate text-[12px] text-cimento">
                Próximo: <strong className="text-white">{nextUser.homeName} × {nextUser.awayName}</strong>
                {' · '}
                <span className="font-bold text-baixa">{countdown.label}</span>
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/clube/elenco"
                className="ole-num inline-flex h-11 items-center gap-1.5 whitespace-nowrap bg-neon-yellow px-4 text-[12px] uppercase text-black transition-colors hover:bg-white [--corte:10px] [clip-path:var(--clip-corte)]"
              >
                Ajustar escalação
              </Link>
              <Link
                to="/mercado/transfer"
                className="ole-num inline-flex h-11 items-center whitespace-nowrap border border-white/30 px-4 text-[12px] uppercase text-white transition-colors hover:border-white hover:bg-white/5"
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
          className="relative overflow-hidden border border-neon-yellow/40"
        >
          <GameBannerBackdrop slot="leagues_header" imageOpacity={0.35} />
          <div className="absolute inset-0 bg-black/70" aria-hidden />
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2 text-neon-yellow">
              <Clock className={cn('h-4 w-4 shrink-0', countdown.live && 'animate-pulse')} />
              <span className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.16em]">
                Próximo · {countdown.label}
              </span>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Hashtag>{myOpponent.isHome ? '#emcasa' : '#fora'}</Hashtag>
                <h1
                  className="mt-1 truncate font-impact uppercase text-white"
                  style={{ fontSize: 'clamp(28px, 7vw, 44px)', lineHeight: 1.1 }}
                >
                  {myOpponent.opponent}
                </h1>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-cimento">
                  {formatDayLabel(nextUser.dateIso)}
                </p>
                <p
                  className="ole-num text-neon-yellow"
                  style={{ fontSize: 'clamp(26px, 6.5vw, 38px)' }}
                >
                  {nextUser.kickoffHHmm}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {canPlayNow ? (
                <Link
                  to="/match/quick"
                  className="ole-num inline-flex h-11 items-center gap-1.5 whitespace-nowrap bg-neon-yellow px-4 text-[12px] uppercase text-black transition-colors hover:bg-white [--corte:10px] [clip-path:var(--clip-corte)]"
                >
                  Jogar agora
                </Link>
              ) : (
                <Link
                  to="/clube/elenco"
                  className="ole-num inline-flex h-11 items-center gap-1.5 whitespace-nowrap bg-neon-yellow px-4 text-[12px] uppercase text-black transition-colors hover:bg-white [--corte:10px] [clip-path:var(--clip-corte)]"
                >
                  Preparar escalação
                </Link>
              )}
              <Link
                to="/clube/treino"
                className="ole-num inline-flex h-11 items-center whitespace-nowrap border border-white/30 px-4 text-[12px] uppercase text-white transition-colors hover:border-white hover:bg-white/5"
              >
                Treino
              </Link>
            </div>
          </div>
        </motion.section>
      ) : (
        <section
          className="relative overflow-hidden border border-white/10"
        >
          <GameBannerBackdrop slot="leagues_header" imageOpacity={0.22} />
          <div className="absolute inset-0 bg-black/55" aria-hidden />
          <div className="relative z-10 p-5">
            <div className="flex items-center gap-2 text-neon-yellow">
              <CalendarDays className="h-4 w-4" />
              <Hashtag className="text-neon-yellow">#calendário</Hashtag>
            </div>
            <h1 className="mt-2 font-impact uppercase leading-[1.1] text-white" style={{ fontSize: 'clamp(28px, 7vw, 44px)' }}>
              Sem jogos agendados
            </h1>
          </div>
        </section>
      )}

      {/* ── Week strip ──────────────────────────────────────────── */}
      {bucket?.fixtures.length ? (
        <div className="border border-white/10 bg-panel p-3">
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
                    'flex shrink-0 min-w-[54px] flex-col items-center gap-0.5 border px-2 py-2 transition-colors',
                    isSelected
                      ? 'border-neon-yellow bg-neon-yellow'
                      : hasUserMatch
                      ? 'border-neon-yellow/40 bg-deep-black hover:border-neon-yellow'
                      : 'border-white/10 bg-deep-black hover:border-white/30',
                  )}
                >
                  <span
                    className={cn(
                      'font-mono text-[9.5px] uppercase tracking-[0.12em]',
                      isSelected ? 'text-black' : 'text-cimento',
                      !isSelected && isToday && 'text-neon-yellow',
                    )}
                  >
                    {isToday ? 'HOJE' : short.weekday}
                  </span>
                  <span
                    className={cn(
                      'ole-num text-base',
                      isSelected ? 'text-black' : 'text-white',
                    )}
                  >
                    {short.day}
                  </span>
                  <span className="flex gap-0.5 h-1.5">
                    {hasUserMatch ? (
                      Array.from({ length: d.userMatchCount }).map((_, i) => (
                        <span key={i} className={cn('h-1.5 w-1.5 rounded-full', isSelected ? 'bg-black' : 'bg-neon-yellow')} />
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
      <div className="border border-white/10 bg-panel p-4">
        {/* Day navigator */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setDayIso((d) => addDaysIso(d, -1))}
              className="border border-white/16 p-1.5 text-cimento hover:border-white/30 hover:text-white"
              aria-label="Dia anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-white truncate">
              {formatDayLabel(dayIso)}
            </span>
            <button
              type="button"
              onClick={() => setDayIso((d) => addDaysIso(d, 1))}
              className="border border-white/16 p-1.5 text-cimento hover:border-white/30 hover:text-white"
              aria-label="Dia seguinte"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {dayIso !== todayIso ? (
            <button
              type="button"
              onClick={() => setDayIso(todayIso)}
              className="border border-neon-yellow/50 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-neon-yellow hover:border-neon-yellow"
            >
              Hoje
            </button>
          ) : null}
        </div>

        {/* Fixtures list — só jogos da liga */}
        {fixturesOnDay.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-poeira">
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
                    className="mt-3 flex w-full items-center justify-center gap-1.5 border border-white/16 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-cimento hover:border-white/30 hover:text-white"
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
          className="flex items-center gap-2 border border-white/10 bg-panel px-4 py-3 hover:border-white/30 transition-colors"
        >
          <Trophy className="h-4 w-4 shrink-0 text-neon-yellow" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-white truncate">{league.name}</p>
            <p className="truncate font-mono text-[10.5px] text-cimento">
              {league.format === 'round_robin' ? 'Pontos corridos' : league.format} ·{' '}
              {league.division} · Ver classificação →
            </p>
          </div>
        </Link>
      ) : null}
    </div>
  );
}
