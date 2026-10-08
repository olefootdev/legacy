import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { BackButton } from '@/components/BackButton';
import { cn } from '@/lib/utils';
import { BotaoRua, SecaoRua, SeloRua } from '@/components/ui/Rua';
import { CabecalhoRua, VazioRua } from '@/components/leagues/RuaTabela';
import { Convocacao, PlacarRua } from '@/components/leagues/Convocacao';
import {
  fixtureKickoffMs,
  fixtureInvolvesUser,
  userTeamIdForLeague,
  type ScheduledLeagueFixture,
} from '@/match/leagueSchedule';
import { evaluateOfficialSquad } from '@/match/squadEligibility';
import { L, LOCALE, emIngles } from '@/i18n/L';

function formatDayLabel(dateIso: string): string {
  try {
    const d = new Date(`${dateIso}T12:00:00`);
    return d.toLocaleDateString(LOCALE, {
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
      .toLocaleDateString(LOCALE, { weekday: 'short' })
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

function statusBadge(fx: ScheduledLeagueFixture): { text: string; tom: 'mudo' | 'cal' | 'corre-contorno' } {
  if (fx.status === 'scheduled') return { text: L('Agendado', 'Scheduled'), tom: 'mudo' };
  if (fx.status === 'walkover') return { text: 'WO', tom: 'corre-contorno' };
  return { text: L('Fim', 'FT'), tom: 'cal' };
}

function formatCountdown(
  targetMs: number,
  nowMs: number,
): { label: string; urgent: boolean; live: boolean } {
  const diff = targetMs - nowMs;
  if (Math.abs(diff) < 60_000) return { label: L('agora', 'now'), urgent: true, live: true };
  if (diff < 0) {
    const mins = Math.round(-diff / 60_000);
    if (mins < 60) return { label: L(`começou há ${mins}min`, `started ${mins}min ago`), urgent: true, live: true };
    const h = Math.round(mins / 60);
    return { label: L(`há ${h}h`, `${h}h ago`), urgent: false, live: false };
  }
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return { label: L(`em ${mins}min`, `in ${mins}min`), urgent: true, live: false };
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    const m = mins - hours * 60;
    return { label: m > 0 ? L(`em ${hours}h ${m}min`, `in ${hours}h ${m}min`) : L(`em ${hours}h`, `in ${hours}h`), urgent: hours <= 2, live: false };
  }
  const days = Math.floor(hours / 24);
  const h2 = hours - days * 24;
  return { label: h2 > 0 ? L(`em ${days}d ${h2}h`, `in ${days}d ${h2}h`) : L(`em ${days}d`, `in ${days}d`), urgent: false, live: false };
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
        'relative flex min-w-0 flex-col gap-2 bg-concreto px-4 py-3',
        mine && 'border-l-[5px] border-rua',
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-spray text-[22px] font-black leading-none tabular-nums text-papel">{fx.kickoffHHmm}</span>
          {mine && <SeloRua tom="corre" className="py-0.5 text-[10px]">{L('Teu jogo', 'Your match')}</SeloRua>}
        </div>
        <SeloRua tom={st.tom} className="py-0.5 text-[10px]">{st.text}</SeloRua>
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <p className={cn('min-w-0 grow truncate font-impact text-[19px] uppercase leading-none', mine ? 'text-papel' : 'text-suave')}>
          {fx.homeName} <span className="font-voz normal-case text-mudo">x</span> {fx.awayName}
        </p>
        {hasScore && <PlacarRua golsCasa={fx.scoreHome!} golsFora={fx.scoreAway!} tamanho="pequeno" className="shrink-0" />}
      </div>
      {mine && fx.status === 'scheduled' && (
        <BotaoRua to="/match/quick" className="mt-1 min-h-[44px] self-start px-4 text-[17px]">
          {L('Jogar', 'Play')} <span aria-hidden>→</span>
        </BotaoRua>
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

  const myName = nextUser && myOpponent ? (myOpponent.isHome ? nextUser.homeName : nextUser.awayName) : club.name;

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-8 overflow-x-hidden pb-28 md:pb-12 px-3 sm:px-4">
      <BackButton to="/competicao" label={L('Competição', 'Competition')} />

      {/* ── HERO ─────────────────────────────────────────────────── */}
      {!squad.ok ? (
        /* Aviso de WO = lambe de cal colado torto: é o que pede ação agora. */
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mx-1 flex -rotate-1 flex-col gap-3 bg-cal p-5 text-asfalto-27 shadow-[5px_5px_0_var(--color-rua)]"
        >
          <span className="flex items-center gap-2 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em]">
            <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" />
            {L('Risco de WO', 'Walkover risk')}
          </span>
          <h1 className="font-impact uppercase leading-[0.88]" style={{ fontSize: 'clamp(38px, 10vw, 60px)' }}>
            {L('Ajusta o elenco', 'Fix your squad')}
          </h1>
          <p className="font-voz text-[clamp(20px,5.4vw,26px)] leading-[1.05]">
            {emIngles() ? '11 starters and 5 on the bench, no injuries or suspensions.' : '11 titulares e 5 no banco, sem lesão nem suspensão.'}
          </p>
          {nextUser && countdown && (
            <p className="truncate font-prova text-[11.5px] font-bold uppercase tracking-[0.1em]">
              {L('Próximo', 'Next')}: {nextUser.homeName} x {nextUser.awayName} · {countdown.label}
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-3">
            <BotaoRua to="/clube/elenco" variante="asfalto">
              {L('Ajustar escalação', 'Edit lineup')} <span aria-hidden>→</span>
            </BotaoRua>
            <Link
              to="/mercado/transfer"
              className="inline-flex min-h-[52px] items-center border-2 border-asfalto-27 px-5 font-impact text-[19px] uppercase leading-none transition-colors hover:bg-asfalto-27 hover:text-cal"
            >
              {L('Mercado', 'Market')}
            </Link>
          </div>
        </motion.section>
      ) : nextUser && myOpponent && countdown ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Convocacao
            ariaLabel={L(`Próximo jogo: ${myName} contra ${myOpponent.opponent}`, `Next match: ${myName} vs ${myOpponent.opponent}`)}
            rotulo={`${myOpponent.isHome ? L('#emcasa', '#home') : L('#fora', '#away')}${league ? ` · ${league.name}` : ''}`}
            quando={
              countdown.live ? (
                <SeloRua tom="corre" className="bg-asfalto-27 text-rua">● {L('Ao vivo', 'Live')}</SeloRua>
              ) : (
                `${formatDayLabel(nextUser.dateIso)} · ${nextUser.kickoffHHmm}`
              )
            }
            casa={myName}
            fora={myOpponent.opponent}
            frase={canPlayNow ? L('A bola já tá na marca.', 'The ball is on the spot.') : L('Escala teu time antes do apito.', 'Set your team before kickoff.')}
            sub={`${L('Próximo', 'Next')} · ${countdown.label}`}
            acoes={
              <>
                {canPlayNow ? (
                  <BotaoRua to="/match/quick">
                    {L('Jogar agora', 'Play now')} <span aria-hidden>→</span>
                  </BotaoRua>
                ) : (
                  <BotaoRua to="/clube/elenco">
                    {L('Preparar escalação', 'Set lineup')} <span aria-hidden>→</span>
                  </BotaoRua>
                )}
                <BotaoRua to="/clube/treino" variante="contorno">
                  {L('Treino', 'Training')}
                </BotaoRua>
              </>
            }
          />
        </motion.div>
      ) : (
        <CabecalhoRua
          rotulo={L('#calendário', '#calendar')}
          titulo={L('Sem jogos agendados', 'No matches scheduled')}
          voz={L('Rodada parada? A bola rola igual.', 'No fixture? The ball still rolls.')}
        >
          <BotaoRua to="/match/quick" className="mt-2 self-start">
            {L('Partida rápida', 'Quick match')} <span aria-hidden>→</span>
          </BotaoRua>
        </CabecalhoRua>
      )}

      {/* ── Faixa da semana — canhotos de ingresso ─────────────────── */}
      {bucket?.fixtures.length ? (
        <div className="flex flex-col gap-3">
          <SecaoRua label={L('Semana', 'Week')} />
          <div className="hide-scrollbar flex gap-1.5 overflow-x-auto pb-1">
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
                  aria-pressed={isSelected}
                  className={cn(
                    'flex min-w-[56px] shrink-0 flex-col items-center gap-1 px-2 py-2.5 transition-colors',
                    isSelected
                      ? 'bg-rua text-asfalto-27'
                      : hasUserMatch
                        ? 'border-2 border-rua bg-concreto text-papel'
                        : 'bg-concreto text-papel hover:bg-linha',
                  )}
                >
                  <span
                    className={cn(
                      'font-prova text-[10px] font-bold uppercase tracking-[0.14em]',
                      isSelected ? 'text-asfalto-27' : isToday ? 'text-rua' : 'text-mudo',
                    )}
                  >
                    {isToday ? L('HOJE', 'TODAY') : short.weekday}
                  </span>
                  <span className="font-spray text-[28px] font-black leading-none">{short.day}</span>
                  <span className="flex h-1.5 gap-0.5">
                    {hasUserMatch ? (
                      Array.from({ length: d.userMatchCount }).map((_, i) => (
                        <span key={i} className={cn('h-1.5 w-1.5', isSelected ? 'bg-asfalto-27' : 'bg-rua')} />
                      ))
                    ) : d.anyMatchCount > 0 ? (
                      <span className="h-1.5 w-1.5 bg-fio" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ── Jogos do dia ───────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDayIso((d) => addDaysIso(d, -1))}
              className="grid h-10 w-10 shrink-0 place-items-center border-2 border-linha text-mudo hover:border-papel hover:text-papel"
              aria-label={L('Dia anterior', 'Previous day')}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-0 truncate font-impact text-[20px] uppercase leading-none text-papel">{formatDayLabel(dayIso)}</span>
            <button
              type="button"
              onClick={() => setDayIso((d) => addDaysIso(d, 1))}
              className="grid h-10 w-10 shrink-0 place-items-center border-2 border-linha text-mudo hover:border-papel hover:text-papel"
              aria-label={L('Dia seguinte', 'Next day')}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {dayIso !== todayIso ? (
            <button
              type="button"
              onClick={() => setDayIso(todayIso)}
              className="shrink-0 border-2 border-rua px-3 py-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.14em] text-rua hover:bg-rua hover:text-asfalto-27"
            >
              {L('Hoje', 'Today')}
            </button>
          ) : null}
        </div>

        {/* Lista — só jogos da liga */}
        {fixturesOnDay.length === 0 ? (
          <VazioRua titulo={L('Dia sem bola', 'No ball today')} frase={L('Sem jogos da liga neste dia.', 'No league matches this day.')} />
        ) : (
          <>
            {/* Meus jogos primeiro */}
            {myFixturesOnDay.length > 0 && (
              <ul className="space-y-1.5">
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
                    className="flex w-full items-center justify-center gap-1.5 border-2 border-dashed border-fio py-2.5 font-prova text-[11px] font-bold uppercase tracking-[0.14em] text-mudo hover:border-papel hover:text-papel"
                  >
                    <ChevronDown aria-hidden className={cn('h-3.5 w-3.5 transition-transform', showOthers && 'rotate-180')} />
                    {showOthers
                      ? L('Ocultar liga', 'Hide league')
                      : L(
                          `Ver ${otherFixturesOnDay.length} ${otherFixturesOnDay.length === 1 ? 'jogo' : 'jogos'} da liga`,
                          `View ${otherFixturesOnDay.length} league ${otherFixturesOnDay.length === 1 ? 'match' : 'matches'}`,
                        )}
                  </button>
                )}
                {(showOthers || myFixturesOnDay.length === 0) && (
                  <ul className="space-y-1.5">
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

      {/* ── Rodapé da liga ─────────────────────────────────────── */}
      {league ? (
        <Link to="/leagues" className="flex min-w-0 items-center gap-3 border-t-2 border-linha pt-5 transition-colors hover:text-rua">
          <div className="min-w-0 flex-1">
            <p className="truncate font-impact text-[22px] uppercase leading-none text-papel">{league.name}</p>
            <p className="mt-1 truncate font-prova text-[11px] uppercase tracking-[0.12em] text-mudo">
              {league.format === 'round_robin' ? L('Pontos corridos', 'Round robin') : league.format} · {league.division}
            </p>
          </div>
          <span className="shrink-0 font-impact text-[18px] uppercase text-rua">
            {L('Classificação', 'Table')} <span aria-hidden>→</span>
          </span>
        </Link>
      ) : null}
    </div>
  );
}
