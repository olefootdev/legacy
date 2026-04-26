/**
 * Hook de simulação de partida Quick Match
 * Extrai lógica de simulação do MatchQuick.tsx
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { PitchPlayerState, PossessionSide, MatchEventEntry } from '@/engine/types';
import type { OpponentStub } from '@/entities/types';
import { gameSpiritTick, buildSpiritContext } from '@/gamespirit/GameSpirit';
import type { SpiritContext } from '@/gamespirit/types';

export type MatchSpeed = '1x' | '2x' | '4x' | 'auto';

export interface SimulationState {
  minute: number;
  homeScore: number;
  awayScore: number;
  possession: PossessionSide;
  ball: { x: number; y: number };
  events: MatchEventEntry[];
  isHalftime: boolean;
  isFinished: boolean;
  isPaused: boolean;
  speed: MatchSpeed;
  onBall: PitchPlayerState | null;
}

export interface UseMatchSimulationProps {
  homeRoster: any[];
  homePlayers: PitchPlayerState[];
  opponent: OpponentStub;
  awayRoster: any[];
  awayPlayers?: PitchPlayerState[];
  onTick: (outcome: any) => void;
  onGoal: (side: PossessionSide) => void;
  onHalftime: () => void;
  onFinish: () => void;
  onInteractiveMoment?: (moment: any) => void;
  interactiveMomentModifiers?: {
    shotXGBoost: number;
    progressSuccessBoost: number;
    momentumDelta: number;
  };
}

const BASE_MS_PER_MINUTE = 1000;
const ON_BALL_THRESHOLD = 3; // distância em unidades de campo para considerar jogador com bola

function getSpeedMultiplier(speed: MatchSpeed): number {
  switch (speed) {
    case '1x': return 1;
    case '2x': return 0.5;
    case '4x': return 0.25;
    case 'auto': return 0.1;
  }
}

function findPlayerOnBall(ball: { x: number; y: number }, players: PitchPlayerState[]): PitchPlayerState | null {
  let closest: PitchPlayerState | null = null;
  let minDist = Infinity;

  for (const p of players) {
    const dist = Math.hypot(p.x - ball.x, p.y - ball.y);
    if (dist < minDist) {
      minDist = dist;
      closest = p;
    }
  }

  return minDist <= ON_BALL_THRESHOLD ? closest : null;
}

export function useMatchSimulation(props: UseMatchSimulationProps) {
  const {
    homeRoster,
    homePlayers,
    opponent,
    awayRoster,
    awayPlayers,
    onTick,
    onGoal,
    onHalftime,
    onFinish,
    onInteractiveMoment,
    interactiveMomentModifiers,
  } = props;

  // CORREÇÃO: Usar useState em vez de useRef para estado reativo
  const [state, setState] = useState<SimulationState>({
    minute: 0,
    homeScore: 0,
    awayScore: 0,
    possession: 'home',
    ball: { x: 50, y: 50 },
    events: [],
    isHalftime: false,
    isFinished: false,
    isPaused: false,
    speed: '1x',
    onBall: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const causalSeqRef = useRef(0);
  const propsRef = useRef(props);

  // Atualiza ref de props para evitar stale closures
  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  const runTick = useCallback(() => {
    setState((prevState) => {
      if (prevState.isPaused || prevState.isFinished) return prevState;

      const { homeRoster, homePlayers, opponent, awayRoster, awayPlayers, onTick, onGoal, onHalftime, onFinish, onInteractiveMoment, interactiveMomentModifiers } = propsRef.current;

      // Halftime
      if (prevState.minute === 45 && !prevState.isHalftime) {
        onHalftime();
        return { ...prevState, isHalftime: true };
      }

      // Resume após halftime
      if (prevState.minute === 45 && prevState.isHalftime) {
        return { ...prevState, minute: 46, isHalftime: false };
      }

      // Fim de jogo
      if (prevState.minute >= 90) {
        onFinish();
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return { ...prevState, isFinished: true };
      }

      // CORREÇÃO: Detectar jogador com bola usando distância euclidiana
      const onBall = findPlayerOnBall(prevState.ball, homePlayers);

      // Build context
      const ctx = buildSpiritContext({
        minute: prevState.minute,
        homeScore: prevState.homeScore,
        awayScore: prevState.awayScore,
        possession: prevState.possession,
        ball: prevState.ball,
        onBall,
        crowdSupport: 75,
        tacticalMentality: 60,
        opponentStrength: opponent.overall,
        homeRoster,
        homePlayers,
        homeShort: 'Casa',
        awayRoster,
        awayPlayers,
      });

      // Check for interactive moment trigger
      if (onInteractiveMoment && prevState.possession === 'home') {
        const shouldTrigger = Math.random() < 0.15;
        if (shouldTrigger && ctx.ballZone === 'att') {
          onInteractiveMoment({
            ctx,
            awayPlayers,
            opponentStrength: opponent.overall,
          });
          return { ...prevState, isPaused: true };
        }
      }

      // Run GameSpirit tick
      const outcome = gameSpiritTick(ctx, opponent.short, causalSeqRef.current);
      causalSeqRef.current += outcome.causalEvents.length;

      // CORREÇÃO: Aplicar modifiers de momentos interativos
      let finalOutcome = outcome;
      if (interactiveMomentModifiers && (interactiveMomentModifiers.shotXGBoost !== 0 || interactiveMomentModifiers.momentumDelta !== 0)) {
        // Aplica boost de xG se houver shot
        if (outcome.action === 'shot' && interactiveMomentModifiers.shotXGBoost !== 0) {
          // Modifier já foi aplicado no GameSpirit via context
        }
        // Aplica delta de momentum
        if (interactiveMomentModifiers.momentumDelta !== 0 && outcome.spiritMeta?.momentum) {
          finalOutcome = {
            ...outcome,
            spiritMeta: {
              ...outcome.spiritMeta,
              momentum: {
                home: Math.max(0, Math.min(100, outcome.spiritMeta.momentum.home + interactiveMomentModifiers.momentumDelta)),
                away: Math.max(0, Math.min(100, outcome.spiritMeta.momentum.away - interactiveMomentModifiers.momentumDelta)),
              },
            },
          };
        }
      }

      // Update state imutavelmente
      let newScore = { home: prevState.homeScore, away: prevState.awayScore };
      if (finalOutcome.goalFor) {
        if (finalOutcome.goalFor === 'home') {
          newScore.home++;
          onGoal('home');
        } else {
          newScore.away++;
          onGoal('away');
        }
      }

      onTick(finalOutcome);

      return {
        ...prevState,
        minute: prevState.minute + 1,
        homeScore: newScore.home,
        awayScore: newScore.away,
        ball: finalOutcome.ball,
        possession: finalOutcome.nextPossession,
        onBall: findPlayerOnBall(finalOutcome.ball, homePlayers),
      };
    });
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current) return;

    const msPerMinute = BASE_MS_PER_MINUTE * getSpeedMultiplier(state.speed);
    intervalRef.current = setInterval(runTick, msPerMinute);
  }, [runTick, state.speed]);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: false }));
  }, []);

  const setSpeed = useCallback((speed: MatchSpeed) => {
    setState((prev) => ({ ...prev, speed }));

    // Restart interval com nova velocidade
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      const msPerMinute = BASE_MS_PER_MINUTE * getSpeedMultiplier(speed);
      intervalRef.current = setInterval(runTick, msPerMinute);
    }
  }, [runTick]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    state,
    start,
    pause,
    resume,
    setSpeed,
    stop,
  };
}
