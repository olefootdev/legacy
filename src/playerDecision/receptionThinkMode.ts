import type { ContextReading, DecisionContext, DecisionSpeed, ReceptionThinkMode } from './types';
import {
  RECEPTION_THINK_FAST_SEC,
  RECEPTION_THINK_MODERATE_SEC,
  RECEPTION_THINK_SLOW_SEC,
} from '@/match/matchSimulationTuning';

export function receptionThinkBaseSec(mode: ReceptionThinkMode): number {
  switch (mode) {
    case 'fast':
      return RECEPTION_THINK_FAST_SEC;
    case 'moderate':
      return RECEPTION_THINK_MODERATE_SEC;
    case 'slow':
      return RECEPTION_THINK_SLOW_SEC;
  }
}

/** Compatível com `DecisionTiming.speed` / telemetria legada. */
export function mapReceptionThinkToDecisionSpeed(mode: ReceptionThinkMode): DecisionSpeed {
  switch (mode) {
    case 'fast':
      return 'fast';
    case 'moderate':
      return 'normal';
    case 'slow':
      return 'slow';
  }
}

/**
 * Modo na “cabeça” ao receber a bola (define janela 1s / 2s / 3s antes da decisão):
 *
 * - **Rápido**: passe/chute/carrinho/falta — perigo, área, pressão alta, transição apertada.
 * - **Moderado**: ler o jogo, avançar, buscar colega — meio-campo e pressão média.
 * - **Lento**: passe difícil, risco de erro ou lance genial — tempo, espaço, visão/criatividade.
 */
export function computeReceptionThinkMode(ctx: DecisionContext, reading: ContextReading): ReceptionThinkMode {
  const p = reading.pressure;
  const fz = reading.fieldZone;

  if (reading.threatLevel > 0.52) return 'fast';
  if (fz === 'opp_box' || fz === 'att_third') return 'fast';
  if (p.intensity === 'extreme' || p.intensity === 'high') return 'fast';
  if (p.nearestOpponentDist < 5.5 && (p.closingSpeed > 3.8 || p.intensity !== 'none')) return 'fast';
  if (fz === 'own_box' && p.intensity !== 'none' && p.intensity !== 'low') return 'fast';

  const arche = ctx.profile.archetype;
  const vision = ctx.profile.vision ?? 0.5;
  const lowPressure =
    p.intensity === 'none' || (p.intensity === 'low' && p.nearestOpponentDist > 11);
  const deepish =
    fz === 'own_box'
    || fz === 'def_third'
    || fz === 'def_mid'
    || (fz === 'mid' && reading.progressToGoal < 0.48);

  if (
    lowPressure
    && deepish
    && p.closingSpeed < 3.2
    && (arche === 'creative' || arche === 'playmaker' || vision > 0.55)
  ) {
    return 'slow';
  }

  if (lowPressure && reading.space.forwardSpaceDepth > 12 && reading.threatLevel < 0.32) {
    return 'slow';
  }

  return 'moderate';
}
