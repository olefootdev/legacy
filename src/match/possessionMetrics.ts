import type { SimMatchState } from '@/simulation/SimMatchState';
import { POSSESSION_QA_MIN_CHANGES_PER_MIN, POSSESSION_QA_WINDOW_MINUTES } from '@/match/actionResolutionTuning';

/** Mudanças de posse por minuto na janela recente (aprox. QA). */
export function possessionChangesPerMinuteInWindow(state: SimMatchState, currentMinute: number): number {
  const lo = currentMinute - POSSESSION_QA_WINDOW_MINUTES;
  const n = state.possessionChangeMinutes.filter((m) => m >= lo && m <= currentMinute).length;
  return n / Math.max(0.5, POSSESSION_QA_WINDOW_MINUTES);
}

export function isPossessionAlternationBelowQaThreshold(state: SimMatchState, currentMinute: number): boolean {
  if (currentMinute < POSSESSION_QA_WINDOW_MINUTES) return false;
  return possessionChangesPerMinuteInWindow(state, currentMinute) < POSSESSION_QA_MIN_CHANGES_PER_MIN;
}
