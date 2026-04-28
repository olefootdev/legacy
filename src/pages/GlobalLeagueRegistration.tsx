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
      .map((p) => overallFromAttributes(p.attrs))
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
      ? { label: 'Cadastros abertos', tone: 'text-neon-yellow border-neon-yellow/40 bg-neon-yellow/10' }
      : status === 'playoffs'
        ? { label: 'Playoffs em curso', tone: 'text-fuchsia-300 border-fuchsia-400/40 bg-fuchsia-500/10' }
        : status === 'league_active'
          ? { label: 'Liga em curso', tone: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10' }
          : { label: 'Temporada encerrada', tone: 'text-white/65 border-white/15 bg-white/[0.03]' };

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6 pb-10">
      <BackButton to="/competicao/ligas" label="Ligas" />

      {/* ── HEADER editorial padrão Ranking ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-white/10 bg-dark-gray overflow-hidden"
        style={{ borderRadius: 'var(--radius-md)' }}
      >
        <div className="bg-black/40 p-6 md:p-8 border-b border-[var(--color-divider-yellow)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div
                className="font-display font-bold uppercase text-neon-yellow/85 mb-3"
                style={{ fontSize: '10px', letterSpacing: '0.28em' }}
              >
                Liga Global · Temporada 2026
              </div>
              <h1 className="leading-[0.92]">
                <span
                  className="block font-bold uppercase text-white"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(2rem, 5.5vw, 3.5rem)',
                    letterSpacing: '0.005em',
                  }}
                >
                  OLEFOOT LIGA
                </span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={teamsCount}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.35 }}
                    className="block italic text-neon-yellow mt-1"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {teamsCount}/{minTeams} times
                  </motion.span>
                </AnimatePresence>
              </h1>
            </div>
            <span
              className={cn(
                'inline-flex items-center rounded-[var(--radius-pill)] border px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-[0.22em]',
                statusBadge.tone,
              )}
            >
              {statusBadge.label}
            </span>
          </div>

          <span aria-hidden className="block w-12 h-[3px] bg-neon-yellow mt-5" />

          <p
            className="text-white/55 max-w-md mt-4"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', lineHeight: 1.5 }}
          >
            Competição mundial OLE: 32 times disputam playoffs, depois divididos em 3 divisões com promoção e
            rebaixamento contínuos.
          </p>

          {/* Progress bar (só durante cadastros) */}
          {status === 'waiting_teams' ? (
            <div className="mt-6 max-w-md">
              <div className="h-2 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.6 }}
                  className="h-full bg-neon-yellow shadow-[0_0_12px_rgba(253,225,0,0.4)]"
                />
              </div>
              <p className="mt-2 text-[12px] text-white/55">
                {remaining > 0
                  ? `Faltam ${remaining} time${remaining === 1 ? '' : 's'} para iniciar os playoffs.`
                  : 'Quórum atingido — playoffs prestes a começar.'}
              </p>
            </div>
          ) : null}
        </div>
      </motion.div>

      {/* ── 3 cards de regras (trilho lateral, sem ícones) ── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <RuleCard
          rail="bg-neon-yellow"
          eyebrow="Fase 1"
          title="Playoffs"
          description="3 rodadas ida e volta — 6 jogos para definir as divisões."
          delay={0.1}
        />
        <RuleCard
          rail="bg-cyan-300"
          eyebrow="Estrutura"
          title="3 Divisões"
          description="~11 times por divisão, baseado no desempenho dos playoffs."
          delay={0.2}
        />
        <RuleCard
          rail="bg-emerald-400"
          eyebrow="Ciclo"
          title="Promoção & Descenso"
          description="Top 10% sobem, bottom 10% descem a cada temporada."
          delay={0.3}
        />
      </section>

      {/* ── Card "Seu Time" ── */}
      {!isRegistered ? (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative isolate overflow-hidden border border-[var(--color-divider-yellow-strong)]"
          style={{
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-panel-elevated)',
            boxShadow: 'var(--shadow-card-hover)',
          }}
        >
          <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-neon-yellow" />
          <div className="relative p-6 md:p-7 pl-7 md:pl-8">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
              <div className="min-w-0">
                <div
                  className="font-display font-bold uppercase text-neon-yellow/80 mb-2"
                  style={{ fontSize: '10px', letterSpacing: '0.28em' }}
                >
                  Seu Time
                </div>
                <h3
                  className="font-display text-[24px] font-black uppercase tracking-tight text-white leading-tight"
                >
                  {club.name}
                </h3>
                <p className="mt-1 text-[12px] text-white/45 uppercase tracking-[0.22em]">
                  {club.city ?? '—'} · {squadSize} jogador{squadSize === 1 ? '' : 'es'}
                </p>
              </div>
              <div className="text-right">
                <p
                  className="italic tabular-nums leading-none text-neon-yellow"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontSize: 'clamp(40px, 7vw, 56px)',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {teamOverall || '—'}
                </p>
                <p className="mt-1 text-[10px] text-white/55 uppercase tracking-[0.22em]">
                  Overall do XI
                </p>
              </div>
            </div>

            {squadSize === 0 ? (
              <p className="mb-4 text-[13px] leading-relaxed text-white/55">
                Cadastra jogadores em <span className="text-neon-yellow">/clube/elenco</span> antes de entrar — a
                liga calcula o overall do teu XI titular.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleRegister}
                disabled={!canRegister}
                className={cn(
                  'inline-flex items-center px-6 py-3 font-display text-[12px] font-black uppercase tracking-[0.22em] transition-all',
                  canRegister
                    ? 'bg-neon-yellow text-black shadow-[0_4px_14px_rgba(253,225,0,0.18)] hover:bg-white hover:scale-[1.02] active:scale-[0.98]'
                    : 'cursor-not-allowed border border-white/15 bg-white/[0.03] text-white/35',
                )}
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                {squadSize === 0
                  ? 'Sem elenco'
                  : status !== 'waiting_teams'
                    ? 'Cadastros encerrados'
                    : 'Entrar na Liga Global'}
              </button>
              {squadSize === 0 ? (
                <button
                  type="button"
                  onClick={() => navigate('/clube/elenco')}
                  className="inline-flex items-center border border-white/20 bg-deep-black px-6 py-3 font-display text-[12px] font-black uppercase tracking-[0.22em] text-white/85 transition-colors hover:border-neon-yellow hover:text-neon-yellow"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  Ir ao Elenco
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
          className="relative isolate overflow-hidden border border-emerald-400/30"
          style={{
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-panel-elevated)',
            boxShadow: 'var(--shadow-card-hover)',
          }}
        >
          <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-emerald-400" />
          <div className="relative p-6 md:p-7 pl-7 md:pl-8">
            <div
              className="font-display font-bold uppercase text-emerald-300/85 mb-2"
              style={{ fontSize: '10px', letterSpacing: '0.28em' }}
            >
              Confirmado
            </div>
            <h3 className="font-display text-[22px] font-black uppercase tracking-tight text-white leading-tight">
              {club.name} está na Liga
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">
              Aguardando os outros managers — quando atingirmos {minTeams} times, os playoffs começam
              automaticamente.
            </p>
          </div>
        </motion.section>
      )}

      {/* ── Times cadastrados ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="border border-white/[0.05] overflow-hidden"
        style={{
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-panel-elevated)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="border-b border-[var(--color-divider-yellow)] p-5 md:p-6 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[14px] font-black uppercase tracking-[0.22em] text-white">
            Times cadastrados
          </h2>
          <span className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
            {teamsCount} {teamsCount === 1 ? 'manager' : 'managers'}
          </span>
        </div>
        <div className="p-5 md:p-6">
          {teamsCount === 0 ? (
            <p className="text-[13px] leading-relaxed text-white/45">
              Ninguém cadastrado ainda. Sê o primeiro a entrar na competição mundial — basta ter elenco e tática
              prontos no <span className="text-neon-yellow">Plantel</span>.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
              {sortedTeams.map((team, index) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between border border-white/[0.05] bg-[var(--color-panel-soft)] px-4 py-3"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="shrink-0 font-display text-[12px] font-black tabular-nums text-white/40"
                      style={{ width: '2rem' }}
                    >
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-display text-[13px] font-bold uppercase tracking-wide text-white">
                        {team.clubName}
                      </p>
                      <p className="truncate text-[10px] uppercase tracking-[0.22em] text-white/40">
                        {team.clubShort}
                      </p>
                    </div>
                  </div>
                  <span
                    className="shrink-0 italic tabular-nums leading-none text-neon-yellow"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontSize: '22px',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {team.overall}
                  </span>
                </div>
              ))}
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
      className="relative isolate overflow-hidden border border-white/[0.05]"
      style={{
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-panel-elevated)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <span aria-hidden className={`absolute left-0 top-0 h-full w-[3px] ${rail}`} />
      <div className="relative flex h-full flex-col gap-3 p-5 pl-6 sm:p-6 sm:pl-7">
        <span
          className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80"
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          {eyebrow}
        </span>
        <h3 className="font-display text-[20px] font-black uppercase leading-tight tracking-tight text-white">
          {title}
        </h3>
        <p className="text-[12px] leading-relaxed text-white/55">{description}</p>
      </div>
    </motion.div>
  );
}
