/**
 * UI de Acompanhamento dos Playoffs
 * Mostra tabela de classificação e próximas rodadas
 */

import { motion } from 'motion/react';
import { Trophy, Calendar } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { useMemo } from 'react';
import { BackButton } from '@/components/BackButton';

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
        <p className="text-white/60">Playoffs ainda não iniciados</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 w-full max-w-6xl space-y-6 overflow-x-hidden px-3 sm:px-4 lg:px-6 pb-6 md:pb-8">
      <BackButton to="/match/global" label="Liga Global" />

      {/* Hero */}
      <section className="relative w-full overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-6">
        <div className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden">
          <motion.span
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="font-serif-hero font-black text-black/[0.04]"
            style={{
              fontSize: 'clamp(180px, 32vw, 460px)',
              lineHeight: '0.85',
              letterSpacing: '-0.05em',
            }}
          >
            {currentRound}
          </motion.span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14 text-center"
        >
          <div className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-black mb-4 sm:mb-6">
            <span>Liga Global · Playoffs</span>
          </div>

          <h1 className="leading-[0.9]">
            <span
              className="block font-bold uppercase text-black"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.75rem, 8vw, 6rem)',
                letterSpacing: '0.005em',
              }}
            >
              Rodada {currentRound}
            </span>
            <span
              className="block italic text-black"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontSize: 'clamp(2.25rem, 7vw, 5rem)',
                marginTop: '0.04em',
                letterSpacing: '-0.01em',
              }}
            >
              de {totalRounds}
            </span>
          </h1>

          <span aria-hidden className="mx-auto mt-6 block w-16 h-[3px] bg-black" />

          {/* Progress */}
          <div className="mt-8 max-w-md mx-auto">
            <div className="h-3 bg-black/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(currentRound / totalRounds) * 100}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-black"
              />
            </div>
            <p className="mt-2 text-xs text-black/70">
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
        className="bg-panel border border-white/10 rounded-sm overflow-hidden"
      >
        <div className="bg-black/40 px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-neon-yellow" />
            <h2 className="font-display text-base font-bold uppercase tracking-wider text-white">
              Classificação dos Playoffs
            </h2>
          </div>
          <p className="text-xs text-white/60 mt-1">
            Top 11 → Divisão 1 · Meio 11 → Divisão 2 · Bottom 10 → Divisão 3
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-black/20">
              <tr className="text-left">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60">#</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60">Time</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">J</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">V</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">E</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">D</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">SG</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">PTS</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">Divisão</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((team, index) => {
                const position = index + 1;
                const division = position <= 11 ? 1 : position <= 22 ? 2 : 3;
                const divisionColor = division === 1 ? 'text-neon-yellow' : division === 2 ? 'text-slate-300' : 'text-amber-500';
                const saldoGols = team.playoffGoalsFor - team.playoffGoalsAgainst;
                const isMe = !!myTeamId && team.id === myTeamId;
                const isLeader = index === 0;
                const cutAfter = position === 11 || position === 22;

                return (
                  <tr
                    key={team.id}
                    className={`border-t border-white/5 transition-colors ${
                      isMe
                        ? 'bg-neon-yellow/[0.10] ring-1 ring-inset ring-neon-yellow/50'
                        : isLeader
                          ? 'bg-neon-yellow/[0.05]'
                          : 'hover:bg-white/5'
                    }`}
                    style={cutAfter ? { boxShadow: 'inset 0 -2px 0 0 rgba(253,225,0,0.35)' } : undefined}
                  >
                    <td className="px-4 py-3">
                      <span className={`font-mono text-sm ${isMe ? 'text-neon-yellow' : 'text-white/60'}`}>{position}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="min-w-0">
                          <p className={`font-display text-sm font-bold ${isMe ? 'text-neon-yellow' : 'text-white'}`}>{team.clubName}</p>
                          <p className="text-xs text-white/40">{team.clubShort}</p>
                        </div>
                        {isMe && (
                          <span className="shrink-0 rounded-sm bg-neon-yellow px-1.5 py-0.5 font-display text-[8px] font-black uppercase tracking-wider text-black">você</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-sm text-white/80">{team.playoffMatchesPlayed}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-sm text-emerald-400">{team.playoffWins}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-sm text-amber-400">{team.playoffDraws}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-sm text-red-400">{team.playoffLosses}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-mono text-sm ${saldoGols > 0 ? 'text-emerald-400' : saldoGols < 0 ? 'text-red-400' : 'text-white/60'}`}>
                        {saldoGols > 0 ? '+' : ''}{saldoGols}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-serif-hero text-base font-bold text-neon-yellow">{team.playoffPoints}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-display text-xs font-bold uppercase tracking-wider ${divisionColor}`}>
                        Div {division}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legenda */}
        <div className="bg-black/20 px-6 py-4 border-t border-white/10">
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-neon-yellow rounded-sm" />
              <span className="text-white/60">Divisão 1 (Top 11)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-400 rounded-sm" />
              <span className="text-white/60">Divisão 2 (Meio 11)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-white/20 rounded-sm" />
              <span className="text-white/60">Divisão 3 (Bottom 10)</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Próximas Rodadas */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-panel border border-white/10 rounded-sm p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h2 className="font-display text-base font-bold uppercase tracking-wider text-white">
            Calendário
          </h2>
        </div>

        <div className="space-y-2">
          {globalLeagueMVP.playoffRounds.map((round) => (
            <div
              key={round.roundNumber}
              className={`flex items-center justify-between px-4 py-3 rounded-sm ${
                round.roundNumber === currentRound
                  ? 'bg-neon-yellow/10 border border-neon-yellow/20'
                  : round.status === 'finished'
                  ? 'bg-black/20'
                  : 'bg-black/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`font-display text-sm font-bold ${
                  round.roundNumber === currentRound ? 'text-neon-yellow' : 'text-white/60'
                }`}>
                  Rodada {round.roundNumber}
                </span>
                <span className="text-xs text-white/40">
                  {round.isReturning ? '(Returno)' : '(Turno)'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {round.status === 'finished' && (
                  <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
                    Finalizada
                  </span>
                )}
                {round.status === 'live' && (
                  <span className="text-xs text-neon-yellow font-bold uppercase tracking-wider animate-pulse">
                    Ao Vivo
                  </span>
                )}
                {round.status === 'scheduled' && (
                  <span className="text-xs text-white/40 font-bold uppercase tracking-wider">
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
