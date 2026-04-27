/**
 * Exemplo de integração completa no MatchQuick.tsx
 * Demonstra uso de todos os novos hooks e sistemas
 */

import { useState, useEffect, useCallback } from 'react';
import { useMatchSimulation } from '@/hooks/useMatchSimulation';
import { useInteractiveMoments } from '@/hooks/useInteractiveMoments';
import { useMatchSounds } from '@/hooks/useMatchSounds';
import { QuickMatchSpeedControl } from '@/components/matchquick/QuickMatchSpeedControl';
import { QuickInteractiveMomentOverlay } from '@/components/matchquick/QuickInteractiveMomentOverlay';
import { MatchReplayManager, type MatchReplayData } from '@/match/replaySystem';
import { PlayerProgressionManager, calculateMatchXP } from '@/progression/playerProgression';
import type { PitchPlayerState } from '@/engine/types';
import type { OpponentStub } from '@/entities/types';

interface MatchQuickIntegratedProps {
  homeRoster: any[];
  homePlayers: PitchPlayerState[];
  opponent: OpponentStub;
  awayRoster: any[];
  awayPlayers?: PitchPlayerState[];
}

export function MatchQuickIntegrated(props: MatchQuickIntegratedProps) {
  const { homeRoster, homePlayers, opponent, awayRoster, awayPlayers } = props;

  // Estados
  const [events, setEvents] = useState<any[]>([]);
  const [causalLog, setCausalLog] = useState<any[]>([]);
  const [playerStats, setPlayerStats] = useState<Record<string, any>>({});

  // Hooks
  const sounds = useMatchSounds({ volume: 0.7, enabled: true });
  const {
    currentMoment,
    modifiers,
    checkTrigger,
    handleChoice,
    clearModifiers,
  } = useInteractiveMoments();

  const simulation = useMatchSimulation({
    homeRoster,
    homePlayers,
    opponent,
    awayRoster,
    awayPlayers,
    onTick: (outcome) => {
      // Adiciona evento ao feed
      setEvents((prev) => [...prev, {
        id: `event-${Date.now()}`,
        minute: outcome.minute || 0,
        text: outcome.narrative,
        type: outcome.action,
      }]);

      // Acumula log causal
      setCausalLog((prev) => [...prev, ...outcome.causalEvents]);

      // Atualiza estatísticas dos jogadores
      if (outcome.statDeltas) {
        setPlayerStats((prev) => ({
          ...prev,
          [outcome.statDeltas.playerId]: {
            ...prev[outcome.statDeltas.playerId],
            ...outcome.statDeltas,
          },
        }));
      }

      // Toca sons baseado no outcome
      if (outcome.goalFor) {
        sounds.playGoal(outcome.goalFor);
      } else if (outcome.action === 'shot') {
        const shotOutcome = outcome.causalEvents.find((e: any) => e.type === 'shot_result');
        if (shotOutcome) {
          const result = (shotOutcome.payload as any)?.outcome;
          if (result === 'save') sounds.playShot('save');
          else if (result === 'blocked') sounds.playShot('blocked');
          else if (result === 'wide') sounds.playShot('wide');
        }
      }

      // Detecta eventos especiais
      const specialEvent = outcome.causalEvents.find((e: any) =>
        e.type === 'special_event'
      );
      if (specialEvent) {
        const eventType = (specialEvent.payload as any)?.eventType;
        if (eventType) {
          sounds.playSpecialEvent(eventType);
        }
      }

      // Checa trigger de momento interativo
      if (!currentMoment && outcome.possession === 'home') {
        const ballZone = outcome.ball.x < 38 ? 'def' : outcome.ball.x < 68 ? 'mid' : 'att';
        const moment = checkTrigger({
          ballZone,
          onBall: outcome.onBall,
          nearbyOpponentDist: 10,
          minute: outcome.minute || 0,
          homeScore: simulation.state.homeScore,
          awayScore: simulation.state.awayScore,
          homePlayers,
          awayPlayers,
          opponentStrength: opponent.overall,
        });

        if (moment) {
          simulation.pause();
          sounds.playInteractiveMoment();
        }
      }

      // Limpa modifiers após aplicar
      if (modifiers.shotXGBoost !== 0 || modifiers.momentumDelta !== 0) {
        clearModifiers();
      }
    },
    onGoal: (side) => {
      sounds.playGoal(side);
      sounds.playCrowdReaction(side === 'home');
    },
    onHalftime: () => {
      sounds.play('halftime');
      simulation.pause();
    },
    onFinish: () => {
      sounds.play('fulltime');
      handleMatchEnd();
    },
    onInteractiveMoment: (ctx) => {
      // Momento interativo disparado
      simulation.pause();
    },
    interactiveMomentModifiers: modifiers,
  });

  // Handler de escolha em momento interativo
  const onInteractiveChoice = useCallback((choiceAction: string | null) => {
    handleChoice(choiceAction);

    // Toca som de sucesso/falha
    const success = Math.random() < 0.6; // Simplificado
    sounds.playInteractiveChoice(success);

    // Resume simulação
    setTimeout(() => {
      simulation.resume();
    }, 1000);
  }, [handleChoice, sounds, simulation]);

  // Fim de partida: salva replay e atualiza progressão
  const handleMatchEnd = useCallback(() => {
    const finalScore = {
      home: simulation.state.homeScore,
      away: simulation.state.awayScore,
    };

    // Salva replay
    const replayData: MatchReplayData = {
      id: `replay-${Date.now()}`,
      timestamp: Date.now(),
      homeTeam: 'Casa',
      awayTeam: opponent.short,
      finalScore,
      duration: 90,
      events: causalLog,
      metadata: {
        homeRoster,
        awayRoster,
        formation: '4-3-3',
      },
    };
    MatchReplayManager.saveReplay(replayData);

    // Atualiza progressão dos jogadores
    const won = finalScore.home > finalScore.away;
    const draw = finalScore.home === finalScore.away;

    homePlayers.forEach((player) => {
      const stats = playerStats[player.playerId] || {};
      const xp = calculateMatchXP({
        minutesPlayed: 90,
        goals: stats.goals || 0,
        assists: stats.assists || 0,
        shots: stats.shots || 0,
        passes: stats.passesOk || 0,
        tackles: stats.tackles || 0,
        won,
        draw,
      });

      PlayerProgressionManager.recordMatchStats(player.playerId, {
        goals: stats.goals || 0,
        assists: stats.assists || 0,
        xp,
      });
    });

    console.log('Match ended. Replay saved. Player progression updated.');
  }, [simulation.state, opponent, causalLog, homeRoster, awayRoster, homePlayers, playerStats]);

  // Inicia simulação ao montar
  useEffect(() => {
    simulation.start();
    return () => {
      simulation.stop();
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-gray-900 to-black">
      {/* Controle de velocidade */}
      <div className="absolute top-4 right-4 z-50">
        <QuickMatchSpeedControl
          speed={simulation.state.speed}
          isPaused={simulation.state.isPaused}
          onSpeedChange={simulation.setSpeed}
          onPauseToggle={() =>
            simulation.state.isPaused ? simulation.resume() : simulation.pause()
          }
        />
      </div>

      {/* Placar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-6 py-3 border border-white/20">
          <div className="flex items-center gap-4 text-white">
            <span className="font-bold text-2xl">{simulation.state.homeScore}</span>
            <span className="text-sm text-white/60">vs</span>
            <span className="font-bold text-2xl">{simulation.state.awayScore}</span>
          </div>
          <div className="text-center text-xs text-white/60 mt-1">
            {simulation.state.minute}'
          </div>
        </div>
      </div>

      {/* Feed de eventos */}
      <div className="absolute bottom-20 left-4 right-4 z-30">
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-4 max-h-40 overflow-y-auto">
          {events.slice(-5).map((event) => (
            <div key={event.id} className="text-white/90 text-sm mb-2">
              <span className="text-yellow-400 font-bold">{event.minute}'</span> {event.text}
            </div>
          ))}
        </div>
      </div>

      {/* Overlay de momento interativo */}
      {currentMoment && (
        <QuickInteractiveMomentOverlay
          moment={currentMoment}
          onChoice={onInteractiveChoice}
        />
      )}

      {/* Halftime */}
      {simulation.state.isHalftime && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-white mb-4">Intervalo</h2>
            <button
              onClick={() => simulation.resume()}
              className="px-6 py-3 bg-yellow-400 text-black font-bold rounded-lg hover:bg-yellow-300"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Fim de jogo */}
      {simulation.state.isFinished && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-white mb-4">Fim de Jogo</h2>
            <div className="text-6xl font-bold text-yellow-400 mb-8">
              {simulation.state.homeScore} - {simulation.state.awayScore}
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-yellow-400 text-black font-bold rounded-lg hover:bg-yellow-300"
              >
                Nova Partida
              </button>
              <button
                onClick={() => {
                  const replays = MatchReplayManager.getAllReplays();
                  if (replays.length > 0) {
                    console.log('Replay disponível:', replays[0]);
                  }
                }}
                className="px-6 py-3 bg-white/20 text-white font-bold rounded-lg hover:bg-white/30"
              >
                Ver Replay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
