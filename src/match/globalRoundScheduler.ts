/**
 * Global Round Scheduler — Sistema 24/7 de Rodadas Automáticas
 *
 * Cria e executa rodadas a cada 1 hora, sem pausa, 24 horas por dia.
 * Funciona mesmo com o manager offline (treinador IA assume).
 */

import type { GlobalRound, GlobalLeagueState, GlobalFixture } from './globalMatch';
import {
  newGlobalRoundId,
  GLOBAL_MATCH_CONSTANTS,
  createEmptyGlobalLeagueState,
} from './globalMatch';
import type { OlefootLeagueState } from './olefootLeague';
import { generateAllRounds } from './olefootLeague';

/** Status do scheduler */
export interface SchedulerState {
  isRunning: boolean;
  nextRoundMs: number;
  lastRoundMs?: number;
  roundsToday: number;
  lastResetDate: string; // YYYY-MM-DD
}

/** Configuração do scheduler */
export const SCHEDULER_CONFIG = {
  /** Intervalo entre rodadas (1 hora) */
  ROUND_INTERVAL_MS: 60 * 60 * 1000,

  /** Duração da rodada (1 minuto) */
  ROUND_DURATION_MS: 1 * 60 * 1000,

  /** Janela de comandos antes do kickoff (10 minutos) */
  COMMAND_WINDOW_MS: 10 * 60 * 1000,

  /** Máximo de rodadas por dia (24 = 1/hora) */
  MAX_ROUNDS_PER_DAY: 24,

  /** Hora de reset diário (UTC) */
  DAILY_RESET_HOUR: 6, // 6h UTC = 3h BRT
} as const;

/**
 * Calcula o próximo horário de rodada (sempre no topo da hora)
 */
export function getNextRoundTime(nowMs: number): number {
  const now = new Date(nowMs);
  const nextHour = new Date(now);

  // Próxima hora cheia (00 minutos)
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);

  return nextHour.getTime();
}

/**
 * Verifica se é hora de criar uma nova rodada
 */
export function shouldCreateNewRound(
  globalLeague: GlobalLeagueState | undefined,
  nowMs: number,
): boolean {
  if (!globalLeague) return false;

  const currentRound = globalLeague.currentRound;

  // Sem rodada atual → criar primeira
  if (!currentRound) return true;

  // Rodada atual ainda não terminou
  if (currentRound.status === 'live' || currentRound.status === 'pre_match') {
    return false;
  }

  // Rodada terminou → verificar se passou 1 hora
  if (currentRound.status === 'finished' && currentRound.finishedAtMs) {
    const timeSinceFinish = nowMs - currentRound.finishedAtMs;
    return timeSinceFinish >= SCHEDULER_CONFIG.ROUND_INTERVAL_MS;
  }

  // Rodada agendada → verificar se chegou a hora
  if (currentRound.status === 'scheduled') {
    return nowMs >= currentRound.scheduledKickoffMs;
  }

  return false;
}

/**
 * Cria uma nova rodada agendada
 */
export function createScheduledRound(
  olefootLeague: OlefootLeagueState,
  scheduledKickoffMs: number,
): GlobalRound {
  const currentRoundNumber = olefootLeague.currentRoundNumber;
  const roundData = olefootLeague.rounds[currentRoundNumber - 1];

  if (!roundData) {
    throw new Error(`Rodada ${currentRoundNumber} não encontrada na OLEFOOT LIGA`);
  }

  return {
    id: newGlobalRoundId(),
    roundNumber: currentRoundNumber,
    status: 'scheduled',
    scheduledKickoffMs,
    fixtures: roundData.fixtures.map(f => ({
      ...f,
      status: 'scheduled' as const,
      currentMinute: 0,
      scoreHome: 0,
      scoreAway: 0,
      events: [],
    })),
    highlights: [],
    durationMs: SCHEDULER_CONFIG.ROUND_DURATION_MS,
  };
}

/**
 * Avança para a próxima rodada automaticamente
 */
export function autoAdvanceRound(
  globalLeague: GlobalLeagueState,
  olefootLeague: OlefootLeagueState,
  nowMs: number,
): {
  globalLeague: GlobalLeagueState;
  olefootLeague: OlefootLeagueState;
} {
  const currentRound = globalLeague.currentRound;

  // Mover rodada atual para histórico
  const recentRounds = currentRound
    ? [currentRound, ...globalLeague.recentRounds].slice(0, 5)
    : globalLeague.recentRounds;

  // Calcular próximo horário (sempre no topo da hora)
  const nextKickoffMs = getNextRoundTime(nowMs);

  // Avançar número da rodada na OLEFOOT LIGA
  const nextRoundNumber = olefootLeague.currentRoundNumber + 1;

  // Verificar se a temporada terminou
  if (nextRoundNumber > 18) {
    // TODO: Criar nova temporada
    return {
      globalLeague: {
        ...globalLeague,
        currentRound: undefined,
        recentRounds,
        nextScheduledMs: undefined,
      },
      olefootLeague,
    };
  }

  // Criar nova rodada
  const newRound = createScheduledRound(
    { ...olefootLeague, currentRoundNumber: nextRoundNumber },
    nextKickoffMs,
  );

  return {
    globalLeague: {
      ...globalLeague,
      currentRound: newRound,
      recentRounds,
      nextScheduledMs: nextKickoffMs,
    },
    olefootLeague: {
      ...olefootLeague,
      currentRoundNumber: nextRoundNumber,
    },
  };
}

/**
 * Verifica se a rodada deve iniciar (janela de comandos ou kickoff)
 */
export function shouldStartRound(round: GlobalRound, nowMs: number): boolean {
  if (round.status !== 'scheduled') return false;

  // Abrir janela de comandos 10min antes
  const commandWindowStart = round.scheduledKickoffMs - SCHEDULER_CONFIG.COMMAND_WINDOW_MS;

  if (nowMs >= commandWindowStart && nowMs < round.scheduledKickoffMs) {
    return true; // Entrar em pre_match
  }

  // Kickoff
  if (nowMs >= round.scheduledKickoffMs) {
    return true; // Entrar em live
  }

  return false;
}

/**
 * Verifica se a rodada deve terminar
 */
export function shouldFinishRound(round: GlobalRound, nowMs: number): boolean {
  if (round.status !== 'live' || !round.actualKickoffMs) return false;

  const elapsed = nowMs - round.actualKickoffMs;
  return elapsed >= round.durationMs;
}

/**
 * Inicializa o scheduler state
 */
export function createInitialSchedulerState(): SchedulerState {
  const now = new Date();
  const nextRound = getNextRoundTime(Date.now());

  return {
    isRunning: false,
    nextRoundMs: nextRound,
    roundsToday: 0,
    lastResetDate: now.toISOString().split('T')[0]!,
  };
}

/**
 * Reseta contador diário de rodadas
 */
export function maybeResetDailyCounter(
  scheduler: SchedulerState,
  nowMs: number,
): SchedulerState {
  const now = new Date(nowMs);
  const today = now.toISOString().split('T')[0]!;

  if (scheduler.lastResetDate !== today) {
    return {
      ...scheduler,
      roundsToday: 0,
      lastResetDate: today,
    };
  }

  return scheduler;
}

/**
 * Formata timestamp para exibição (hora local)
 */
export function formatRoundTime(timestampMs: number): string {
  const date = new Date(timestampMs);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Calcula tempo restante até a próxima rodada
 */
export function getTimeUntilNextRound(nextRoundMs: number, nowMs: number): {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
} {
  const diff = Math.max(0, nextRoundMs - nowMs);
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { hours, minutes, seconds, totalSeconds };
}

/**
 * Verifica se o manager pode dar comandos agora
 */
export function canGiveCommands(round: GlobalRound, nowMs: number): boolean {
  if (round.status !== 'pre_match' && round.status !== 'scheduled') return false;

  const commandWindowStart = round.scheduledKickoffMs - SCHEDULER_CONFIG.COMMAND_WINDOW_MS;
  return nowMs >= commandWindowStart && nowMs < round.scheduledKickoffMs;
}

/**
 * Calcula tempo restante da janela de comandos
 */
export function getCommandWindowTimeLeft(round: GlobalRound, nowMs: number): number {
  if (!canGiveCommands(round, nowMs)) return 0;
  return Math.max(0, round.scheduledKickoffMs - nowMs);
}
