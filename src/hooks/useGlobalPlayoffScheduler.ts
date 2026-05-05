/**
 * Hook de Auto-Progressão dos Playoffs Globais — FALLBACK LOCAL
 *
 * IMPORTANTE: Quando `VITE_OLEFOOT_API_URL` está definido, o scheduler
 * server-side (Railway) é AUTORITATIVO e este hook fica desativado.
 * O cliente apenas lê o estado via Realtime do Supabase.
 *
 * Em dev local sem API URL, esse hook age como fallback para que o ciclo
 * scheduled → live → finished → próxima rodada continue funcionando.
 */

import { useEffect, useRef } from 'react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { getNextRoundTime } from '@/match/globalRoundScheduler';
import { GLOBAL_MATCH_CONSTANTS } from '@/match/globalMatch';

const SERVER_DRIVEN = Boolean(import.meta.env.VITE_OLEFOOT_API_URL);

export function useGlobalPlayoffScheduler() {
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const dispatch = useGameDispatch();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastStartedRound = useRef<number | null>(null);

  useEffect(() => {
    // Server-side scheduler é autoritativo: cliente não toca no estado.
    if (SERVER_DRIVEN) return;
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
