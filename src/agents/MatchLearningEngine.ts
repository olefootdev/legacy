/**
 * MatchLearningEngine — Sistema de aprendizado pós-jogo
 *
 * Registra eventos importantes durante a partida e atualiza
 * o LearningState do AgentProfile baseado em:
 * - Passes certos/errados sob pressão
 * - Chutes certos/errados
 * - Duelos ganhos/perdidos
 * - Erros críticos
 * - Decisões egoístas bem/mal sucedidas
 */

import type { AgentProfile, LearningEvent, LearningState } from './types';
import type { MatchEventEntry } from '@/engine/types';

/** Evento de aprendizado capturado durante a partida */
export interface CapturedLearningEvent {
  playerId: string;
  type: LearningEvent['type'];
  minute: number;
  context: string;
  impact: number;
}

/**
 * Captura eventos de aprendizado durante a partida
 */
export class MatchLearningCapture {
  private events: CapturedLearningEvent[] = [];

  /** Registra passe bem-sucedido sob pressão */
  recordPassOk(playerId: string, minute: number, underPressure: boolean) {
    if (underPressure) {
      this.events.push({
        playerId,
        type: 'pass_ok',
        minute,
        context: 'Passe certo sob pressão',
        impact: +3,
      });
    } else {
      this.events.push({
        playerId,
        type: 'pass_ok',
        minute,
        context: 'Passe certo',
        impact: +1,
      });
    }
  }

  /** Registra passe errado */
  recordPassFail(playerId: string, minute: number, underPressure: boolean) {
    if (underPressure) {
      this.events.push({
        playerId,
        type: 'pass_fail',
        minute,
        context: 'Passe errado sob pressão',
        impact: -2,
      });
    } else {
      this.events.push({
        playerId,
        type: 'pass_fail',
        minute,
        context: 'Passe errado',
        impact: -3,
      });
    }
  }

  /** Registra chute certo (gol ou no alvo) */
  recordShotOk(playerId: string, minute: number, wasGoal: boolean) {
    this.events.push({
      playerId,
      type: 'shot_ok',
      minute,
      context: wasGoal ? 'Gol!' : 'Chute no alvo',
      impact: wasGoal ? +8 : +4,
    });
  }

  /** Registra chute errado (fora ou defendido fácil) */
  recordShotFail(playerId: string, minute: number, wasWide: boolean) {
    this.events.push({
      playerId,
      type: 'shot_fail',
      minute,
      context: wasWide ? 'Chute para fora' : 'Chute defendido',
      impact: wasWide ? -4 : -2,
    });
  }

  /** Registra duelo ganho */
  recordDuelWon(playerId: string, minute: number) {
    this.events.push({
      playerId,
      type: 'duel_won',
      minute,
      context: 'Duelo ganho',
      impact: +2,
    });
  }

  /** Registra duelo perdido */
  recordDuelLost(playerId: string, minute: number) {
    this.events.push({
      playerId,
      type: 'duel_lost',
      minute,
      context: 'Duelo perdido',
      impact: -2,
    });
  }

  /** Registra erro crítico (pênalti concedido, gol sofrido por erro) */
  recordCriticalError(playerId: string, minute: number, context: string) {
    this.events.push({
      playerId,
      type: 'critical_error',
      minute,
      context,
      impact: -8,
    });
  }

  /** Registra sucesso crítico (defesa importante, assistência decisiva) */
  recordCriticalSuccess(playerId: string, minute: number, context: string) {
    this.events.push({
      playerId,
      type: 'critical_success',
      minute,
      context,
      impact: +8,
    });
  }

  /** Registra decisão egoísta bem-sucedida (chutou em vez de passar e fez gol) */
  recordSelfishOk(playerId: string, minute: number) {
    this.events.push({
      playerId,
      type: 'selfish_ok',
      minute,
      context: 'Decisão egoísta bem-sucedida',
      impact: +5,
    });
  }

  /** Registra decisão egoísta mal-sucedida (chutou em vez de passar e errou) */
  recordSelfishFail(playerId: string, minute: number) {
    this.events.push({
      playerId,
      type: 'selfish_fail',
      minute,
      context: 'Decisão egoísta mal-sucedida',
      impact: -6,
    });
  }

  /** Retorna eventos capturados */
  getEvents(): CapturedLearningEvent[] {
    return this.events;
  }

  /** Retorna eventos de um jogador específico */
  getPlayerEvents(playerId: string): CapturedLearningEvent[] {
    return this.events.filter((e) => e.playerId === playerId);
  }

  /** Limpa eventos */
  clear() {
    this.events = [];
  }
}

/**
 * Aplica eventos de aprendizado ao LearningState
 */
export function applyLearningEvents(
  state: LearningState,
  events: CapturedLearningEvent[],
): LearningState {
  const newState = { ...state };

  // Adiciona eventos recentes (max 20)
  const newEvents: LearningEvent[] = events.map((e) => ({
    type: e.type,
    minute: e.minute,
    context: e.context,
    impact: e.impact,
  }));
  newState.recentEvents = [...newEvents, ...state.recentEvents].slice(0, 20);

  // Calcula impacto total
  const totalImpact = events.reduce((sum, e) => sum + e.impact, 0);

  // Atualiza confiança
  newState.confidence = clamp(state.confidence + totalImpact * 0.5);

  // Atualiza tendências baseado em tipos de evento
  const passOk = events.filter((e) => e.type === 'pass_ok').length;
  const passFail = events.filter((e) => e.type === 'pass_fail').length;
  const shotOk = events.filter((e) => e.type === 'shot_ok').length;
  const shotFail = events.filter((e) => e.type === 'shot_fail').length;
  const criticalError = events.filter((e) => e.type === 'critical_error').length;
  const criticalSuccess = events.filter((e) => e.type === 'critical_success').length;
  const selfishOk = events.filter((e) => e.type === 'selfish_ok').length;
  const selfishFail = events.filter((e) => e.type === 'selfish_fail').length;

  // Preferência passe vs chute
  if (passOk > shotOk) {
    newState.passVsShootPreference = clamp(state.passVsShootPreference + 2);
  } else if (shotOk > passOk) {
    newState.passVsShootPreference = clamp(state.passVsShootPreference - 2);
  }

  // Tendência de risco
  if (shotOk + selfishOk > shotFail + selfishFail) {
    newState.riskTendency = clamp(state.riskTendency + 3);
  } else if (shotFail + selfishFail > shotOk + selfishOk) {
    newState.riskTendency = clamp(state.riskTendency - 3);
  }

  // Compostura crítica
  if (criticalSuccess > criticalError) {
    newState.criticalComposure = clamp(state.criticalComposure + 4);
  } else if (criticalError > criticalSuccess) {
    newState.criticalComposure = clamp(state.criticalComposure - 4);
  }

  // Disciplina tática (passa bem = disciplinado)
  if (passOk > passFail * 2) {
    newState.tacticalDiscipline = clamp(state.tacticalDiscipline + 2);
  } else if (passFail > passOk) {
    newState.tacticalDiscipline = clamp(state.tacticalDiscipline - 1);
  }

  // Ego controlado
  if (selfishFail > selfishOk) {
    newState.egoControl = clamp(state.egoControl + 3);
  } else if (selfishOk > selfishFail) {
    newState.egoControl = clamp(state.egoControl - 2);
  }

  return newState;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Atualiza AgentProfile com aprendizado pós-jogo
 */
export function updateAgentProfileWithLearning(
  profile: AgentProfile,
  events: CapturedLearningEvent[],
): AgentProfile {
  const newLearningState = applyLearningEvents(profile.learningState, events);
  return {
    ...profile,
    learningState: newLearningState,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Micro-learning: apply a single event to LearningState in real-time during the match.
 * Impact is reduced to ¼ of post-game values to prevent flip-flopping.
 * Total drift per match is capped at ±5 per dimension.
 */
export function applyMicroLearning(
  state: LearningState,
  event: CapturedLearningEvent,
  driftAccumulator: Map<string, number>,
): LearningState {
  const MICRO_SCALE = 0.25;
  const MAX_DRIFT_PER_MATCH = 5;

  const key = `${event.playerId}`;
  const currentDrift = driftAccumulator.get(key) ?? 0;
  const scaledImpact = event.impact * MICRO_SCALE;
  const remainingBudget = MAX_DRIFT_PER_MATCH - Math.abs(currentDrift);
  if (remainingBudget <= 0) return state;

  const clampedImpact = Math.sign(scaledImpact) * Math.min(Math.abs(scaledImpact), remainingBudget);
  driftAccumulator.set(key, currentDrift + clampedImpact);

  const s = { ...state };

  s.confidence = clamp(s.confidence + clampedImpact * 0.5);

  if (event.type === 'pass_ok') s.passVsShootPreference = clamp(s.passVsShootPreference + clampedImpact * 0.3);
  if (event.type === 'pass_fail') s.passVsShootPreference = clamp(s.passVsShootPreference - Math.abs(clampedImpact) * 0.2);
  if (event.type === 'shot_ok') s.passVsShootPreference = clamp(s.passVsShootPreference - clampedImpact * 0.3);
  if (event.type === 'shot_fail') s.riskTendency = clamp(s.riskTendency - Math.abs(clampedImpact) * 0.4);
  if (event.type === 'duel_won') s.confidence = clamp(s.confidence + Math.abs(clampedImpact) * 0.3);
  if (event.type === 'duel_lost') s.confidence = clamp(s.confidence - Math.abs(clampedImpact) * 0.3);
  if (event.type === 'critical_success') s.criticalComposure = clamp(s.criticalComposure + Math.abs(clampedImpact) * 0.6);
  if (event.type === 'critical_error') s.criticalComposure = clamp(s.criticalComposure - Math.abs(clampedImpact) * 0.6);
  if (event.type === 'selfish_ok') s.egoControl = clamp(s.egoControl - Math.abs(clampedImpact) * 0.3);
  if (event.type === 'selfish_fail') s.egoControl = clamp(s.egoControl + Math.abs(clampedImpact) * 0.4);

  return s;
}

/**
 * Gera relatório de aprendizado para UI
 */
export function generateLearningReport(
  events: CapturedLearningEvent[],
): {
  totalImpact: number;
  positiveEvents: number;
  negativeEvents: number;
  highlights: string[];
} {
  const totalImpact = events.reduce((sum, e) => sum + e.impact, 0);
  const positiveEvents = events.filter((e) => e.impact > 0).length;
  const negativeEvents = events.filter((e) => e.impact < 0).length;

  const highlights: string[] = [];

  // Top 3 eventos positivos
  const topPositive = events
    .filter((e) => e.impact > 0)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);
  for (const e of topPositive) {
    highlights.push(`✅ ${e.context} (${e.minute}')`);
  }

  // Top 3 eventos negativos
  const topNegative = events
    .filter((e) => e.impact < 0)
    .sort((a, b) => a.impact - b.impact)
    .slice(0, 3);
  for (const e of topNegative) {
    highlights.push(`❌ ${e.context} (${e.minute}')`);
  }

  return {
    totalImpact,
    positiveEvents,
    negativeEvents,
    highlights,
  };
}
