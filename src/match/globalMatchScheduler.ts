/**
 * Scheduler de Rodadas Automáticas
 *
 * Dispara rodadas a cada 1 hora com janela de 5min para comandos.
 * Integra com backend para persistência e sincronização.
 */

import type {
  GlobalRound,
  GlobalFixture,
  GlobalLeagueState,
  GlobalRoundStatus,
  CycleWindowPhase,
} from './globalMatch';
import {
  newGlobalRoundId,
  GLOBAL_MATCH_CONSTANTS,
  createEmptyGlobalLeagueState,
  getCycleWindowPhase,
} from './globalMatch';
import { simulateGlobalRound } from './globalMatchSimulator';
import { processRoundConsequences } from './globalMatchConsequences';
import type { LeagueStandingRow } from './adminLeagues';

interface SchedulerConfig {
  /** Intervalo entre rodadas (ms) — padrão 1 hora */
  roundIntervalMs: number;
  /** Janela de comandos antes do kickoff (ms) — padrão 5 min */
  commandWindowMs: number;
  /** Duração de cada rodada (ms) — padrão 3 min */
  roundDurationMs: number;
  /** Máximo de rodadas por dia */
  maxRoundsPerDay: number;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  roundIntervalMs: GLOBAL_MATCH_CONSTANTS.ROUND_INTERVAL_MS,
  commandWindowMs: GLOBAL_MATCH_CONSTANTS.COMMAND_WINDOW_MS,
  roundDurationMs: GLOBAL_MATCH_CONSTANTS.ROUND_DURATION_MS,
  maxRoundsPerDay: GLOBAL_MATCH_CONSTANTS.MAX_ROUNDS_PER_DAY,
};

/**
 * Calcula próximo horário de rodada
 */
function calculateNextRoundTime(
  lastRoundMs: number | undefined,
  config: SchedulerConfig,
): number {
  const now = Date.now();

  if (!lastRoundMs) {
    // Primeira rodada: agendar para próxima hora cheia
    const nextHour = new Date(now);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    return nextHour.getTime();
  }

  // Próxima rodada: última + intervalo
  return lastRoundMs + config.roundIntervalMs;
}

/**
 * Verifica se já atingiu o limite de rodadas do dia
 */
function hasReachedDailyLimit(
  recentRounds: GlobalRound[],
  config: SchedulerConfig,
): boolean {
  const now = Date.now();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const todayRounds = recentRounds.filter(
    (r) => r.scheduledKickoffMs >= todayStart.getTime(),
  );

  return todayRounds.length >= config.maxRoundsPerDay;
}

/**
 * Cria uma nova rodada agendada
 */
export function createScheduledRound(
  roundNumber: number,
  scheduledKickoffMs: number,
  fixtures: GlobalFixture[],
  config: SchedulerConfig = DEFAULT_CONFIG,
): GlobalRound {
  return {
    id: newGlobalRoundId(),
    roundNumber,
    status: 'scheduled',
    scheduledKickoffMs,
    fixtures,
    highlights: [],
    durationMs: config.roundDurationMs,
  };
}

/**
 * Avança o status da rodada baseado no tempo atual
 */
export function advanceRoundStatus(
  round: GlobalRound,
  nowMs: number,
  config: SchedulerConfig = DEFAULT_CONFIG,
): GlobalRound {
  const commandWindowStart = round.scheduledKickoffMs - config.commandWindowMs;

  // scheduled → pre_match (janela de comandos abre)
  if (round.status === 'scheduled' && nowMs >= commandWindowStart) {
    return { ...round, status: 'pre_match' };
  }

  // pre_match → locked (comandos fecham)
  if (round.status === 'pre_match' && nowMs >= round.scheduledKickoffMs) {
    return { ...round, status: 'locked' };
  }

  // locked → live (kickoff)
  if (round.status === 'locked' && nowMs >= round.scheduledKickoffMs) {
    return {
      ...round,
      status: 'live',
      actualKickoffMs: nowMs,
    };
  }

  // live → finished (fim da rodada)
  if (
    round.status === 'live' &&
    round.actualKickoffMs &&
    nowMs >= round.actualKickoffMs + round.durationMs
  ) {
    return {
      ...round,
      status: 'finished',
      finishedAtMs: nowMs,
    };
  }

  return round;
}

/**
 * Executa a simulação quando a rodada inicia
 */
export function executeRoundSimulation(round: GlobalRound): GlobalRound {
  if (round.status !== 'live' || !round.actualKickoffMs) {
    return round;
  }

  const { updatedFixtures, allEvents, highlights } = simulateGlobalRound(
    round.fixtures,
    round.actualKickoffMs,
  );

  return {
    ...round,
    fixtures: updatedFixtures,
    highlights,
  };
}

/**
 * Gerenciador principal do scheduler
 */
export class GlobalMatchScheduler {
  private config: SchedulerConfig;
  private state: GlobalLeagueState;
  private intervalId?: NodeJS.Timeout;
  private onStateChange?: (state: GlobalLeagueState) => void;
  private onWindowChange?: (phase: CycleWindowPhase, round: GlobalRound) => void;
  private lastWindowPhase?: CycleWindowPhase;

  constructor(
    initialState?: GlobalLeagueState,
    config: Partial<SchedulerConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = initialState ?? createEmptyGlobalLeagueState();
  }

  /**
   * Inicia o scheduler
   */
  start(
    onStateChange?: (state: GlobalLeagueState) => void,
    onWindowChange?: (phase: CycleWindowPhase, round: GlobalRound) => void,
  ) {
    this.onStateChange = onStateChange;
    this.onWindowChange = onWindowChange;

    // Verificar estado a cada segundo
    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);

    console.log('[GlobalMatchScheduler] Iniciado (LEGACY ciclo 15min)');
  }

  /**
   * Para o scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    console.log('[GlobalMatchScheduler] Parado');
  }

  /**
   * Tick do scheduler (executado a cada segundo)
   */
  private tick() {
    const now = Date.now();

    // Se não há rodada atual, criar próxima
    if (!this.state.currentRound) {
      this.scheduleNextRound();
      return;
    }

    // Avançar status da rodada atual
    const updatedRound = advanceRoundStatus(this.state.currentRound, now, this.config);

    // Se mudou para 'live', executar simulação
    if (updatedRound.status === 'live' && this.state.currentRound.status !== 'live') {
      const simulatedRound = executeRoundSimulation(updatedRound);
      this.state.currentRound = simulatedRound;
      this.notifyStateChange();
      console.log(`[GlobalMatchScheduler] Rodada ${simulatedRound.roundNumber} iniciada`);
      return;
    }

    // Se mudou para 'finished', processar consequências e agendar próxima
    if (updatedRound.status === 'finished' && this.state.currentRound.status !== 'finished') {
      this.finishRound(updatedRound);
      this.scheduleNextRound();
      return;
    }

    // Atualizar estado se houve mudança
    if (updatedRound.status !== this.state.currentRound.status) {
      this.state.currentRound = updatedRound;
      this.notifyStateChange();
    }

    // Detectar transição de janela do ciclo de 15min e notificar
    this.detectWindowTransition(this.state.currentRound, now);
  }

  /**
   * Detecta transição entre janelas do ciclo (recovery → training → tactical → lock → live)
   * e dispara o callback `onWindowChange` no momento da transição.
   */
  private detectWindowTransition(round: GlobalRound, nowMs: number) {
    if (!this.onWindowChange) return;
    const phase = getCycleWindowPhase(round, nowMs);
    if (phase !== this.lastWindowPhase) {
      this.lastWindowPhase = phase;
      this.onWindowChange(phase, round);
    }
  }

  /**
   * Agenda a próxima rodada
   */
  private scheduleNextRound() {
    // Verificar limite diário
    if (hasReachedDailyLimit(this.state.recentRounds, this.config)) {
      console.log('[GlobalMatchScheduler] Limite diário de rodadas atingido');
      return;
    }

    const lastRoundMs = this.state.currentRound?.scheduledKickoffMs;
    const nextKickoffMs = calculateNextRoundTime(lastRoundMs, this.config);

    const roundNumber = (this.state.currentRound?.roundNumber ?? 0) + 1;

    // TODO: Buscar fixtures reais do banco de dados
    // Por enquanto, criar fixtures mock
    const fixtures: GlobalFixture[] = [];

    const newRound = createScheduledRound(
      roundNumber,
      nextKickoffMs,
      fixtures,
      this.config,
    );

    this.state.currentRound = newRound;
    this.state.nextScheduledMs = nextKickoffMs;

    this.notifyStateChange();

    console.log(
      `[GlobalMatchScheduler] Rodada ${roundNumber} agendada para ${new Date(nextKickoffMs).toLocaleString()}`,
    );
  }

  /**
   * Finaliza uma rodada e processa consequências
   */
  private finishRound(round: GlobalRound) {
    console.log(`[GlobalMatchScheduler] Rodada ${round.roundNumber} finalizada`);

    // Adicionar ao histórico
    this.state.recentRounds.push(round);

    // Manter apenas últimas 5 rodadas
    if (this.state.recentRounds.length > 5) {
      this.state.recentRounds.shift();
    }

    // TODO: Processar consequências (suspensões, lesões, tabela)
    // TODO: Persistir no banco de dados

    this.notifyStateChange();
  }

  /**
   * Notifica mudança de estado
   */
  private notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  /**
   * Retorna o estado atual
   */
  getState(): GlobalLeagueState {
    return this.state;
  }

  /**
   * Define fixtures para a próxima rodada
   */
  setNextRoundFixtures(fixtures: GlobalFixture[]) {
    if (this.state.currentRound && this.state.currentRound.status === 'scheduled') {
      this.state.currentRound.fixtures = fixtures;
      this.notifyStateChange();
    }
  }
}

/**
 * Instância singleton do scheduler (para uso no frontend)
 */
let schedulerInstance: GlobalMatchScheduler | undefined;

export function getGlobalScheduler(): GlobalMatchScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new GlobalMatchScheduler();
  }
  return schedulerInstance;
}

export function initializeGlobalScheduler(
  initialState?: GlobalLeagueState,
  config?: Partial<SchedulerConfig>,
) {
  schedulerInstance = new GlobalMatchScheduler(initialState, config);
  return schedulerInstance;
}
