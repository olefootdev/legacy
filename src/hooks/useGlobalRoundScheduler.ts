/**
 * Hook de Auto-Progressão de Rodadas Globais
 *
 * Roda em background e gerencia o ciclo de vida das rodadas:
 * - Cria rodadas automaticamente a cada 5min dentro dos slots ativos
 * - Inicia rodadas no horário agendado
 * - Simula partidas (treinador IA assume se manager offline)
 * - Finaliza rodadas e atualiza tabela
 * - Avança para próxima rodada
 */

import { useEffect, useRef } from 'react';
import { useGameStore, useGameDispatch } from '@/game/store';
import {
  shouldCreateNewRound,
  shouldStartRound,
  shouldFinishRound,
  autoAdvanceRound,
  getNextRoundTime,
  SCHEDULER_CONFIG,
  isGlobalActive,
} from '@/match/globalRoundScheduler';
import { simulateGlobalRound } from '@/match/globalMatchSimulator';
import { createOlefootLeague } from '@/match/olefootLeague';
import {
  generatePreMatchRequest,
  createPreMatchAction,
  generatePostMatchReport,
} from '@/coach/globalMatchIntegration';
import { CoachConversationEngine } from '@/coach/coachConversation';

// Quando VITE_OLEFOOT_API_URL está definido, a Edge Function do Supabase é
// autoritativa. Este hook só atua como fallback em dev local sem API URL.
const SERVER_DRIVEN = Boolean(import.meta.env.VITE_OLEFOOT_API_URL);

/**
 * Hook principal do scheduler
 * Deve ser montado no App.tsx para rodar globalmente
 */
export function useGlobalRoundScheduler() {
  const globalLeague = useGameStore((s) => s.globalLeague);
  const olefootLeague = useGameStore((s) => s.olefootLeague);
  const gameState = useGameStore((s) => s);
  const coach = useGameStore((s) => s.manager.coach);
  const dispatch = useGameDispatch();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const postMatchReportSentRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    // Edge Function é autoritativa em produção e dev com API URL configurada.
    if (SERVER_DRIVEN) return;
    if (!olefootLeague) return;

    // Tick a cada 1 segundo para verificar estado das rodadas
    intervalRef.current = setInterval(() => {
      const nowMs = Date.now();

      // Fora dos slots ativos: não criar nem avançar rodadas do match/global
      if (!isGlobalActive(nowMs)) return;

      // 1. Criar primeira rodada se não existir
      if (!globalLeague?.currentRound) {
        const nextKickoffMs = getNextRoundTime(nowMs);
        dispatch({ type: 'CREATE_GLOBAL_ROUND', scheduledKickoffMs: nextKickoffMs });
        return;
      }

      const currentRound = globalLeague.currentRound;

      // 2. Iniciar rodada no kickoff
      if (shouldStartRound(currentRound, nowMs) && currentRound.status !== 'live') {
        dispatch({ type: 'START_GLOBAL_ROUND' });
      }

      // 3. Atualizar rodada ao vivo
      if (currentRound.status === 'live' && currentRound.actualKickoffMs) {
        const elapsed = nowMs - currentRound.actualKickoffMs;
        if (elapsed < SCHEDULER_CONFIG.ROUND_DURATION_MS) {
          dispatch({ type: 'UPDATE_LIVE_ROUND', nowMs });
        }
      }

      // 4. Finalizar rodada
      if (shouldFinishRound(currentRound, nowMs)) {
        dispatch({ type: 'FINISH_GLOBAL_ROUND', nowMs });

        if (coach && !postMatchReportSentRef.current.has(currentRound.roundNumber)) {
          const clubId = gameState.club.id;
          const fixture = currentRound.fixtures.find(
            f => f.homeTeamId === clubId || f.awayTeamId === clubId
          );

          if (fixture) {
            const conversationEngine = new CoachConversationEngine(coach, gameState);
            const teamContext = conversationEngine.buildTeamContext();
            const isHome = fixture.homeTeamId === clubId;
            const report = generatePostMatchReport(coach, fixture, isHome, teamContext);
            const reportMessage = `${report.analysis}\n\n**Sugestões:**\n${report.suggestions.map(s => `• ${s}`).join('\n')}`;

            dispatch({
              type: 'COACH_ADD_MESSAGE',
              message: { role: 'assistant', content: reportMessage, timestamp: Date.now() },
            });

            postMatchReportSentRef.current.add(currentRound.roundNumber);
          }
        }
      }

      // 5. Avançar para próxima rodada (após intervalo de 5min)
      if (currentRound.status === 'finished' && currentRound.finishedAtMs) {
        const timeSinceFinish = nowMs - currentRound.finishedAtMs;
        if (timeSinceFinish >= SCHEDULER_CONFIG.ROUND_INTERVAL_MS) {
          dispatch({ type: 'ADVANCE_GLOBAL_ROUND', nowMs });
        }
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [globalLeague, olefootLeague, dispatch]);
}

/**
 * Hook para exibir countdown até próxima rodada
 */
export function useRoundCountdown() {
  const globalLeague = useGameStore((s) => s.globalLeague);
  const currentRound = globalLeague?.currentRound;

  if (!currentRound) {
    return { timeLeft: 0, formatted: '00:00:00', status: 'waiting' as const };
  }

  const nowMs = Date.now();

  if (currentRound.status === 'live' && currentRound.actualKickoffMs) {
    const elapsed = nowMs - currentRound.actualKickoffMs;
    const remaining = Math.max(0, SCHEDULER_CONFIG.ROUND_DURATION_MS - elapsed);
    return { timeLeft: remaining, formatted: formatMs(remaining), status: 'live' as const };
  }

  if (currentRound.status === 'finished' && currentRound.finishedAtMs) {
    const nextRoundMs = currentRound.finishedAtMs + SCHEDULER_CONFIG.ROUND_INTERVAL_MS;
    const remaining = Math.max(0, nextRoundMs - nowMs);
    return { timeLeft: remaining, formatted: formatMs(remaining), status: 'waiting' as const };
  }

  const remaining = Math.max(0, currentRound.scheduledKickoffMs - nowMs);
  return { timeLeft: remaining, formatted: formatMs(remaining), status: 'scheduled' as const };
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

