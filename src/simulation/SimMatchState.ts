import type { PossessionSide, MatchEventEntry, LiveMatchClockPeriod } from '@/engine/types';
import type { CausalLogState, CausalMatchEvent } from '@/match/causal/matchCausalTypes';
import { appendCausalEntries, scoreDeltaFromEvents } from '@/match/causal/matchCausalTypes';
import {
  pushMotorTelemetryRecord,
  type MotorTelemetryRecord,
} from '@/match/motorActionOutcome';

export type { MotorTelemetryRecord } from '@/match/motorActionOutcome';

export interface SimMatchStats {
  passesOk: number;
  passesAttempt: number;
  tackles: number;
  km: number;
  shots: number;
  goals: number;
}

/** Agregado de finalização por partida (motor tático / QA). */
export interface ShotMatchTelemetry {
  attempts: number;
  /** Remates que entraram em resolução “no alvo” (gol ou defesa). */
  onTarget: number;
  goals: number;
  saves: number;
  /** Fora / não defesa (MISS no resolver). */
  offTarget: number;
  /** Frames em que o portador foi candidato a remate (elegibilidade mínima). */
  shootCandidatesAsCarrier: number;
  /** Quantas vezes a ação escolhida foi shoot após o pipeline. */
  shootChosen: number;
  shotBudgetForcesUsed: number;
}

export interface CarrierDebugLogEntry {
  simTime: number;
  playerId: string;
  pickedAction: string;
  zoneTags: string;
  top3: string;
}

export interface SimMatchState {
  homeScore: number;
  awayScore: number;
  possession: PossessionSide;
  carrierId: string | null;
  minute: number;
  phase: 'live' | 'stopped' | 'kickoff' | 'goal_restart' | 'halftime' | 'fulltime';
  /** Alinhado ao MatchClock (exceto pós-jogo, quando pode ficar em second_half até sync final). */
  clockPeriod: LiveMatchClockPeriod;
  causalLog: CausalLogState;
  events: MatchEventEntry[];
  stats: Record<string, SimMatchStats>;
  /** Last emitted causal seq (for event bus). */
  lastEmittedSeq: number;
  /** Seed para RNG determinístico de resolução de ações (replay/debug). */
  simulationSeed: number;
  /** Minutos de jogo em que houve mudança de posse (janela para QA). */
  possessionChangeMinutes: number[];
  /** Total de mudanças de posse na partida simulada. */
  possessionChangesTotal: number;
  shotTelemetry: ShotMatchTelemetry;
  /** Últimas ações do portador (debug). */
  carrierDebugLog: CarrierDebugLogEntry[];
  /** Últimos outcomes do motor (remate, defesa, desarme, passe, interceptação) — debug / narração. */
  motorOutcomeLog: MotorTelemetryRecord[];
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultStats(): SimMatchStats {
  return { passesOk: 0, passesAttempt: 0, tackles: 0, km: 0, shots: 0, goals: 0 };
}

function defaultShotTelemetry(): ShotMatchTelemetry {
  return {
    attempts: 0,
    onTarget: 0,
    goals: 0,
    saves: 0,
    offTarget: 0,
    shootCandidatesAsCarrier: 0,
    shootChosen: 0,
    shotBudgetForcesUsed: 0,
  };
}

export function createSimMatchState(): SimMatchState {
  return {
    homeScore: 0,
    awayScore: 0,
    possession: 'home',
    carrierId: null,
    minute: 0,
    phase: 'kickoff',
    clockPeriod: 'first_half',
    causalLog: { nextSeq: 1, entries: [] },
    events: [],
    stats: {},
    lastEmittedSeq: 0,
    simulationSeed: 0xcafebabe,
    possessionChangeMinutes: [],
    possessionChangesTotal: 0,
    shotTelemetry: defaultShotTelemetry(),
    carrierDebugLog: [],
    motorOutcomeLog: [],
  };
}

/** Anexa um registo ao anel de telemetria do motor (cap em MOTOR_TELEMETRY_LOG_MAX). */
export function pushMotorTelemetry(state: SimMatchState, rec: MotorTelemetryRecord): void {
  pushMotorTelemetryRecord(state.motorOutcomeLog, rec);
}

export function pushSimEvent(
  state: SimMatchState,
  text: string,
  kind: MatchEventEntry['kind'] = 'narrative',
  live2dMoment?: MatchEventEntry['live2dMoment'],
  playerId?: string,
) {
  const ev: MatchEventEntry = { id: uid(), minute: state.minute, text, kind };
  if (live2dMoment) ev.live2dMoment = live2dMoment;
  if (playerId) ev.playerId = playerId;
  state.events.unshift(ev);
  if (state.events.length > 60) state.events.pop();
}

export function appendSimCausal(state: SimMatchState, batch: CausalMatchEvent[]) {
  if (batch.length === 0) return;
  state.causalLog = appendCausalEntries(state.causalLog, batch);
  const delta = scoreDeltaFromEvents(batch);
  state.homeScore += delta.home;
  state.awayScore += delta.away;
}

export function getOrCreateStats(state: SimMatchState, playerId: string): SimMatchStats {
  if (!state.stats[playerId]) state.stats[playerId] = defaultStats();
  return state.stats[playerId]!;
}
