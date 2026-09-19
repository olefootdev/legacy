/**
 * UI de Acompanhamento dos Playoffs
 * Mostra tabela de classificação e próximas rodadas
 */

import { motion } from 'motion/react';
import { Trophy, Calendar } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { Fragment, useMemo } from 'react';
import { BackButton } from '@/components/BackButton';
import { Hashtag } from '@/components/ui';
import { globalDivisionName } from '@/match/globalLeagueMVP';

export default function GlobalLeaguePlayoffs() {
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const club = useGameStore((s) => s.club);
  const managerId = managerProfile?.email ?? club?.id;
  const myTeamId = globalLeagueMVP?.teams.find((t) => t.managerId === managerId)?.id ?? null;

  // Ordenar times por pontos dos playoffs
  const standings = useMemo(() => {
    if (!globalLeagueMVP) return [];

    return [...globalLeagueMVP.teams].sort((a, b) => {
      if (b.playoffPoints !== a.playoffPoints) return b.playoffPoints - a.playoffPoints;
      if (b.playoffWins !== a.playoffWins) return b.playoffWins - a.playoffWins;
      const aDiff = a.playoffGoalsFor - a.playoffGoalsAgainst;
      const bDiff = b.playoffGoalsFor - b.playoffGoalsAgainst;
      if (bDiff !== aDiff) return bDiff - aDiff;
      if (b.playoffGoalsFor !== a.playoffGoalsFor) return b.playoffGoalsFor - a.playoffGoalsFor;
      return a.clubName.localeCompare(b.clubName);
    });
  }, [globalLeagueMVP]);

  const currentRound = globalLeagueMVP?.currentPlayoffRound || 1;
  const totalRounds = 6;

  if (!globalLeagueMVP || globalLeagueMVP.status !== 'playoffs') {
    return (
      <div className="mx-auto min-w-0 w-full max-w-4xl px-3 sm:px-4 lg:px-6 py-12 text-center">
        <p className="text-cimento">Playoffs ainda não iniciados</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 w-full max-w-6xl space-y-6 overflow-x-hidden px-3 sm:px-4 lg:px-6 pb-6 md:pb-8">
      <BackButton to="/match/global" label="Liga Global" />

      {/* Hero */}
      <section className="relative w-full overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14 text-center"
        >
          <Hashtag className="mb-4 text-black/70 sm:mb-6">#ligaglobal · playoffs</Hashtag>

          <h1 className="leading-[1.1]">
            <span
              className="block font-impact uppercase text-black"
              style={{
                fontSize: 'clamp(2.75rem, 8vw, 6rem)',
                letterSpacing: '0.005em',
              }}
            >
              Rodada {currentRound}
            </span>
            <span
              className="ole-num block uppercase text-black"
              style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)' }}
            >
              de {totalRounds}
            </span>
          </h1>

          {/* Progress */}
          <div className="mt-8 max-w-md mx-auto">
            <div className="h-2 bg-black/20 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(currentRound / totalRounds) * 100}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-black"
              />
            </div>
            <p className="mt-2 font-mono text-[11.5px] text-black/70">
              {totalRounds - currentRound} rodadas restantes
            </p>
          </div>
        </motion.div>
      </section>

      {/* Tabela de Classificação */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-panel border border-white/10 overflow-hidden"
      >
        <div className="bg-deep-black px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-neon-yellow" />
            <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-giz">
              Classificação dos playoffs
            </h2>
          </div>
          <p className="mt-1 font-mono text-[11px] text-cimento">
            Top 11 → {globalDivisionName(1)} · meio 11 → {globalDivisionName(2)} · últimos 10 → {globalDivisionName(3)}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-deep-black">
              <tr className="text-left">
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento">#</th>
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento">Time</th>
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento text-center">J</th>
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento text-center">V</th>
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento text-center">E</th>
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento text-center">D</th>
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento text-center">SG</th>
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento text-center">PTS</th>
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento text-center">Divisão</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((team, index) => {
                const position = index + 1;
                const division = position <= 11 ? 1 : position <= 22 ? 2 : 3;
                const divisionColor = division === 1 ? 'text-neon-yellow' : division === 2 ? 'text-giz' : 'text-cimento';
                const saldoGols = team.playoffGoalsFor - team.playoffGoalsAgainst;
                const isMe = !!myTeamId && team.id === myTeamId;
                const isLeader = index === 0;
                const cutAfter = position === 11 || position === 22;

                const tone = (normal: string) => (isMe ? 'text-black' : normal);

                return (
                  <Fragment key={team.id}>
                  <tr
                    className={`border-t border-white/[0.06] transition-colors ${
                      isMe ? 'bg-neon-yellow text-black' : 'hover:bg-card'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className={`ole-num text-sm ${tone(isLeader ? 'text-white' : 'text-cimento')}`}>{position}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <div className="min-w-0">
                          <p className={`truncate text-sm ${isMe ? 'font-bold text-black' : 'text-giz'}`}>{team.clubName}</p>
                          <p className={`font-mono text-[10.5px] ${tone('text-cimento')}`}>{team.clubShort}</p>
                        </div>
                        {isMe && (
                          <span className="shrink-0 bg-black px-[5px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-neon-yellow">você</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`ole-num text-sm ${tone('text-giz')}`}>{team.playoffMatchesPlayed}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`ole-num text-sm ${tone('text-alta')}`}>{team.playoffWins}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`ole-num text-sm ${tone('text-cimento')}`}>{team.playoffDraws}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`ole-num text-sm ${tone('text-baixa')}`}>{team.playoffLosses}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`ole-num text-sm ${tone(saldoGols > 0 ? 'text-alta' : saldoGols < 0 ? 'text-baixa' : 'text-cimento')}`}>
                        {saldoGols > 0 ? '+' : ''}{saldoGols}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`ole-num text-base ${tone('text-white')}`}>{team.playoffPoints}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] ${tone(divisionColor)}`}>
                        {globalDivisionName(division)}
                      </span>
                    </td>
                  </tr>
                  {cutAfter && (
                    <tr aria-hidden>
                      <td colSpan={9} className="px-4 py-0">
                        <div className="flex h-6 items-center gap-2">
                          <span className="block h-0 grow border-t border-dashed border-alta" />
                          <span className="whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-alta">
                            ↑ {globalDivisionName(division)}
                          </span>
                          <span className="block h-0 grow border-t border-dashed border-alta" />
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legenda */}
        <div className="bg-deep-black px-6 py-4 border-t border-white/10">
          <div className="flex flex-wrap gap-4 font-mono text-[11px]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-neon-yellow" />
              <span className="text-cimento">Seu clube</span>
            </div>
            <span className="text-neon-yellow">Div 1 · {globalDivisionName(1)} (top 11)</span>
            <span className="text-giz">Div 2 · {globalDivisionName(2)} (meio 11)</span>
            <span className="text-cimento">Div 3 · {globalDivisionName(3)} (últimos 10)</span>
          </div>
        </div>
      </motion.div>

      {/* Próximas Rodadas */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-panel border border-white/10 p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-neon-yellow" />
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-giz">
            Calendário
          </h2>
        </div>

        <div className="space-y-2">
          {globalLeagueMVP.playoffRounds.map((round) => (
            <div
              key={round.roundNumber}
              className={`flex items-center justify-between px-4 py-3 ${
                round.roundNumber === currentRound
                  ? 'bg-card border border-neon-yellow/50'
                  : 'bg-deep-black border border-white/[0.06]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`ole-num text-sm uppercase ${
                  round.roundNumber === currentRound ? 'text-neon-yellow' : 'text-cimento'
                }`}>
                  Rodada {round.roundNumber}
                </span>
                <span className="font-mono text-[11px] text-poeira">
                  {round.isReturning ? 'Returno' : 'Turno'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {round.status === 'finished' && (
                  <span className="font-mono text-[10.5px] text-alta uppercase tracking-[0.12em]">
                    Finalizada
                  </span>
                )}
                {round.status === 'live' && (
                  <span className="font-mono text-[10.5px] text-neon-yellow uppercase tracking-[0.12em] animate-pulse">
                    Ao vivo
                  </span>
                )}
                {round.status === 'scheduled' && (
                  <span className="font-mono text-[10.5px] text-cimento uppercase tracking-[0.12em]">
                    Agendada
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
