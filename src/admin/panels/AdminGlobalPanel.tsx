/**
 * Admin Global Panel — Gerenciamento de Ligas Globais
 *
 * Permite:
 * - Criar/editar OLEFOOT LIGA
 * - Visualizar rodadas em tempo real
 * - Controlar scheduler (pausar/retomar)
 * - Ver eventos ao vivo
 * - Forçar avanço de rodadas
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  SkipForward,
  RefreshCw,
  Trash2,
  Plus,
  Activity,
  Clock,
  Trophy,
  Zap,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { createOlefootLeague } from '@/match/olefootLeague';
import { formatRoundTime, getTimeUntilNextRound } from '@/match/globalRoundScheduler';
import type { GlobalFixture } from '@/match/globalMatch';
import { cn } from '@/lib/utils';

export function AdminGlobalPanel() {
  const dispatch = useGameDispatch();
  const globalLeague = useGameStore((s) => s.globalLeague);
  const olefootLeague = useGameStore((s) => s.olefootLeague);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });

  const currentRound = globalLeague?.currentRound;

  // Countdown timer
  useEffect(() => {
    if (!currentRound || !autoRefresh) return;

    const interval = setInterval(() => {
      const nowMs = Date.now();
      let targetMs: number;

      if (currentRound.status === 'live' && currentRound.actualKickoffMs) {
        targetMs = currentRound.actualKickoffMs + 60000;
      } else if (currentRound.status === 'finished' && currentRound.finishedAtMs) {
        targetMs = currentRound.finishedAtMs + 3600000;
      } else {
        targetMs = currentRound.scheduledKickoffMs;
      }

      const time = getTimeUntilNextRound(targetMs, nowMs);
      setCountdown(time);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentRound, autoRefresh]);

  const handleCreateLeague = () => {
    if (olefootLeague) {
      if (!window.confirm('Já existe uma liga. Criar nova vai resetar tudo. Continuar?')) {
        return;
      }
    }

    const newLeague = createOlefootLeague();
    dispatch({ type: 'SET_OLEFOOT_LEAGUE', payload: newLeague });

    const nextKickoffMs = Date.now() + 60000;
    dispatch({
      type: 'CREATE_GLOBAL_ROUND',
      scheduledKickoffMs: nextKickoffMs,
    });
  };

  const handleForceStart = () => {
    if (!currentRound || currentRound.status === 'live') return;
    dispatch({ type: 'START_GLOBAL_ROUND' });
  };

  const handleForceFinish = () => {
    if (!currentRound || currentRound.status !== 'live') return;
    dispatch({ type: 'FINISH_GLOBAL_ROUND', nowMs: Date.now() });
  };

  const handleForceAdvance = () => {
    if (!currentRound || currentRound.status !== 'finished') return;
    dispatch({ type: 'ADVANCE_GLOBAL_ROUND', nowMs: Date.now() });
  };

  const handleResetLeague = () => {
    if (!window.confirm('ATENÇÃO: Isso vai deletar toda a liga e rodadas. Continuar?')) {
      return;
    }

    dispatch({
      type: 'SET_GLOBAL_LEAGUE_STATE',
      payload: {
        recentRounds: [],
        roundIntervalMs: 3600000,
        commandWindowMs: 600000,
      },
    });
    dispatch({ type: 'SET_OLEFOOT_LEAGUE', payload: undefined as any });
  };

  const filteredFixtures = currentRound?.fixtures.filter((f) => {
    if (selectedDivision === 'all') return true;
    return f.division === selectedDivision;
  }) ?? [];

  const totalGoals = currentRound?.fixtures.reduce((sum, f) => sum + f.scoreHome + f.scoreAway, 0) ?? 0;
  const totalEvents = currentRound?.fixtures.reduce((sum, f) => sum + f.events.length, 0) ?? 0;
  const avgGoalsPerMatch = currentRound?.fixtures.length ? (totalGoals / currentRound.fixtures.length).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-black uppercase tracking-wider text-white">
            Ligas Globais
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Sistema de rodadas automáticas 24/7 com 3 divisões
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase transition-colors',
              autoRefresh
                ? 'bg-neon-green/20 text-neon-green border border-neon-green/30'
                : 'bg-white/5 text-white/60 border border-white/10'
            )}
          >
            <Activity className={cn('h-4 w-4', autoRefresh && 'animate-pulse')} />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </button>

          {!olefootLeague ? (
            <button
              onClick={handleCreateLeague}
              className="flex items-center gap-2 rounded-lg bg-neon-yellow px-4 py-2 text-xs font-black uppercase text-black hover:bg-white"
            >
              <Plus className="h-4 w-4" />
              Criar Liga
            </button>
          ) : (
            <button
              onClick={handleResetLeague}
              className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase text-red-400 hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4" />
              Reset Liga
            </button>
          )}
        </div>
      </div>

      {!olefootLeague ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-white/40 mb-4" />
          <p className="text-white/60 mb-4">Nenhuma liga criada</p>
          <button
            onClick={handleCreateLeague}
            className="inline-flex items-center gap-2 rounded-lg bg-neon-yellow px-6 py-3 font-display text-sm font-black uppercase text-black hover:bg-white"
          >
            <Plus className="h-5 w-5" />
            Criar OLEFOOT LIGA
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3 mb-2">
                <Trophy className="h-5 w-5 text-neon-yellow" />
                <span className="text-xs font-bold uppercase text-white/60">Temporada</span>
              </div>
              <p className="text-2xl font-black text-white">{olefootLeague.seasonName}</p>
              <p className="text-xs text-white/40 mt-1">
                {olefootLeague.teams.length} times · {olefootLeague.rounds.length} rodadas
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="h-5 w-5 text-neon-green" />
                <span className="text-xs font-bold uppercase text-white/60">Rodada Atual</span>
              </div>
              <p className="text-2xl font-black text-white">
                #{olefootLeague.currentRoundNumber}
              </p>
              <p className="text-xs text-white/40 mt-1">
                {currentRound?.status === 'live' && '🔴 Ao vivo'}
                {currentRound?.status === 'finished' && '✅ Finalizada'}
                {currentRound?.status === 'pre_match' && '⚡ Comandos abertos'}
                {currentRound?.status === 'scheduled' && '⏰ Agendada'}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="h-5 w-5 text-neon-yellow" />
                <span className="text-xs font-bold uppercase text-white/60">Gols/Jogo</span>
              </div>
              <p className="text-2xl font-black text-white">{avgGoalsPerMatch}</p>
              <p className="text-xs text-white/40 mt-1">
                {totalGoals} gols · {totalEvents} eventos
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="h-5 w-5 text-neon-green" />
                <span className="text-xs font-bold uppercase text-white/60">Próxima Ação</span>
              </div>
              <p className="text-2xl font-black text-white font-mono">
                {countdown.hours.toString().padStart(2, '0')}:
                {countdown.minutes.toString().padStart(2, '0')}:
                {countdown.seconds.toString().padStart(2, '0')}
              </p>
              <p className="text-xs text-white/40 mt-1">
                {currentRound?.status === 'live' && 'Até finalizar'}
                {currentRound?.status === 'finished' && 'Até próxima rodada'}
                {(currentRound?.status === 'scheduled' || currentRound?.status === 'pre_match') && 'Até kickoff'}
              </p>
            </div>
          </div>

          {currentRound && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3">
                Controles de Admin
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleForceStart}
                  disabled={currentRound.status === 'live'}
                  className="flex items-center gap-2 rounded-lg bg-neon-green/20 border border-neon-green/30 px-4 py-2 text-xs font-bold uppercase text-neon-green hover:bg-neon-green/30 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play className="h-4 w-4" />
                  Forçar Início
                </button>

                <button
                  onClick={handleForceFinish}
                  disabled={currentRound.status !== 'live'}
                  className="flex items-center gap-2 rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-2 text-xs font-bold uppercase text-red-400 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Pause className="h-4 w-4" />
                  Forçar Fim
                </button>

                <button
                  onClick={handleForceAdvance}
                  disabled={currentRound.status !== 'finished'}
                  className="flex items-center gap-2 rounded-lg bg-neon-yellow/20 border border-neon-yellow/30 px-4 py-2 text-xs font-bold uppercase text-neon-yellow hover:bg-neon-yellow/30 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <SkipForward className="h-4 w-4" />
                  Avançar Rodada
                </button>

                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-xs font-bold uppercase text-white/60 hover:bg-white/10"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              </div>
            </div>
          )}

          {currentRound && (
            <>
              <div className="flex flex-wrap gap-2">
                {['all', '1', '2', '3'].map((div) => (
                  <button
                    key={div}
                    onClick={() => setSelectedDivision(div)}
                    className={cn(
                      'rounded-lg px-4 py-2 text-xs font-bold uppercase transition-colors',
                      selectedDivision === div
                        ? 'bg-neon-yellow text-black'
                        : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                    )}
                  >
                    {div === 'all' ? 'Todas' : `Divisão ${div}`}
                  </button>
                ))}
              </div>

              {filteredFixtures.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">
                    Jogos ({filteredFixtures.length})
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence>
                      {filteredFixtures.map((fixture, index) => (
                        <FixtureCard key={fixture.id} fixture={fixture} index={index} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </>
          )}

          {olefootLeague.standings.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">
                Classificação
              </h3>

              {olefootLeague.standings.map((standing) => (
                <div key={standing.division} className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                  <div className="bg-white/5 px-4 py-2 border-b border-white/10">
                    <h4 className="text-sm font-bold text-white">
                      Divisão {standing.division}
                    </h4>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-white/40">
                          <th className="px-4 py-2 text-left">#</th>
                          <th className="px-4 py-2 text-left">Time</th>
                          <th className="px-4 py-2 text-center">J</th>
                          <th className="px-4 py-2 text-center">V</th>
                          <th className="px-4 py-2 text-center">E</th>
                          <th className="px-4 py-2 text-center">D</th>
                          <th className="px-4 py-2 text-center">GP</th>
                          <th className="px-4 py-2 text-center">GC</th>
                          <th className="px-4 py-2 text-center">SG</th>
                          <th className="px-4 py-2 text-center font-bold">PTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standing.teams.map((team, idx) => (
                          <tr
                            key={team.id}
                            className={cn(
                              'border-b border-white/5',
                              idx < 4 && 'bg-neon-green/5',
                              idx >= standing.teams.length - 4 && 'bg-red-500/5'
                            )}
                          >
                            <td className="px-4 py-2 font-mono text-white/60">{team.position}</td>
                            <td className="px-4 py-2 font-bold text-white">{team.name}</td>
                            <td className="px-4 py-2 text-center text-white/60">{team.matchesPlayed}</td>
                            <td className="px-4 py-2 text-center text-neon-green">{team.wins}</td>
                            <td className="px-4 py-2 text-center text-white/60">{team.draws}</td>
                            <td className="px-4 py-2 text-center text-red-400">{team.losses}</td>
                            <td className="px-4 py-2 text-center text-white/60">{team.goalsFor}</td>
                            <td className="px-4 py-2 text-center text-white/60">{team.goalsAgainst}</td>
                            <td className="px-4 py-2 text-center text-white/60">{team.goalDifference}</td>
                            <td className="px-4 py-2 text-center font-black text-neon-yellow">{team.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FixtureCard({ fixture, index }: { fixture: GlobalFixture; index: number }) {
  const lastEvent = fixture.events[fixture.events.length - 1];
  const hasGoal = fixture.scoreHome > 0 || fixture.scoreAway > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-neon-yellow/30 transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">
          Divisão {fixture.division}
        </span>
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-neon-green" />
          <span className="font-mono font-bold text-white text-sm">
            {fixture.currentMinute}'
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex-1 text-left min-w-0">
          <p className="font-bold text-white text-sm truncate">
            {fixture.homeTeamName}
          </p>
          <p className="text-[10px] text-white/40">
            OVR <span className="text-neon-yellow font-bold">{fixture.homeOverall}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 bg-black/40 rounded-lg border border-white/10">
          <motion.span
            key={`home-${fixture.scoreHome}`}
            initial={{ scale: hasGoal ? 1.3 : 1 }}
            animate={{ scale: 1 }}
            className="font-mono text-2xl font-black text-neon-yellow"
          >
            {fixture.scoreHome}
          </motion.span>
          <span className="text-white/40">×</span>
          <motion.span
            key={`away-${fixture.scoreAway}`}
            initial={{ scale: hasGoal ? 1.3 : 1 }}
            animate={{ scale: 1 }}
            className="font-mono text-2xl font-black text-neon-yellow"
          >
            {fixture.scoreAway}
          </motion.span>
        </div>

        <div className="flex-1 text-right min-w-0">
          <p className="font-bold text-white text-sm truncate">
            {fixture.awayTeamName}
          </p>
          <p className="text-[10px] text-white/40">
            OVR <span className="text-neon-yellow font-bold">{fixture.awayOverall}</span>
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {lastEvent && (
          <motion.div
            key={lastEvent.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="bg-black/40 rounded-lg px-3 py-2 border-l-2 border-l-neon-green"
          >
            <p className="text-[10px] text-white/80">
              <span className="font-mono font-bold text-neon-yellow">
                {lastEvent.minute}'
              </span>{' '}
              {lastEvent.text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3 flex items-center justify-center">
        {fixture.status === 'live' && (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-neon-green/20 border border-neon-green/30 text-[10px] font-bold uppercase text-neon-green">
            <Activity className="w-3 h-3 animate-pulse" />
            Ao Vivo
          </span>
        )}
        {fixture.status === 'finished' && (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/10 border border-white/20 text-[10px] font-bold uppercase text-white/60">
            <CheckCircle className="w-3 h-3" />
            Finalizado
          </span>
        )}
      </div>
    </motion.div>
  );
}
