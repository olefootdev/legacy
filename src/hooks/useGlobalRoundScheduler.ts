/**
 * Hook de Auto-Progressão de Rodadas Globais
 *
 * Roda em background e gerencia o ciclo de vida das rodadas:
 * - Cria rodadas automaticamente a cada 1 hora
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
  canGiveCommands,
} from '@/match/globalRoundScheduler';
import { simulateGlobalRound } from '@/match/globalMatchSimulator';
import { createOlefootLeague } from '@/match/olefootLeague';
import {
  generatePreMatchRequest,
  createPreMatchAction,
  generatePostMatchReport,
} from '@/coach/globalMatchIntegration';
import { CoachConversationEngine } from '@/coach/coachConversation';

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
  const preMatchRequestSentRef = useRef<Set<number>>(new Set());
  const postMatchReportSentRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    // DESABILITADO: Não criar mais OLEFOOT LIGA mockada
    // A liga agora é gerenciada pelo Global League MVP
    if (!olefootLeague) {
      // Não fazer nada - aguardar cadastro manual na Liga Global MVP
      return;
    }

    // Tick a cada 1 segundo para verificar estado das rodadas
    intervalRef.current = setInterval(() => {
      const nowMs = Date.now();

      // 1. Criar primeira rodada se não existir
      if (!globalLeague?.currentRound) {
        const nextKickoffMs = getNextRoundTime(nowMs);

        dispatch({
          type: 'CREATE_GLOBAL_ROUND',
          scheduledKickoffMs: nextKickoffMs,
        });
        return;
      }

      const currentRound = globalLeague.currentRound;

      // 2. Iniciar rodada (pre_match ou live)
      if (shouldStartRound(currentRound, nowMs)) {
        const commandWindowStart =
          currentRound.scheduledKickoffMs - SCHEDULER_CONFIG.COMMAND_WINDOW_MS;

        // Entrar em pre_match (janela de comandos)
        if (nowMs >= commandWindowStart && nowMs < currentRound.scheduledKickoffMs) {
          if (currentRound.status === 'scheduled') {
            dispatch({
              type: 'START_COMMAND_WINDOW',
            });

            // Coach pede orientações (apenas uma vez por rodada)
            if (coach && !preMatchRequestSentRef.current.has(currentRound.roundNumber)) {
              const conversationEngine = new CoachConversationEngine(coach, gameState);
              const teamContext = conversationEngine.buildTeamContext();
              const request = generatePreMatchRequest(coach, currentRound, teamContext, gameState);

              if (request) {
                const action = createPreMatchAction(coach, request);
                dispatch({ type: 'COACH_ADD_PENDING_ACTION', action });
                preMatchRequestSentRef.current.add(currentRound.roundNumber);
              }
            }
          }
        }

        // Kickoff (iniciar partidas)
        if (nowMs >= currentRound.scheduledKickoffMs && currentRound.status !== 'live') {
          dispatch({
            type: 'START_GLOBAL_ROUND',
          });
        }
      }

      // 3. Atualizar rodada ao vivo (revelar eventos)
      if (currentRound.status === 'live' && currentRound.actualKickoffMs) {
        const elapsed = nowMs - currentRound.actualKickoffMs;

        // Atualizar a cada 500ms durante a rodada
        if (elapsed < SCHEDULER_CONFIG.ROUND_DURATION_MS) {
          dispatch({
            type: 'UPDATE_LIVE_ROUND',
            nowMs,
          });
        }
      }

      // 4. Finalizar rodada
      if (shouldFinishRound(currentRound, nowMs)) {
        dispatch({
          type: 'FINISH_GLOBAL_ROUND',
          nowMs,
        });

        // Coach envia relatório pós-jogo (apenas uma vez por rodada)
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

            // Adiciona relatório como mensagem do coach
            const reportMessage = `${report.analysis}\n\n**Sugestões:**\n${report.suggestions.map(s => `• ${s}`).join('\n')}`;

            dispatch({
              type: 'COACH_ADD_MESSAGE',
              message: {
                role: 'assistant',
                content: reportMessage,
                timestamp: Date.now(),
              },
            });

            postMatchReportSentRef.current.add(currentRound.roundNumber);
          }
        }
      }

      // 5. Avançar para próxima rodada (após 1 hora)
      if (currentRound.status === 'finished' && currentRound.finishedAtMs) {
        const timeSinceFinish = nowMs - currentRound.finishedAtMs;

        if (timeSinceFinish >= SCHEDULER_CONFIG.ROUND_INTERVAL_MS) {
          dispatch({
            type: 'ADVANCE_GLOBAL_ROUND',
            nowMs,
          });
        }
      }
    }, 1000); // Tick a cada 1 segundo

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
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
    return {
      timeLeft: 0,
      formatted: '00:00:00',
      status: 'waiting' as const,
    };
  }

  const nowMs = Date.now();

  // Rodada ao vivo
  if (currentRound.status === 'live' && currentRound.actualKickoffMs) {
    const elapsed = nowMs - currentRound.actualKickoffMs;
    const remaining = Math.max(0, SCHEDULER_CONFIG.ROUND_DURATION_MS - elapsed);

    return {
      timeLeft: remaining,
      formatted: formatMs(remaining),
      status: 'live' as const,
    };
  }

  // Janela de comandos
  if (currentRound.status === 'pre_match') {
    const remaining = Math.max(0, currentRound.scheduledKickoffMs - nowMs);

    return {
      timeLeft: remaining,
      formatted: formatMs(remaining),
      status: 'pre_match' as const,
    };
  }

  // Aguardando próxima rodada
  if (currentRound.status === 'finished' && currentRound.finishedAtMs) {
    const nextRoundMs = currentRound.finishedAtMs + SCHEDULER_CONFIG.ROUND_INTERVAL_MS;
    const remaining = Math.max(0, nextRoundMs - nowMs);

    return {
      timeLeft: remaining,
      formatted: formatMs(remaining),
      status: 'waiting' as const,
    };
  }

  // Rodada agendada
  const remaining = Math.max(0, currentRound.scheduledKickoffMs - nowMs);

  return {
    timeLeft: remaining,
    formatted: formatMs(remaining),
    status: 'scheduled' as const,
  };
}

/**
 * Formata milissegundos em HH:MM:SS
 */
function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
