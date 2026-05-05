/**
 * Hook de Auto-Progressão dos Playoffs Globais
 *
 * Kickoffs sempre no topo de 5 minutos exatos do relógio (15:00, 15:05, 15:10...)
 * Ciclo: scheduled → live (1min real) → finished → próxima rodada no próximo topo de 5min
 */

import { useEffect, useRef } from 'react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { getNextRoundTime } from '@/match/globalRoundScheduler';
import { GLOBAL_MATCH_CONSTANTS } from '@/match/globalMatch';

export function useGlobalPlayoffScheduler() {
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const dispatch = useGameDispatch();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastStartedRound = useRef<number | null>(null);

  useEffect(() => {
    if (!globalLeagueMVP || globalLeagueMVP.status !== 'playoffs') return;

    intervalRef.current = setInterval(() => {
      const nowMs = Date.now();
      const roundNumber = globalLeagueMVP.currentPlayoffRound;
      if (!roundNumber) return;

      const round = globalLeagueMVP.playoffRounds.find(r => r.roundNumber === roundNumber);
      if (!round) return;

      // 1. Iniciar rodada agendada no kickoff
      if (round.status === 'scheduled' && nowMs >= round.scheduledKickoffMs) {
        if (lastStartedRound.current !== roundNumber) {
          lastStartedRound.current = roundNumber;
          dispatch({ type: 'START_GLOBAL_PLAYOFF_ROUND', roundNumber });
        }
        return;
      }

      // 2. Atualizar placar ao vivo progressivamente
      if (round.status === 'live' && round.actualKickoffMs) {
        const elapsed = nowMs - round.actualKickoffMs;
        if (elapsed < GLOBAL_MATCH_CONSTANTS.ROUND_DURATION_MS) {
          dispatch({ type: 'UPDATE_GLOBAL_PLAYOFF_LIVE', nowMs });
          return;
        }
        // 3. Rodada terminou — finalizar
        dispatch({
          type: 'FINISH_GLOBAL_PLAYOFF_ROUND',
          roundNumber,
          finishedFixtures: round.fixtures,
        });
      }

      // 4. Rodada finalizada — agendar próxima no próximo topo de 5min do relógio
      if (round.status === 'finished') {
        const nextRoundNumber = roundNumber + 1;
        const nextRound = globalLeagueMVP.playoffRounds.find(r => r.roundNumber === nextRoundNumber);
        if (nextRound && nextRound.status === 'scheduled') {
          const nextKickoffMs = getNextRoundTime(nowMs);
          // Só reagenda se o kickoff atual já passou ou está desatualizado
          if (nextRound.scheduledKickoffMs <= nowMs + 5000) {
            dispatch({
              type: 'RESCHEDULE_PLAYOFF_ROUND',
              roundNumber: nextRoundNumber,
              scheduledKickoffMs: nextKickoffMs,
            });
          }
        }
      }
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [globalLeagueMVP, dispatch]);
}
