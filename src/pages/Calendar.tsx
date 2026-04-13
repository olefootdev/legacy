import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  CalendarDays,
  Clock,
  AlertTriangle,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { GameBannerBackdrop } from '@/components/GameBannerBackdrop';
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

  const grouped = useMemo(() => {
    if (!bucket?.fixtures.length) return [];
    const map = new Map<string, ScheduledLeagueFixture[]>();
    const sorted = [...bucket.fixtures].sort((a, b) => fixtureKickoffMs(a) - fixtureKickoffMs(b));
    for (const f of sorted) {
      const arr = map.get(f.dateIso) ?? [];
      arr.push(f);
      map.set(f.dateIso, arr);
    }
    return Array.from(map.entries());
  }, [bucket?.fixtures]);

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

  const now = Date.now();
  const nextUser = bucket?.fixtures
    ?.filter((f) => f.status === 'scheduled' && fixtureInvolvesUser(f, userTeamId))
    ?.sort((a, b) => fixtureKickoffMs(a) - fixtureKickoffMs(b))
    ?.find((f) => fixtureKickoffMs(f) > now);

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-8 pb-28 md:pb-12">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 px-4 py-5 md:px-6">
        <GameBannerBackdrop slot="leagues_header" imageOpacity={0.28} />
        <div className="relative z-10 space-y-2">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-neon-yellow/90">
            Competição
          </p>
          <h1 className="font-display text-2xl font-black tracking-tight text-white md:text-3xl">
            Calendário oficial
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-gray-400">
            Jogos oficiais a cada <strong className="text-white">2 h</strong> (09–21) e blocos de treino às horas pares
            (10–22). Usa a grelha <strong className="text-white">O teu dia</strong> em baixo para navegar datas, ver
            jogos e adicionar treinos.
          </p>
        </div>
      </div>

      {!squad.ok && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-3 rounded-xl border-2 border-red-500/50 bg-red-500/15 p-4 shadow-lg shadow-red-950/40 ring-1 ring-red-400/30"
        >
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-300" aria-hidden />
          <div>
            <p className="font-display text-sm font-black uppercase tracking-wide text-red-100">Risco de WO (walkover)</p>
            <p className="mt-1 text-sm font-semibold text-red-100/95">{squad.reason}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-red-100/75">
              São obrigatórios <strong className="text-white">11 titulares</strong> disponíveis (sem lesão/suspensão) e{' '}
              <strong className="text-white">pelo menos 5 jogadores no banco</strong> — reforça o plantel no mercado.
            </p>
            <Link to="/team" className="mt-3 inline-block text-xs font-black text-neon-yellow hover:underline">
              Ajustar escalação →
            </Link>
          </div>
        </motion.div>
      )}

      <div className="rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-4 md:px-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-neon-yellow" aria-hidden />
            <div className="min-w-0">
              <p className="font-display text-xs font-black uppercase tracking-wider text-white">O teu dia</p>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                Mesmos horários sempre (09–22). Escolhe o dia; nos treinos vazios usa{' '}
                <span className="font-bold text-neon-green/90">+ Adicionar Treino</span>.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1 rounded-xl border border-white/10 bg-black/20 p-1.5">
            <span className="px-1 font-display text-[10px] font-bold uppercase tracking-wider text-gray-500">Dia</span>
            <button
              type="button"
              onClick={() => setDayIso((d) => addDaysIso(d, -1))}
              className="rounded-lg border border-white/10 p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
              aria-label="Dia anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-0 max-w-[11rem] truncate px-1 text-center font-display text-[10px] font-bold text-white sm:max-w-none sm:text-[11px]">
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
            {dayIso !== todayIso ? (
              <button
                type="button"
                onClick={() => setDayIso(todayIso)}
                className="ml-0.5 rounded-lg border border-neon-yellow/40 px-2 py-1 font-display text-[10px] font-bold uppercase text-neon-yellow hover:bg-neon-yellow/10"
              >
                Hoje
              </button>
            ) : null}
          </div>
        </div>

        {plansOnDay.length > 0 ? (
          <div className="mb-3 rounded-lg border border-neon-green/25 bg-neon-green/[0.06] p-3">
            <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-wider text-neon-green/90">
              Treinos a decorrer neste dia
            </p>
            <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {plansOnDay.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/team/treino"
                    className="flex flex-col rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[11px] transition hover:border-neon-yellow/40 hover:bg-white/[0.04]"
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

        <ul className="max-h-[min(52vh,520px)] space-y-1 overflow-y-auto overscroll-y-contain pr-1">
          {FULL_CALENDAR_DAY_SLOT_TIMES.map((t) => {
            const fx = fixtureAtKickoff.get(t);
            const isMatch = slotTimeSet.has(t);
            const isTrain = trainingSlotTimeSet.has(t);

            if (isMatch) {
              if (fx) {
                const mine = fixtureInvolvesUser(fx, userTeamId);
                const st = statusBadge(fx);
                return (
                  <li key={t}>
                    <div
                      className={`flex flex-col gap-1 rounded-lg border px-3 py-2 ${
                        mine ? 'border-neon-yellow/35 bg-neon-yellow/[0.06]' : 'border-white/10 bg-black/25'
                      } border-l-[3px] border-l-neon-yellow/35`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-[10px] text-gray-500">{t}</span>
                          <p className="font-display text-sm font-bold text-white">
                            {fx.homeName} <span className="text-gray-500">×</span> {fx.awayName}
                          </p>
                          {mine ? (
                            <span className="mt-0.5 inline-block text-[9px] font-bold uppercase text-neon-yellow">
                              O teu clube
                            </span>
                          ) : null}
                        </div>
                        <span className={`shrink-0 rounded px-2 py-0.5 text-[9px] font-bold ${st.className}`}>
                          {st.text}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-[10px] font-bold">
                        {mine && fx.status === 'scheduled' ? (
                          <Link to="/match/live" className="text-neon-yellow hover:underline">
                            Entrar no jogo →
                          </Link>
                        ) : null}
                        <Link to="/team/treino" className="text-gray-400 hover:text-neon-yellow hover:underline">
                          Treino →
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              }
              return (
                <li key={t}>
                  <div className="flex flex-col gap-0.5 rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-2.5 py-1.5 sm:px-3 sm:py-2 border-l-[3px] border-l-neon-yellow/30">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-[10px] text-white/90 sm:text-[11px]">{t}</span>
                      <span className="text-[8px] font-bold uppercase tracking-wider text-neon-yellow/55">
                        Jogo oficial
                      </span>
                    </div>
                    <span className="text-[10px] leading-snug text-gray-500 sm:text-[11px]">
                      {trainingWindowLabelForCalendarSlot(t)}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-bold">
                      <Link to="/team/treino" className="text-neon-yellow/90 hover:underline">
                        Sugerir Treino →
                      </Link>
                      <Link to="/leagues" className="text-neon-green/90 hover:underline">
                        Buscar jogo →
                      </Link>
                    </div>
                  </div>
                </li>
              );
            }

            if (isTrain) {
              return (
                <li key={t}>
                  <div className="flex flex-col gap-1 rounded-lg border border-dashed border-neon-green/35 bg-neon-green/[0.06] px-2.5 py-1.5 sm:px-3 sm:py-2 border-l-[3px] border-l-neon-green/45">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-[10px] text-gray-500">{t}</span>
                      <span className="rounded bg-neon-green/20 px-1.5 py-0.5 text-[8px] font-bold uppercase text-neon-green/90">
                        Treino oficial
                      </span>
                    </div>
                    <p className="text-[10px] leading-snug text-gray-500">{trainingWindowLabelForCalendarSlot(t)}</p>
                    <Link
                      to="/team/treino"
                      className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-lg border border-neon-green/45 bg-neon-green/10 px-2.5 py-1.5 font-display text-[10px] font-bold text-neon-green transition hover:bg-neon-green/18"
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Adicionar Treino
                    </Link>
                  </div>
                </li>
              );
            }

            return null;
          })}
        </ul>
      </div>

      {league ? (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <Trophy className="h-5 w-5 shrink-0 text-neon-yellow" />
          <div>
            <p className="font-display text-sm font-bold text-white">{league.name}</p>
            <p className="text-[11px] text-gray-500">
              {league.format === 'round_robin' ? 'Pontos corridos' : league.format} · {league.division}
            </p>
          </div>
        </div>
      ) : null}

      {nextUser && (
        <div className="rounded-xl border border-neon-yellow/35 bg-neon-yellow/5 p-4">
          <div className="mb-1 flex items-center gap-2 text-neon-yellow">
            <Clock className="h-4 w-4" />
            <span className="font-display text-xs font-bold uppercase tracking-wider">Próximo jogo teu</span>
          </div>
          <p className="font-display text-lg font-bold text-white">
            {nextUser.homeName} × {nextUser.awayName}
          </p>
          <p className="text-sm text-gray-400">
            {formatDayLabel(nextUser.dateIso)} · {nextUser.kickoffHHmm}
          </p>
          <Link to="/match/live" className="mt-3 inline-flex text-xs font-bold text-neon-yellow hover:underline">
            Entrar no estádio →
          </Link>
        </div>
      )}

      {!bucket?.fixtures.length ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-gray-500">
          Sem calendário gerado. Cria ou edita uma liga em <strong className="text-white">pontos corridos</strong> no
          Admin para gerar jogos.
        </p>
      ) : null}

      {orphanFixturesOnDay.length > 0 ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-4">
          <p className="mb-1 font-display text-[10px] font-bold uppercase tracking-wider text-amber-400/90">
            Fora da grelha (este dia)
          </p>
          <p className="mb-2 text-[10px] text-gray-500">Horários antigos ou excecionais.</p>
          <ul className="space-y-2">
            {orphanFixturesOnDay.map((fx) => {
              const mine = fixtureInvolvesUser(fx, userTeamId);
              const st = statusBadge(fx);
              return (
                <li
                  key={fx.id}
                  className={`rounded-lg border p-3 ${
                    mine ? 'border-neon-yellow/30 bg-neon-yellow/[0.06]' : 'border-white/10 bg-black/30'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] text-gray-500">{fx.kickoffHHmm}</span>
                    <span className={`rounded px-2 py-0.5 text-[9px] font-bold ${st.className}`}>{st.text}</span>
                  </div>
                  <p className="font-display text-sm font-bold text-white">
                    {fx.homeName} <span className="text-gray-500">×</span> {fx.awayName}
                  </p>
                  {mine && fx.status === 'scheduled' ? (
                    <Link to="/match/live" className="mt-2 block text-[10px] font-bold text-neon-yellow hover:underline">
                      Entrar no jogo →
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {bucket?.fixtures.length ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-gray-500" aria-hidden />
            <h3 className="font-display text-[10px] font-bold uppercase tracking-wider text-gray-400">Na competição</h3>
          </div>
          <div className="max-h-[min(40vh,320px)] space-y-5 overflow-y-auto pr-1">
            {grouped.map(([dateIso, list]) => (
              <div key={dateIso}>
                <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-widest text-neon-yellow/80">
                  {formatDayLabel(dateIso)}
                </p>
                <ul className="space-y-2">
                  {list.map((fx) => {
                    const mine = fixtureInvolvesUser(fx, userTeamId);
                    const st = statusBadge(fx);
                    return (
                      <li
                        key={fx.id}
                        className={`rounded-lg border p-2.5 ${
                          mine ? 'border-neon-yellow/25 bg-neon-yellow/[0.05]' : 'border-white/10 bg-black/25'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-mono text-[9px] text-gray-500">{fx.kickoffHHmm}</span>
                            <p className="font-display text-xs font-bold leading-snug text-white">
                              {fx.homeName} <span className="text-gray-500">×</span> {fx.awayName}
                            </p>
                            {mine ? (
                              <span className="mt-0.5 inline-block text-[8px] font-bold uppercase text-neon-yellow">
                                Teu clube
                              </span>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-0.5">
                            <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${st.className}`}>{st.text}</span>
                            {fx.status !== 'scheduled' &&
                            fx.scoreHome !== undefined &&
                            fx.scoreAway !== undefined ? (
                              <span className="font-display text-xs font-black text-white">
                                {fx.scoreHome}–{fx.scoreAway}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {fx.walkoverNote ? (
                          <p className="mt-1.5 text-[9px] text-red-300/90">{fx.walkoverNote}</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
