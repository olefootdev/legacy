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
  /** Intervalo entre rodadas dentro de um slot ativo (5 minutos) */
  ROUND_INTERVAL_MS: 5 * 60 * 1000,

  /** Duração da rodada (1 minuto) */
  ROUND_DURATION_MS: 1 * 60 * 1000,

  /** Duração da janela de comando entre slots (30 minutos) */
  COMMAND_WINDOW_MS: 30 * 60 * 1000,

  /** Máximo de rodadas por dia (~150 = 5 slots × ~30 rodadas) */
  MAX_ROUNDS_PER_DAY: 150,

  /**
   * Hora de reset diário do contador: 02:59 UTC = 23:59 BRT.
   * Usada em maybeResetDailyCounter.
   */
  DAILY_RESET_HOUR_UTC: 2,
  DAILY_RESET_MINUTE_UTC: 59,
} as const;

/**
 * Slots de gameplay ativo do match/global (horário São Paulo, BRT = UTC-3).
 * Cada slot define [inicioMinutosDesde0h, fimMinutosDesde0h] em BRT.
 * Entre slots há uma janela de comando de 30min.
 *
 * Slot 1: 05:30 → 08:00 BRT
 * Slot 2: 08:30 → 11:00 BRT
 * Slot 3: 11:30 → 14:00 BRT
 * Slot 4: 14:30 → 17:00 BRT
 * Slot 5: 17:30 → 20:00 BRT
 */
export const GLOBAL_SLOTS_BRT: Array<{ start: number; end: number; label: string }> = [
  { start: 5 * 60 + 30,  end: 8 * 60,       label: 'Slot 1' },
  { start: 8 * 60 + 30,  end: 11 * 60,      label: 'Slot 2' },
  { start: 11 * 60 + 30, end: 14 * 60,      label: 'Slot 3' },
  { start: 14 * 60 + 30, end: 17 * 60,      label: 'Slot 4' },
  { start: 17 * 60 + 30, end: 20 * 60,      label: 'Slot 5' },
];

/** Offset BRT em minutos (UTC-3 = -180min) */
const BRT_OFFSET_MINUTES = -180;

/** Retorna os minutos desde meia-noite BRT para um timestamp UTC */
function brtMinutesSinceMidnight(nowMs: number): number {
  const totalMinutesUtc = Math.floor(nowMs / 60000);
  const totalMinutesBrt = totalMinutesUtc + BRT_OFFSET_MINUTES;
  return ((totalMinutesBrt % (24 * 60)) + 24 * 60) % (24 * 60);
}

/** Retorna o timestamp UTC do início de um minuto BRT no mesmo dia BRT de nowMs */
function brtMinutesToUtcMs(nowMs: number, brtMinutes: number): number {
  const totalMinutesUtc = Math.floor(nowMs / 60000);
  const totalMinutesBrt = totalMinutesUtc + BRT_OFFSET_MINUTES;
  const midnightBrt = totalMinutesBrt - ((totalMinutesBrt % (24 * 60) + 24 * 60) % (24 * 60));
  return (midnightBrt + brtMinutes - BRT_OFFSET_MINUTES) * 60000;
}

export interface SlotStatus {
  /** Slot ativo agora (gameplay rodando) */
  activeSlot: typeof GLOBAL_SLOTS_BRT[number] | null;
  /** Janela de comando ativa (entre slots) */
  isCommandWindow: boolean;
  /** Próximo slot que vai começar */
  nextSlot: typeof GLOBAL_SLOTS_BRT[number] | null;
  /** Timestamp UTC do início do próximo slot */
  nextSlotStartMs: number | null;
  /** Timestamp UTC do início da próxima janela de comando */
  nextCommandWindowMs: number | null;
}

/** Retorna o status atual dos slots para um dado timestamp */
export function getSlotStatus(nowMs: number): SlotStatus {
  const brtNow = brtMinutesSinceMidnight(nowMs);

  for (let i = 0; i < GLOBAL_SLOTS_BRT.length; i++) {
    const slot = GLOBAL_SLOTS_BRT[i]!;
    const nextSlot = GLOBAL_SLOTS_BRT[i + 1] ?? null;

    // Dentro do slot ativo
    if (brtNow >= slot.start && brtNow < slot.end) {
      return {
        activeSlot: slot,
        isCommandWindow: false,
        nextSlot,
        nextSlotStartMs: nextSlot ? brtMinutesToUtcMs(nowMs, nextSlot.start) : null,
        nextCommandWindowMs: brtMinutesToUtcMs(nowMs, slot.end),
      };
    }

    // Janela de comando (entre fim do slot e início do próximo)
    if (nextSlot && brtNow >= slot.end && brtNow < nextSlot.start) {
      return {
        activeSlot: null,
        isCommandWindow: true,
        nextSlot,
        nextSlotStartMs: brtMinutesToUtcMs(nowMs, nextSlot.start),
        nextCommandWindowMs: null,
      };
    }
  }

  // Fora de todos os slots (noite: 20:00 → 05:30 BRT)
  const firstSlot = GLOBAL_SLOTS_BRT[0]!;
  let nextSlotStartMs = brtMinutesToUtcMs(nowMs, firstSlot.start);
  // Se já passou das 20h BRT, o próximo slot é amanhã
  if (brtNow >= 20 * 60) {
    nextSlotStartMs += 24 * 60 * 60 * 1000;
  }

  return {
    activeSlot: null,
    isCommandWindow: false,
    nextSlot: firstSlot,
    nextSlotStartMs,
    nextCommandWindowMs: null,
  };
}

/** Retorna true se o match/global pode rodar rodadas agora */
export function isGlobalActive(nowMs: number): boolean {
  return getSlotStatus(nowMs).activeSlot !== null;
}

/**
 * Calcula o próximo horário de rodada dentro do slot ativo (a cada 5min).
 * Se não estiver em slot ativo, retorna o início do próximo slot.
 */
export function getNextRoundTime(nowMs: number): number {
  const status = getSlotStatus(nowMs);

  if (status.activeSlot) {
    // Próxima rodada: arredonda para o próximo múltiplo de 5min
    const intervalMs = SCHEDULER_CONFIG.ROUND_INTERVAL_MS;
    return Math.ceil((nowMs + 1000) / intervalMs) * intervalMs;
  }

  // Fora do slot: próxima rodada é o início do próximo slot
  return status.nextSlotStartMs ?? nowMs + SCHEDULER_CONFIG.ROUND_INTERVAL_MS;
}

/**
 * Verifica se é hora de criar uma nova rodada.
 * Só cria se estiver dentro de um slot ativo do match/global.
 */
export function shouldCreateNewRound(
  globalLeague: GlobalLeagueState | undefined,
  nowMs: number,
): boolean {
  if (!globalLeague) return false;
  if (!isGlobalActive(nowMs)) return false;

  const currentRound = globalLeague.currentRound;

  // Sem rodada atual → criar primeira
  if (!currentRound) return true;

  // Rodada atual ainda não terminou
  if (currentRound.status === 'live' || currentRound.status === 'pre_match') {
    return false;
  }

  // Rodada terminou → verificar se passou o intervalo de 5min
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
 * Verifica se a rodada deve iniciar (kickoff chegou).
 * A janela de comando agora é o intervalo entre slots (30min), não por rodada.
 */
export function shouldStartRound(round: GlobalRound, nowMs: number): boolean {
  if (round.status !== 'scheduled') return false;
  return nowMs >= round.scheduledKickoffMs;
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
 * Reseta contador diário de rodadas às 23:59 BRT (02:59 UTC).
 * Usa a data BRT como chave para evitar reset duplo no mesmo dia.
 */
export function maybeResetDailyCounter(
  scheduler: SchedulerState,
  nowMs: number,
): SchedulerState {
  // Data atual em BRT (UTC-3)
  const brtMs = nowMs + BRT_OFFSET_MINUTES * 60 * 1000;
  const todayBrt = new Date(brtMs).toISOString().split('T')[0]!;

  if (scheduler.lastResetDate !== todayBrt) {
    return {
      ...scheduler,
      roundsToday: 0,
      lastResetDate: todayBrt,
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
 * Verifica se o manager está na janela de comando (entre slots).
 * Managers sempre podem mexer no time, mas mudanças só valem na próxima rodada.
 */
export function canGiveCommands(nowMs: number): boolean {
  const status = getSlotStatus(nowMs);
  return status.isCommandWindow;
}

/**
 * Calcula tempo restante da janela de comando atual (entre slots).
 * Retorna 0 se não estiver em janela de comando.
 */
export function getCommandWindowTimeLeft(nowMs: number): number {
  const status = getSlotStatus(nowMs);
  if (!status.isCommandWindow || !status.nextSlotStartMs) return 0;
  return Math.max(0, status.nextSlotStartMs - nowMs);
}
