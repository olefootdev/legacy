/**
 * Match Global — Painel Mundial de Rodadas Simultâneas
 *
 * Design inspirado no BVB (Borussia Dortmund) com identidade Olefoot
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Zap, Trophy, Activity, Target, Clock } from 'lucide-react';
import type { GlobalFixture } from '@/match/globalMatch';
import { simulateGlobalRound } from '@/match/globalMatchSimulator';
import { GLOBAL_MATCH_CONSTANTS } from '@/match/globalMatch';
import { StandingsSummary } from '@/components/matchglobal/StandingsSummary';

type FilterMode = 'all' | 'division_1' | 'division_2' | 'division_3';

function FixtureCard({ fixture, index }: { fixture: GlobalFixture; index: number }) {
  const lastEvent = fixture.events[fixture.events.length - 1];
  const hasGoal = fixture.scoreHome > 0 || fixture.scoreAway > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="sports-panel rounded-lg p-4 hover:border-neon-yellow/30 transition-all group"
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
          <p className="font-display text-xl font-bold text-white truncate group-hover:text-neon-yellow transition-colors">
            {fixture.homeTeamName}
          </p>
          <p className="text-sm text-text-soft mt-1">
            OVR <span className="text-neon-yellow font-serif-hero font-bold text-xl">{fixture.homeOverall}</span>
          </p>
        </div>

        {/* Placar Central */}
        <div className="flex items-center gap-3 px-4 py-2 bg-deep-black rounded-md border border-white/5">
          <motion.span
            key={`home-${fixture.scoreHome}`}
            initial={{ scale: hasGoal ? 1.5 : 1 }}
            animate={{ scale: 1 }}
            className="font-serif-hero text-5xl font-bold text-neon-yellow"
          >
            {fixture.scoreHome}
          </motion.span>
          <span className="text-text-muted text-2xl">×</span>
          <motion.span
            key={`away-${fixture.scoreAway}`}
            initial={{ scale: hasGoal ? 1.5 : 1 }}
            animate={{ scale: 1 }}
            className="font-serif-hero text-5xl font-bold text-neon-yellow"
          >
            {fixture.scoreAway}
          </motion.span>
        </div>

        {/* Time Visitante */}
        <div className="flex-1 text-right">
          <p className="font-display text-xl font-bold text-white truncate group-hover:text-neon-yellow transition-colors">
            {fixture.awayTeamName}
          </p>
          <p className="text-sm text-text-soft mt-1">
            OVR <span className="text-neon-yellow font-serif-hero font-bold text-xl">{fixture.awayOverall}</span>
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

export default function MatchGlobal() {
  const navigate = useNavigate();
  const globalLeague = useGameStore((s) => s.globalLeague);
  const olefootLeague = useGameStore((s) => s.olefootLeague);
  const dispatch = useGameDispatch();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [isSimulating, setIsSimulating] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentRound = globalLeague?.currentRound;

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Filtrar fixtures
  const filteredFixtures = useMemo(() => {
    if (!currentRound) return [];

    if (filterMode === 'all') {
      return currentRound.fixtures;
    }

    const division = filterMode.split('_')[1];
    return currentRound.fixtures.filter((f) => f.division === division);
  }, [currentRound, filterMode]);

  // Agrupar fixtures por divisão
  const fixturesByDivision = useMemo(() => {
    const grouped = new Map<string, GlobalFixture[]>();
    for (const fixture of filteredFixtures) {
      if (!grouped.has(fixture.division)) {
        grouped.set(fixture.division, []);
      }
      grouped.get(fixture.division)!.push(fixture);
    }
    return grouped;
  }, [filteredFixtures]);

  const handleRunRound = () => {
    if (!currentRound || isSimulating) return;

    setIsSimulating(true);

    // Simular rodada (gera todos os eventos)
    const kickoffMs = Date.now();
    const { updatedFixtures, allEvents, highlights } = simulateGlobalRound(
      currentRound.fixtures,
      kickoffMs
    );

    // Marcar rodada como "live" com os eventos pré-gerados
    dispatch({
      type: 'SET_GLOBAL_LEAGUE_STATE',
      payload: {
        ...globalLeague!,
        currentRound: {
          ...currentRound,
          status: 'live',
          actualKickoffMs: kickoffMs,
          fixtures: updatedFixtures.map(f => ({
            ...f,
            status: 'live',
            currentMinute: 0,
            scoreHome: 0,
            scoreAway: 0,
          })),
          highlights: [],
        },
      },
    });

    setIsSimulating(false);

    // Limpar interval anterior se existir
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Atualizar em tempo real durante 1 minuto
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - kickoffMs;

      if (elapsed >= GLOBAL_MATCH_CONSTANTS.ROUND_DURATION_MS) {
        // Rodada finalizada
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        dispatch({
          type: 'SET_GLOBAL_LEAGUE_STATE',
          payload: {
            ...globalLeague!,
            currentRound: {
              ...currentRound,
              status: 'finished',
              actualKickoffMs: kickoffMs,
              finishedAtMs: now,
              fixtures: updatedFixtures,
              highlights,
            },
          },
        });

        // Atualizar OLEFOOT LIGA com os resultados
        if (olefootLeague) {
          dispatch({
            type: 'FINALIZE_OLEFOOT_ROUND',
            roundNumber: olefootLeague.currentRoundNumber,
            fixtures: updatedFixtures,
          });
        }
      } else {
        // Atualizar minuto atual e revelar eventos
        const currentMinute = Math.floor(elapsed / GLOBAL_MATCH_CONSTANTS.GAME_MINUTE_MS);

        const liveFixtures = updatedFixtures.map(f => {
          const revealedEvents = f.events.filter(e => e.minute <= currentMinute);
          const scoreHome = revealedEvents.filter(e => e.type === 'goal' && e.side === 'home').length;
          const scoreAway = revealedEvents.filter(e => e.type === 'goal' && e.side === 'away').length;

          return {
            ...f,
            currentMinute,
            scoreHome,
            scoreAway,
            status: 'live' as const,
          };
        });

        dispatch({
          type: 'SET_GLOBAL_LEAGUE_STATE',
          payload: {
            ...globalLeague!,
            currentRound: {
              ...currentRound,
              status: 'live',
              actualKickoffMs: kickoffMs,
              fixtures: liveFixtures,
              highlights,
            },
          },
        });
      }
    }, 500); // Atualizar a cada 500ms
  };

  if (!currentRound) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-deep-black via-dark-gray to-deep-black flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Zap className="w-16 h-16 text-neon-yellow mx-auto mb-4" />
          <p className="font-display text-2xl font-bold uppercase tracking-wider text-white/60 mb-6">
            Nenhuma rodada criada
          </p>
          <button
            onClick={() => navigate('/match/global/setup')}
            className="btn-primary"
          >
            <span className="btn-primary-inner">
              <Play className="w-5 h-5" />
              Criar Mundo
            </span>
          </button>
        </motion.div>
      </div>
    );
  }

  const totalGames = currentRound.fixtures.length;
  const totalGoals = currentRound.fixtures.reduce((sum, f) => sum + f.scoreHome + f.scoreAway, 0);

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
                <Zap className="w-8 h-8 text-neon-yellow" />
                <h1 className="font-serif-hero text-6xl font-bold text-white italic">
                  Match Global
                </h1>
              </motion.div>
              <motion.p
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-text-soft text-sm font-display uppercase tracking-wider"
              >
                Rodada {currentRound.roundNumber} • <span className="font-serif-hero text-base font-bold text-neon-yellow">{totalGames}</span> jogos simultâneos • <span className="font-serif-hero text-base font-bold text-neon-green">{totalGoals}</span> gols
              </motion.p>
            </div>

            {/* Botão Rodar Rodada */}
            <button
              onClick={handleRunRound}
              disabled={isSimulating || currentRound.status === 'finished'}
              className={
                currentRound.status === 'finished'
                  ? 'btn-secondary opacity-50 cursor-not-allowed'
                  : 'btn-primary'
              }
            >
              <span className={currentRound.status === 'finished' ? 'btn-secondary-inner' : 'btn-primary-inner'}>
                {isSimulating ? (
                  <>
                    <Activity className="w-5 h-5 animate-spin" />
                    Simulando
                  </>
                ) : currentRound.status === 'finished' ? (
                  <>
                    <Trophy className="w-5 h-5" />
                    Finalizada
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Rodar Rodada
                  </>
                )}
              </span>
            </button>
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

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar">
          {[
            { key: 'all', label: 'Todas' },
            { key: 'division_1', label: '1ª Divisão' },
            { key: 'division_2', label: '2ª Divisão' },
            { key: 'division_3', label: '3ª Divisão' },
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setFilterMode(filter.key as FilterMode)}
              className={
                filterMode === filter.key
                  ? 'btn-primary whitespace-nowrap'
                  : 'btn-secondary whitespace-nowrap'
              }
            >
              <span className={filterMode === filter.key ? 'btn-primary-inner' : 'btn-secondary-inner'}>
                {filter.label}
              </span>
            </button>
          ))}
        </div>

        {/* Fixtures Grid */}
        {currentRound.status !== 'finished' && (
          <div className="space-y-8">
            {Array.from(fixturesByDivision.entries()).map(([division, fixtures]) => (
              <motion.div
                key={division}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neon-yellow/30 to-transparent" />
                  <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-white">
                    {division}ª Divisão
                  </h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neon-yellow/30 to-transparent" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fixtures.map((fixture, index) => (
                    <FixtureCard key={fixture.id} fixture={fixture} index={index} />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Classificação após rodada finalizada */}
        {currentRound.status === 'finished' && olefootLeague && (
          <StandingsSummary standings={olefootLeague.standings} />
        )}
      </div>
    </div>
  );
}
