/**
 * /liga-global/registro — registro de manager na OLEFOOT LIGA (MVP global).
 *
 * Sprint B-4 Legacy Tech: header padrão Ranking (eyebrow + headline duo + régua),
 * cards com trilho lateral colorido (sem ícones soltos), MORET serif para números,
 * lista de times cadastrados ordenada por overall.
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useGameStore, useGameDispatch } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import { BackButton } from '@/components/BackButton';
import { cn } from '@/lib/utils';
import { Hashtag } from '@/components/ui';
import { L } from '@/i18n/L';

export default function GlobalLeagueRegistration() {
  const dispatch = useGameDispatch();
  const navigate = useNavigate();

  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);
  const userSettings = useGameStore((s) => s.userSettings);

  /** Overall do XI (média dos 11 melhores). Usa `attrs` (campo correto do PlayerEntity). */
  const teamOverall = useMemo(() => {
    const ovrs = Object.values(players)
      .map((p) => overallFromAttributes(p.attrs, p.pos))
      .sort((a, b) => b - a)
      .slice(0, 11);
    if (!ovrs.length) return 0;
    return Math.round(ovrs.reduce((sum, o) => sum + o, 0) / ovrs.length);
  }, [players]);

  const squadSize = Object.keys(players).length;
  const managerId = userSettings.managerProfile?.email || 'guest';
  const isRegistered = Boolean(globalLeagueMVP?.teams.some((t) => t.managerId === managerId));
  const teamsCount = globalLeagueMVP?.teams.length ?? 0;
  const minTeams = globalLeagueMVP?.minTeamsRequired ?? 32;
  const status = globalLeagueMVP?.status ?? 'waiting_teams';
  const remaining = Math.max(0, minTeams - teamsCount);
  const progress = Math.min(100, (teamsCount / minTeams) * 100);

  const sortedTeams = useMemo(
    () => [...(globalLeagueMVP?.teams ?? [])].sort((a, b) => b.overall - a.overall),
    [globalLeagueMVP?.teams],
  );

  const handleRegister = () => {
    if (!globalLeagueMVP) {
      dispatch({ type: 'INIT_GLOBAL_LEAGUE_MVP' });
    }
    dispatch({
      type: 'REGISTER_GLOBAL_TEAM',
      managerId,
      clubName: club.name,
      clubShort: club.shortName,
      overall: teamOverall,
    });
  };

  const canRegister = !isRegistered && squadSize > 0 && status === 'waiting_teams';

  const statusBadge =
    status === 'waiting_teams'
      ? { label: L('Cadastros abertos', 'Registration open'), tone: 'text-neon-yellow border-neon-yellow/40' }
      : status === 'playoffs'
        ? { label: L('Playoffs em curso', 'Playoffs underway'), tone: 'text-giz border-white/30' }
        : status === 'active'
          ? { label: L('Liga em curso', 'League underway'), tone: 'text-alta border-alta/40' }
          : { label: L('Temporada encerrada', 'Season over'), tone: 'text-cimento border-white/16' };

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6 pb-10">
      <BackButton to="/competicao/ligas" label={L('Ligas', 'Leagues')} />

      {/* ── HEADER editorial padrão Ranking ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-white/10 bg-panel overflow-hidden"
      >
        <div className="bg-deep-black p-6 md:p-8 border-b border-white/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Hashtag className="mb-3 text-neon-yellow">{L('#ligaglobal · temporada 2026', '#globalleague · season 2026')}</Hashtag>
              <h1 className="leading-[1.1]">
                <span
                  className="block font-impact uppercase text-white"
                  style={{
                    fontSize: 'clamp(2rem, 5.5vw, 3.5rem)',
                    letterSpacing: '0.005em',
                  }}
                >
                  {L('LIGA GLOBAL', 'GLOBAL LEAGUE')}
                </span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={teamsCount}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.35 }}
                    className="ole-num block uppercase text-neon-yellow mt-1"
                    style={{ fontSize: 'clamp(1.2rem, 3.6vw, 2rem)' }}
                  >
                    {teamsCount}/{minTeams} {L('times', 'teams')}
                  </motion.span>
                </AnimatePresence>
              </h1>
            </div>
            <span
              className={cn(
                'inline-flex items-center border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em]',
                statusBadge.tone,
              )}
            >
              {statusBadge.label}
            </span>
          </div>

          {/* Progress bar (só durante cadastros) */}
          {status === 'waiting_teams' ? (
            <div className="mt-6 max-w-md">
              <div className="h-1.5 overflow-hidden bg-card-hi">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.6 }}
                  className="h-full bg-neon-yellow"
                />
              </div>
              <p className="mt-2 truncate text-[12.5px] text-cimento">
                {remaining > 0
                  ? L(`Faltam ${remaining} time${remaining === 1 ? '' : 's'} para iniciar os playoffs.`, `${remaining} more team${remaining === 1 ? '' : 's'} needed to start the playoffs.`)
                  : L('Quórum atingido — playoffs prestes a começar.', 'Quorum reached — playoffs about to start.')}
              </p>
            </div>
          ) : null}
        </div>
      </motion.div>

      {/* ── 3 cards de regras (trilho lateral, sem ícones) ── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <RuleCard
          rail="bg-neon-yellow"
          eyebrow={L('#fase1', '#phase1')}
          title="Playoffs"
          description={L('3 rodadas ida e volta — 6 jogos para definir as divisões.', '3 home-and-away rounds — 6 matches to set the divisions.')}
          delay={0.1}
        />
        <RuleCard
          rail="bg-neon-yellow"
          eyebrow={L('#estrutura', '#structure')}
          title={L('3 Divisões', '3 Divisions')}
          description={L('~11 times por divisão, pelo desempenho nos playoffs.', '~11 teams per division, based on playoff results.')}
          delay={0.2}
        />
        <RuleCard
          rail="bg-neon-yellow"
          eyebrow={L('#ciclo', '#cycle')}
          title={L('Promoção & Rebaixamento', 'Promotion & Relegation')}
          description={L('Top 10% sobem, últimos 10% descem a cada temporada.', 'Top 10% go up, bottom 10% go down each season.')}
          delay={0.3}
        />
      </section>

      {/* ── Card "Seu Time" ── */}
      {!isRegistered ? (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative isolate overflow-hidden border border-neon-yellow/40 bg-card"
        >
          <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-neon-yellow" />
          <div className="relative p-6 md:p-7 pl-7 md:pl-8">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
              <div className="min-w-0">
                <Hashtag className="mb-2 text-neon-yellow">{L('#seutime', '#yourteam')}</Hashtag>
                <h3 className="truncate font-impact text-[26px] uppercase leading-[1.1] text-white">
                  {club.name}
                </h3>
                <p className="mt-1 truncate font-mono text-[11.5px] text-cimento">
                  {club.city ?? '—'} · {squadSize} {squadSize === 1 ? L('jogador', 'player') : L('jogadores', 'players')}
                </p>
              </div>
              <div className="text-right">
                <p
                  className="ole-num leading-none text-neon-yellow"
                  style={{ fontSize: 'clamp(38px, 6.5vw, 52px)' }}
                >
                  {teamOverall || '—'}
                </p>
                <p className="mt-1 font-mono text-[10px] text-cimento uppercase tracking-[0.14em]">
                  {L('Overall do XI', 'XI Overall')}
                </p>
              </div>
            </div>

            {squadSize === 0 ? (
              <p className="mb-4 truncate text-[13px] text-cimento">{L('Monte o elenco antes de entrar.', 'Build your squad before joining.')}</p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleRegister}
                disabled={!canRegister}
                className={cn(
                  'ole-num inline-flex h-[50px] items-center whitespace-nowrap px-5 text-[13px] uppercase transition-colors',
                  canRegister
                    ? 'bg-neon-yellow text-black hover:bg-white [--corte:12px] [clip-path:var(--clip-corte)]'
                    : 'cursor-not-allowed border border-white/10 text-poeira',
                )}
              >
                {squadSize === 0
                  ? L('Sem elenco', 'No squad')
                  : status !== 'waiting_teams'
                    ? L('Cadastros encerrados', 'Registration closed')
                    : L('Entrar na Liga Global', 'Join the Global League')}
              </button>
              {squadSize === 0 ? (
                <button
                  type="button"
                  onClick={() => navigate('/clube/elenco')}
                  className="ole-num inline-flex h-[50px] items-center whitespace-nowrap border border-white/30 px-5 text-[13px] uppercase text-white transition-colors hover:border-white hover:bg-white/5"
                >
                  {L('Ir ao Elenco', 'Go to Squad')}
                </button>
              ) : null}
            </div>
          </div>
        </motion.section>
      ) : (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative isolate overflow-hidden border border-alta/40 bg-card"
        >
          <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-alta" />
          <div className="relative p-6 md:p-7 pl-7 md:pl-8">
            <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-alta">
              {L('Confirmado', 'Confirmed')}
            </p>
            <h3 className="font-impact text-[24px] uppercase leading-[1.1] text-white">
              {club.name} {L('está na Liga', 'is in the League')}
            </h3>
            <p className="mt-2 text-[13px] text-cimento">
              {L(`Playoffs começam com ${minTeams} times.`, `Playoffs start with ${minTeams} teams.`)}
            </p>
          </div>
        </motion.section>
      )}

      {/* ── Times cadastrados ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="border border-white/10 bg-card overflow-hidden"
      >
        <div className="border-b border-white/10 p-5 md:p-6 flex items-baseline justify-between gap-3">
          <h2 className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-giz">
            {L('Times cadastrados', 'Registered teams')}
          </h2>
          <span className="shrink-0 font-mono text-[11px] text-cimento">
            {teamsCount} {teamsCount === 1 ? 'manager' : 'managers'}
          </span>
        </div>
        <div className="p-5 md:p-6">
          {teamsCount === 0 ? (
            <p className="truncate text-[13px] text-cimento">{L('Ninguém cadastrado ainda.', 'No one registered yet.')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
              {sortedTeams.map((team, index) => {
                const isMe = team.managerId === managerId;
                return (
                <div
                  key={team.id}
                  className={cn(
                    'flex items-center justify-between gap-3 px-4 py-3',
                    isMe ? 'bg-neon-yellow text-black' : 'border border-white/[0.06] bg-panel',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={cn('ole-num w-8 shrink-0 text-[13px]', isMe ? 'text-black' : 'text-cimento')}>
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className={cn('truncate text-[14px]', isMe ? 'font-bold text-black' : 'text-giz')}>
                        {team.clubName}
                      </p>
                      <p className={cn('truncate font-mono text-[10px] uppercase tracking-[0.12em]', isMe ? 'text-black/70' : 'text-cimento')}>
                        {team.clubShort}
                      </p>
                    </div>
                  </div>
                  <span className={cn('ole-num shrink-0 text-[18px] leading-none', isMe ? 'text-black' : 'text-neon-yellow')}>
                    {team.overall}
                  </span>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}

/** Card de regra/explicação — Sprint B-4 Legacy: trilho colorido + texto-claro. */
function RuleCard({
  rail,
  eyebrow,
  title,
  description,
  delay = 0,
}: {
  rail: string;
  eyebrow: string;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="relative isolate overflow-hidden border border-white/10 bg-card"
    >
      <span aria-hidden className={`absolute left-0 top-0 h-full w-[3px] ${rail}`} />
      <div className="relative flex h-full flex-col gap-3 p-5 pl-6 sm:p-6 sm:pl-7">
        <Hashtag className="text-neon-yellow">{eyebrow}</Hashtag>
        <h3 className="font-impact text-[22px] uppercase leading-[1.1] text-white">
          {title}
        </h3>
        <p className="text-[12.5px] leading-snug text-cimento">{description}</p>
      </div>
    </motion.div>
  );
}
