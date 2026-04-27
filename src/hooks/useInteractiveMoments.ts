/**
 * Hook para gerenciar momentos interativos durante Quick Match
 * Pausa simulação, captura escolha do jogador, afeta pesos do GameSpirit
 */

import { useState, useCallback, useRef } from 'react';
import type { PitchPlayerState } from '@/engine/types';
import type { InteractiveMoment } from '@/match/interactiveMoments';
import {
  shouldTriggerInteractiveMoment,
  createDuel1v1Moment,
  createOneOnOneMoment,
  createFreeKickMoment,
} from '@/match/interactiveMoments';

export interface InteractiveMomentModifiers {
  shotXGBoost: number;
  progressSuccessBoost: number;
  momentumDelta: number;
}

export function useInteractiveMoments() {
  const [currentMoment, setCurrentMoment] = useState<InteractiveMoment | null>(null);
  const [modifiers, setModifiers] = useState<InteractiveMomentModifiers>({
    shotXGBoost: 0,
    progressSuccessBoost: 0,
    momentumDelta: 0,
  });
  const lastMomentMinuteRef = useRef(-10);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkTrigger = useCallback(
    (ctx: {
      ballZone: 'def' | 'mid' | 'att';
      onBall?: PitchPlayerState;
      nearbyOpponentDist: number;
      minute: number;
      homeScore: number;
      awayScore: number;
      homePlayers?: PitchPlayerState[];
      awayPlayers?: PitchPlayerState[];
      opponentStrength: number;
    }): InteractiveMoment | null => {
      // Cooldown entre momentos
      if (ctx.minute - lastMomentMinuteRef.current < 3) return null;

      const momentType = shouldTriggerInteractiveMoment(ctx, lastMomentMinuteRef.current);
      if (!momentType) return null;

      let moment: InteractiveMoment | null = null;

      if (momentType === 'duel_1v1' && ctx.onBall && ctx.awayPlayers && ctx.awayPlayers.length > 0) {
        // Pega defensor mais próximo
        const defender = ctx.awayPlayers
          .map((p) => ({
            p,
            dist: Math.hypot(p.x - ctx.onBall!.x, p.y - ctx.onBall!.y),
          }))
          .sort((a, b) => a.dist - b.dist)[0]?.p;

        if (defender) {
          moment = createDuel1v1Moment(ctx.onBall, defender, ctx.minute);
        }
      } else if (momentType === 'one_on_one' && ctx.onBall) {
        moment = createOneOnOneMoment(ctx.onBall, ctx.opponentStrength, ctx.minute);
      } else if (momentType === 'free_kick_dangerous' && ctx.homePlayers && ctx.homePlayers.length > 0) {
        const takers = [...ctx.homePlayers]
          .filter((p) => p.role === 'attack' || p.role === 'mid')
          .sort((a, b) => (b.attributes?.finalizacao ?? 0) - (a.attributes?.finalizacao ?? 0))
          .slice(0, 3);

        if (takers.length >= 1) {
          const distance = 20 + Math.random() * 8;
          const angle = (Math.random() - 0.5) * 30;
          moment = createFreeKickMoment(takers, distance, angle, ctx.minute);
        }
      }

      if (moment) {
        lastMomentMinuteRef.current = ctx.minute;
        setCurrentMoment(moment);

        // Auto-resolve após timeout
        timeoutRef.current = setTimeout(() => {
          handleChoice(null);
        }, moment.timeWindowMs);
      }

      return moment;
    },
    [],
  );

  const handleChoice = useCallback((choiceAction: string | null) => {
    if (!currentMoment) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const choice = currentMoment.options.find((o) => o.action === choiceAction);

    if (!choice) {
      // Timeout ou escolha inválida - usa primeira opção com penalidade
      const fallback = currentMoment.options[0]!;
      setModifiers({
        shotXGBoost: fallback.xG * 0.5,
        progressSuccessBoost: 0,
        momentumDelta: -5,
      });
      setCurrentMoment(null);
      return;
    }

    // Sucesso baseado em probabilidade
    const success = Math.random() < choice.xG;

    setModifiers({
      shotXGBoost: success ? choice.xG * 1.5 : choice.xG * 0.3,
      progressSuccessBoost: success ? 0.2 : -0.1,
      momentumDelta: success ? 15 : -8,
    });

    setCurrentMoment(null);
  }, [currentMoment]);

  const clearModifiers = useCallback(() => {
    setModifiers({
      shotXGBoost: 0,
      progressSuccessBoost: 0,
      momentumDelta: 0,
    });
  }, []);

  return {
    currentMoment,
    modifiers,
    checkTrigger,
    handleChoice,
    clearModifiers,
  };
}
