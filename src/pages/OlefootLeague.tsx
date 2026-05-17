/**
 * OLEFOOT LIGA — Página Principal
 *
 * Sistema completo de liga com:
 * - 3 divisões com 10 times cada
 * - 18 rodadas (turno + returno)
 * - Tabela de classificação atualizada automaticamente
 * - Simulação de 1 minuto por rodada
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useGameStore, useGameDispatch, getGameState } from '@/game/store';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Trophy,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Zap,
  Target,
  Clock,
} from 'lucide-react';
import type { GlobalFixture } from '@/match/globalMatch';
import { simulateGlobalRound } from '@/match/globalMatchSimulator';
import { GLOBAL_MATCH_CONSTANTS } from '@/match/globalMatch';
import { createOlefootLeague, type OlefootLeagueTeam } from '@/match/olefootLeague';

type ViewMode = 'fixtures' | 'standings';

function StandingsTable({ division, teams }: { key?: import("react").Key; division: number; teams: OlefootLeagueTeam[] }) {
  return (
    <div className="sports-panel rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-deep-black border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-neon-yellow" />
          <h3 className="font-display text-xl font-bold uppercase tracking-wider text-white">
            {division}ª Divisão
          </h3>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              <th className="text-left px-4 py-2 text-xs text-text-soft uppercase tracking-wider font-display">
                Pos
              </th>
              <th className="text-left px-4 py-2 text-xs text-text-soft uppercase tracking-wider font-display">
                Time
              </th>
              <th className="text-center px-2 py-2 text-xs text-text-soft uppercase tracking-wider font-display">
                P
              </th>
              <th className="text-center px-2 py-2 text-xs text-text-soft uppercase tracking-wider font-display">
                J
              </th>
              <th className="text-center px-2 py-2 text-xs text-text-soft uppercase tracking-wider font-display">
                V
              </th>
              <th className="text-center px-2 py-2 text-xs text-text-soft uppercase tracking-wider font-display">
                E
              </th>
              <th className="text-center px-2 py-2 text-xs text-text-soft uppercase tracking-wider font-display">
                D
              </th>
              <th className="text-center px-2 py-2 text-xs text-text-soft uppercase tracking-wider font-display">
                GP
              </th>
              <th className="text-center px-2 py-2 text-xs text-text-soft uppercase tracking-wider font-display">
                GC
              </th>
              <th className="text-center px-2 py-2 text-xs text-text-soft uppercase tracking-wider font-display">
                SG
              </th>
              <th className="text-left px-4 py-2 text-xs text-text-soft uppercase tracking-wider font-display">
                Últimos 5
              </th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, index) => {
              const positionChange =
                team.previousPosition !== undefined
                  ? team.previousPosition - team.position
                  : 0;

              return (
                <motion.tr
                  key={team.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  {/* Posição */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-serif-hero text-xl font-bold text-white">
                        {team.position}
                      </span>
                      {positionChange > 0 && (
                        <TrendingUp className="w-4 h-4 text-neon-green" />
                      )}
                      {positionChange < 0 && (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                      {positionChange === 0 && team.matchesPlayed > 0 && (
                        <Minus className="w-4 h-4 text-text-muted" />
                      )}
                    </div>
                  </td>

                  {/* Time */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-display text-base font-bold text-white">
                        {team.name}
                      </p>
                      <p className="text-xs text-text-soft">
                        OVR <span className="font-serif-hero font-bold text-neon-yellow">{team.overall}</span>
                      </p>
                    </div>
                  </td>

                  {/* Pontos */}
                  <td className="px-2 py-3 text-center">
                    <span className="font-serif-hero text-xl font-bold text-neon-yellow">
                      {team.points}
                    </span>
                  </td>

                  {/* Jogos */}
                  <td className="px-2 py-3 text-center">
                    <span className="font-serif-hero text-base text-white">
                      {team.matchesPlayed}
                    </span>
                  </td>

                  {/* Vitórias */}
                  <td className="px-2 py-3 text-center">
                    <span className="font-serif-hero text-base text-neon-green">
                      {team.wins}
                    </span>
                  </td>

                  {/* Empates */}
                  <td className="px-2 py-3 text-center">
                    <span className="font-serif-hero text-base text-text-muted">
                      {team.draws}
                    </span>
                  </td>

                  {/* Derrotas */}
                  <td className="px-2 py-3 text-center">
                    <span className="font-serif-hero text-base text-red-500">
                      {team.losses}
                    </span>
                  </td>

                  {/* Gols Pró */}
                  <td className="px-2 py-3 text-center">
                    <span className="font-serif-hero text-base text-white">
                      {team.goalsFor}
                    </span>
                  </td>

                  {/* Gols Contra */}
                  <td className="px-2 py-3 text-center">
                    <span className="font-serif-hero text-base text-white">
                      {team.goalsAgainst}
                    </span>
                  </td>

                  {/* Saldo */}
                  <td className="px-2 py-3 text-center">
                    <span
                      className={`font-serif-hero text-base font-bold ${
                        team.goalDifference > 0
                          ? 'text-neon-green'
                          : team.goalDifference < 0
                          ? 'text-red-500'
                          : 'text-text-muted'
                      }`}
                    >
                      {team.goalDifference > 0 ? '+' : ''}
                      {team.goalDifference}
                    </span>
                  </td>

                  {/* Forma Recente */}
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {team.recentForm.map((result, i) => (
                        <div
                          key={i}
                          className={`w-6 h-6 rounded flex items-center justify-center text-xs font-display font-bold ${
                            result === 'W'
                              ? 'bg-neon-green/20 text-neon-green'
                              : result === 'D'
                              ? 'bg-neon-yellow/20 text-neon-yellow'
                              : 'bg-red-500/20 text-red-500'
                          }`}
                        >
                          {result}
                        </div>
                      ))}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FixtureCard({ fixture, index }: { key?: import("react").Key; fixture: GlobalFixture; index: number }) {
  const lastEvent = fixture.events[fixture.events.length - 1];
  const hasGoal = fixture.scoreHome > 0 || fixture.scoreAway > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="sports-panel rounded-lg p-4 hover:border-neon-yellow/30 transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-soft uppercase tracking-wider font-display">
          Divisão {fixture.division}
        </span>
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-neon-green" />
          <span className="font-serif-hero font-bold text-white text-lg">
            {fixture.currentMinute}'
          </span>
        </div>
      </div>

      {/* Placar */}
      <div className="flex items-center justify-between gap-4 mb-3">
        {/* Time Casa */}
        <div className="flex-1 text-left">
          <p className="font-display text-lg font-bold text-white truncate">
            {fixture.homeTeamName}
          </p>
          <p className="text-xs text-text-soft mt-1">
            OVR <span className="text-neon-yellow font-serif-hero font-bold text-base">{fixture.homeOverall}</span>
          </p>
        </div>

        {/* Placar Central */}
        <div className="flex items-center gap-3 px-4 py-2 bg-deep-black rounded-md border border-white/5">
          <motion.span
            key={`home-${fixture.scoreHome}`}
            initial={{ scale: hasGoal ? 1.5 : 1 }}
            animate={{ scale: 1 }}
            className="font-serif-hero text-4xl font-bold text-neon-yellow"
          >
            {fixture.scoreHome}
          </motion.span>
          <span className="text-text-muted text-xl">×</span>
          <motion.span
            key={`away-${fixture.scoreAway}`}
            initial={{ scale: hasGoal ? 1.5 : 1 }}
            animate={{ scale: 1 }}
            className="font-serif-hero text-4xl font-bold text-neon-yellow"
          >
            {fixture.scoreAway}
          </motion.span>
        </div>

        {/* Time Visitante */}
        <div className="flex-1 text-right">
          <p className="font-display text-lg font-bold text-white truncate">
            {fixture.awayTeamName}
          </p>
          <p className="text-xs text-text-soft mt-1">
            OVR <span className="text-neon-yellow font-serif-hero font-bold text-base">{fixture.awayOverall}</span>
          </p>
        </div>
      </div>

      {/* Último Evento */}
      <AnimatePresence mode="wait">
        {lastEvent && (
          <motion.div
            key={lastEvent.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="bg-deep-black rounded px-3 py-2 border-l-2 border-l-neon-green"
          >
            <p className="text-xs text-gray-300">
              <span className="font-serif-hero font-bold text-neon-yellow text-sm">
                {lastEvent.minute}'
              </span>{' '}
              {lastEvent.text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function OlefootLeague() {
  const navigate = useNavigate();
  const olefootLeague = useGameStore((s) => s.olefootLeague);
  const dispatch = useGameDispatch();
  const [viewMode, setViewMode] = useState<ViewMode>('fixtures');
  const [isSimulating, setIsSimulating] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Se não existe liga, criar (apenas uma vez)
  useEffect(() => {
    if (!olefootLeague) {
      const newLeague = createOlefootLeague();
      dispatch({ type: 'SET_OLEFOOT_LEAGUE', payload: newLeague });
    }
  }, []); // Executar apenas no mount

  if (!olefootLeague) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-deep-black via-dark-gray to-deep-black flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-neon-yellow mx-auto" />
          <p className="font-display text-xl font-bold uppercase tracking-wider text-white">
            Criando OLEFOOT LIGA...
          </p>
        </div>
      </div>
    );
  }

  const currentRound = olefootLeague.rounds[olefootLeague.currentRoundNumber - 1];
  const isLastRound = olefootLeague.currentRoundNumber >= 18;

  const handleRunRound = () => {
    if (!currentRound || isSimulating || currentRound.status === 'finished') return;

    setIsSimulating(true);

    // Simular rodada
    const kickoffMs = Date.now();
    const { updatedFixtures } = simulateGlobalRound(currentRound.fixtures, kickoffMs);

    // Marcar como live
    const updatedRounds = olefootLeague.rounds.map((r) => {
      if (r.roundNumber === currentRound.roundNumber) {
        return {
          ...r,
          status: 'live' as const,
          actualKickoffMs: kickoffMs,
          fixtures: updatedFixtures.map((f) => ({
            ...f,
            status: 'live' as const,
            currentMinute: 0,
            scoreHome: 0,
            scoreAway: 0,
          })),
        };
      }
      return r;
    });

    dispatch({
      type: 'SET_OLEFOOT_LEAGUE',
      payload: {
        ...olefootLeague,
        rounds: updatedRounds,
      },
    });

    setIsSimulating(false);

    // Limpar interval anterior se existir
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Atualizar em tempo real
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - kickoffMs;

      if (elapsed >= GLOBAL_MATCH_CONSTANTS.ROUND_DURATION_MS) {
        // Rodada finalizada
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // Finalizar rodada e atualizar tabela
        dispatch({
          type: 'FINALIZE_OLEFOOT_ROUND',
          roundNumber: currentRound.roundNumber,
          fixtures: updatedFixtures,
        });
      } else {
        const currentMinute = Math.floor(elapsed / GLOBAL_MATCH_CONSTANTS.GAME_MINUTE_MS);

        const liveFixtures = updatedFixtures.map((f) => {
          const revealedEvents = f.events.filter((e) => e.minute <= currentMinute);
          const scoreHome = revealedEvents.filter(
            (e) => e.type === 'goal' && e.side === 'home'
          ).length;
          const scoreAway = revealedEvents.filter(
            (e) => e.type === 'goal' && e.side === 'away'
          ).length;

          return {
            ...f,
            currentMinute,
            scoreHome,
            scoreAway,
            status: 'live' as const,
          };
        });

        // Buscar estado atualizado do store
        const currentLeague = getGameState().olefootLeague;
        if (!currentLeague) return;

        const updatedRounds = currentLeague.rounds.map((r) => {
          if (r.roundNumber === currentRound.roundNumber) {
            return {
              ...r,
              fixtures: liveFixtures,
            };
          }
          return r;
        });

        dispatch({
          type: 'SET_OLEFOOT_LEAGUE',
          payload: {
            ...currentLeague,
            rounds: updatedRounds,
          },
        });
      }
    }, 500);
  };

  const handleNextRound = () => {
    dispatch({ type: 'ADVANCE_OLEFOOT_ROUND' });
    setViewMode('fixtures');
  };

  const totalGames = currentRound.fixtures.length;
  const totalGoals = currentRound.fixtures.reduce(
    (sum, f) => sum + f.scoreHome + f.scoreAway,
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-deep-black via-dark-gray to-deep-black">
      {/* Hero Header */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-r from-neon-yellow/5 via-transparent to-neon-green/5" />

        <div className="relative max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-end justify-between">
            {/* Título */}
            <div>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 mb-2"
              >
                <Trophy className="w-8 h-8 text-neon-yellow" />
                <h1 className="font-serif-hero text-6xl font-bold text-white italic">
                  OLEFOOT LIGA
                </h1>
              </motion.div>
              <motion.p
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-text-soft text-sm font-display uppercase tracking-wider"
              >
                {olefootLeague.seasonName} • Rodada{' '}
                <span className="font-serif-hero text-base font-bold text-neon-yellow">
                  {currentRound.roundNumber}
                </span>
                /18 • {currentRound.isReturning ? 'Returno' : 'Turno'}
              </motion.p>
            </div>

            {/* Botões */}
            <div className="flex gap-3">
              {currentRound.status === 'finished' && !isLastRound && (
                <button onClick={handleNextRound} className="btn-primary">
                  <span className="btn-primary-inner">
                    <ChevronRight className="w-5 h-5" />
                    Próxima Rodada
                  </span>
                </button>
              )}

              {currentRound.status !== 'finished' && (
                <button
                  onClick={handleRunRound}
                  disabled={isSimulating}
                  className="btn-primary"
                >
                  <span className="btn-primary-inner">
                    {isSimulating ? (
                      <>
                        <Activity className="w-5 h-5 animate-spin" />
                        Simulando
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5" />
                        Rodar Rodada
                      </>
                    )}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Status Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sports-panel panel-accent rounded-lg p-4 mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-soft uppercase tracking-wider font-display mb-1">
                Status da Rodada
              </p>
              <div className="flex items-center gap-2">
                {currentRound.status === 'scheduled' && (
                  <>
                    <Clock className="w-5 h-5 text-neon-yellow" />
                    <p className="font-display text-xl font-bold uppercase tracking-wider text-white">
                      Agendada
                    </p>
                  </>
                )}
                {currentRound.status === 'live' && (
                  <>
                    <Activity className="w-5 h-5 text-neon-green animate-pulse" />
                    <p className="font-display text-xl font-bold uppercase tracking-wider text-white">
                      Ao Vivo
                    </p>
                  </>
                )}
                {currentRound.status === 'finished' && (
                  <>
                    <Trophy className="w-5 h-5 text-neon-yellow" />
                    <p className="font-display text-xl font-bold uppercase tracking-wider text-white">
                      Finalizada
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-6">
              <div className="text-right">
                <p className="text-xs text-text-soft uppercase tracking-wider font-display mb-1">
                  Jogos
                </p>
                <div className="flex items-center justify-end gap-2">
                  <Target className="w-5 h-5 text-neon-yellow" />
                  <p className="font-serif-hero text-4xl font-bold text-neon-yellow">
                    {totalGames}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-soft uppercase tracking-wider font-display mb-1">
                  Gols
                </p>
                <div className="flex items-center justify-end gap-2">
                  <Zap className="w-5 h-5 text-neon-green" />
                  <p className="font-serif-hero text-4xl font-bold text-neon-green">
                    {totalGoals}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* View Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setViewMode('fixtures')}
            className={viewMode === 'fixtures' ? 'btn-primary' : 'btn-secondary'}
          >
            <span className={viewMode === 'fixtures' ? 'btn-primary-inner' : 'btn-secondary-inner'}>
              Jogos
            </span>
          </button>
          <button
            onClick={() => setViewMode('standings')}
            className={viewMode === 'standings' ? 'btn-primary' : 'btn-secondary'}
          >
            <span className={viewMode === 'standings' ? 'btn-primary-inner' : 'btn-secondary-inner'}>
              Classificação
            </span>
          </button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {viewMode === 'fixtures' && (
            <motion.div
              key="fixtures"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {currentRound.fixtures.map((fixture, index) => (
                <FixtureCard key={fixture.id} fixture={fixture} index={index} />
              ))}
            </motion.div>
          )}

          {viewMode === 'standings' && (
            <motion.div
              key="standings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {olefootLeague.standings.map((standing) => (
                <StandingsTable
                  key={standing.division}
                  division={standing.division}
                  teams={standing.teams}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
