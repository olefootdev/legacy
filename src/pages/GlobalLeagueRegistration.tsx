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
import { BarraSegmentos, SecaoRua, SeloRua } from '@/components/ui/Rua';
import { CabecalhoRua, LinhaRua, VazioRua } from '@/components/leagues/RuaTabela';
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
      ? { label: L('Cadastros abertos', 'Registration open'), tom: 'corre-contorno' as const }
      : status === 'playoffs'
        ? { label: L('Playoffs em curso', 'Playoffs underway'), tom: 'cal' as const }
        : status === 'active'
          ? { label: L('Liga em curso', 'League underway'), tom: 'corre' as const }
          : { label: L('Temporada encerrada', 'Season over'), tom: 'mudo' as const };

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-8 overflow-x-hidden pb-10 px-3 sm:px-4">
      <BackButton to="/competicao/ligas" label={L('Ligas', 'Leagues')} />

      {/* ── Cabeçalho ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <CabecalhoRua rotulo={L('#ligaglobal · temporada 2026', '#globalleague · season 2026')} titulo={L('Liga Global', 'Global League')}>
          <div className="flex flex-wrap items-center gap-3">
            <AnimatePresence mode="wait">
              <motion.span
                key={teamsCount}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
                className="font-spray font-black uppercase leading-none text-rua"
                style={{ fontSize: 'clamp(40px, 11vw, 64px)' }}
              >
                {teamsCount}/{minTeams} {L('times', 'teams')}
              </motion.span>
            </AnimatePresence>
            <SeloRua tom={statusBadge.tom}>{statusBadge.label}</SeloRua>
          </div>
          {status === 'waiting_teams' ? (
            <div className="flex max-w-md flex-col gap-2">
              <BarraSegmentos valor={teamsCount} max={minTeams} />
              <p className="font-voz text-[22px] leading-[1.05] text-suave">
                {remaining > 0
                  ? L(`Faltam ${remaining} time${remaining === 1 ? '' : 's'} pros playoffs.`, `${remaining} more team${remaining === 1 ? '' : 's'} to the playoffs.`)
                  : L('Quórum fechado. Os playoffs vêm aí.', 'Quorum reached. Playoffs are coming.')}
              </p>
            </div>
          ) : null}
        </CabecalhoRua>
      </motion.div>

      {/* ── Ficha de inscrição: ingresso amarelo (é ação) ou carimbo de confirmado ── */}
      {!isRegistered ? (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative flex min-w-0 flex-col gap-5 overflow-hidden bg-rua p-5 text-asfalto-27 sm:p-7"
        >
          <span aria-hidden className="rua-alambrado absolute inset-x-0 top-0 h-32 [--alambrado:rgba(13,13,12,0.28)]" />
          <div className="relative flex items-center justify-between gap-3 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em]">
            <span>{L('Ficha de inscrição', 'Entry form')}</span>
            <span>{L('#teutime', '#yourteam')}</span>
          </div>
          <div className="relative flex min-w-0 items-end justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="font-impact uppercase leading-[0.86] [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(40px, 11vw, 72px)' }}>
                {club.name}
              </h3>
              <p className="truncate font-prova text-[11.5px] font-bold uppercase tracking-[0.1em]">
                {club.city ?? '—'} · {squadSize} {squadSize === 1 ? L('jogador', 'player') : L('jogadores', 'players')}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="font-impact leading-none" style={{ fontSize: 'clamp(44px, 12vw, 64px)' }}>{teamOverall || '—'}</span>
              <span className="font-prova text-[10px] font-bold uppercase tracking-[0.14em]">{L('Overall do XI', 'XI Overall')}</span>
            </div>
          </div>

          {squadSize === 0 ? (
            <p className="relative font-voz text-[22px] leading-none">{L('Monta o elenco antes de entrar.', 'Build your squad before joining.')}</p>
          ) : (
            <p className="relative font-voz text-[22px] leading-none">{L('Quem chega com respeito, entra.', 'Walk in with respect.')}</p>
          )}

          <div className="relative flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleRegister}
              disabled={!canRegister}
              className={cn(
                'inline-flex min-h-[54px] items-center gap-2 whitespace-nowrap px-6 font-impact text-[20px] uppercase leading-none transition-transform',
                canRegister ? 'bg-asfalto-27 text-rua hover:-translate-y-0.5' : 'cursor-not-allowed border-2 border-dashed border-asfalto-27/50 text-asfalto-27/60',
              )}
            >
              {squadSize === 0
                ? L('Sem elenco', 'No squad')
                : status !== 'waiting_teams'
                  ? L('Cadastros encerrados', 'Registration closed')
                  : L('Entrar na Liga Global', 'Join the Global League')}
              {canRegister && <span aria-hidden>→</span>}
            </button>
            {squadSize === 0 ? (
              <button
                type="button"
                onClick={() => navigate('/clube/elenco')}
                className="inline-flex min-h-[54px] items-center whitespace-nowrap border-2 border-asfalto-27 px-5 font-impact text-[19px] uppercase leading-none transition-colors hover:bg-asfalto-27 hover:text-rua"
              >
                {L('Ir ao Elenco', 'Go to Squad')}
              </button>
            ) : null}
          </div>
        </motion.section>
      ) : (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-1 flex -rotate-1 flex-col gap-2 bg-cal p-5 text-asfalto-27 shadow-[5px_5px_0_var(--color-rua)] sm:p-6"
        >
          <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.2em]">✓ {L('Confirmado', 'Confirmed')}</span>
          <h3 className="font-impact uppercase leading-[0.9]" style={{ fontSize: 'clamp(30px, 8vw, 44px)' }}>
            {club.name} {L('tá na Liga', 'is in the League')}
          </h3>
          <p className="font-voz text-[22px] leading-none">
            {L(`Playoffs começam com ${minTeams} times.`, `Playoffs start with ${minTeams} teams.`)}
          </p>
        </motion.section>
      )}

      {/* ── Regras — degrau CHÃO: o que ainda vai acontecer ── */}
      <section className="flex min-w-0 flex-col gap-3">
        <SecaoRua label={L('Como funciona', 'How it works')} aside="03" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <RuleCard
            num="01"
            eyebrow={L('#fase1', '#phase1')}
            title="Playoffs"
            description={L('3 rodadas ida e volta — 6 jogos pra definir as divisões.', '3 home-and-away rounds — 6 matches to set the divisions.')}
            delay={0.2}
          />
          <RuleCard
            num="02"
            eyebrow={L('#estrutura', '#structure')}
            title={L('3 Divisões', '3 Divisions')}
            description={L('~11 times por divisão, pelo desempenho nos playoffs.', '~11 teams per division, based on playoff results.')}
            delay={0.25}
          />
          <RuleCard
            num="03"
            eyebrow={L('#ciclo', '#cycle')}
            title={L('Acesso & Queda', 'Promotion & Relegation')}
            description={L('Top 10% sobem, últimos 10% descem a cada temporada.', 'Top 10% go up, bottom 10% go down each season.')}
            delay={0.3}
          />
        </div>
      </section>

      {/* ── Times cadastrados ── */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="flex min-w-0 flex-col gap-3">
        <SecaoRua label={L('Times cadastrados', 'Registered teams')} aside={`${teamsCount} ${teamsCount === 1 ? 'manager' : 'managers'}`} />
        {teamsCount === 0 ? (
          <VazioRua titulo={L('Ninguém cadastrado ainda', 'No one registered yet')} frase={L('O primeiro a chegar escolhe o lugar.', 'First one in picks the spot.')} />
        ) : (
          <div className="grid max-h-[480px] grid-cols-1 gap-1.5 overflow-y-auto overflow-x-hidden p-1 sm:grid-cols-2">
            {sortedTeams.map((team, index) => {
              const isMe = team.managerId === managerId;
              return (
                <LinhaRua
                  key={team.id}
                  pos={index + 1}
                  tom={isMe ? 'eu' : index === 0 ? 'lider' : 'normal'}
                  nome={team.clubName}
                  sub={team.clubShort}
                  valor={<span className={isMe || index === 0 ? undefined : 'text-rua'}>{team.overall}</span>}
                />
              );
            })}
          </div>
        )}
      </motion.section>
    </div>
  );
}

/** Card de regra — degrau CHÃO: contorno tracejado e número vazado. */
function RuleCard({
  num,
  eyebrow,
  title,
  description,
  delay = 0,
}: {
  num: string;
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
      className="flex h-full flex-col gap-2 border-2 border-dashed border-fio p-5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-impact text-[44px] leading-none text-transparent [-webkit-text-stroke:1.5px_var(--color-papel)]">{num}</span>
        <span className="font-prova text-[11px] font-bold uppercase tracking-[0.14em] text-mudo">{eyebrow}</span>
      </div>
      <h3 className="font-impact text-[22px] uppercase leading-none text-papel">{title}</h3>
      <p className="text-[13px] leading-snug text-suave">{description}</p>
    </motion.div>
  );
}
