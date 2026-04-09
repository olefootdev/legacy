/**
 * Relógio de partida — tempo real de simulação (cada tick soma `dt`).
 *
 * Estrutura fixa:
 * - 1.º tempo: 90 s (jogo autónomo; minuto de exibição 0'–45')
 * - Intervalo: 15 s (sem avanço do motor tático)
 * - 2.º tempo: 90 s (jogo autónomo; minuto de exibição 45'–90')
 *
 * O minuto mostrado nas ações / UI é derivado do progresso dentro de cada tempo,
 * para alinhar decisões dos agentes ao “relógio” da partida.
 */

export type MatchClockPeriod = 'first_half' | 'halftime' | 'second_half' | 'full_time';

export interface MatchClockState {
  period: MatchClockPeriod;
  /** Segundos decorridos dentro do período atual. */
  periodElapsed: number;
  /** Minuto “de futebol” (0–45 no 1.º T; 45 no intervalo; 45–90 no 2.º T). */
  minute: number;
  /** 1 durante 1.º tempo + intervalo; 2 durante 2.º tempo. */
  half: 1 | 2;
  running: boolean;
  fullTime: boolean;
}

/** Durações em segundos de simulação (1 unidade = 1 s de `dt` com multiplier 1). */
export const FIRST_HALF_DURATION_SEC = 90;
export const HALFTIME_DURATION_SEC = 15;
export const SECOND_HALF_DURATION_SEC = 90;

function displayMinuteFirstHalf(periodElapsed: number): number {
  if (periodElapsed <= 0) return 0;
  const m = Math.floor((periodElapsed / FIRST_HALF_DURATION_SEC) * 45.999);
  return Math.min(45, m);
}

function displayMinuteSecondHalf(periodElapsed: number): number {
  if (periodElapsed <= 0) return 45;
  const m = 45 + Math.floor((periodElapsed / SECOND_HALF_DURATION_SEC) * 45.999);
  return Math.min(90, m);
}

export class MatchClock {
  state: MatchClockState = {
    period: 'first_half',
    periodElapsed: 0,
    minute: 0,
    half: 1,
    running: false,
    fullTime: false,
  };

  private speedMultiplier = 1.0;

  reset() {
    this.state = {
      period: 'first_half',
      periodElapsed: 0,
      minute: 0,
      half: 1,
      running: false,
      fullTime: false,
    };
    this.speedMultiplier = 1.0;
  }

  setSpeedMultiplier(m: number) {
    this.speedMultiplier = Math.max(0.25, Math.min(8, m));
  }

  start() {
    this.state.running = true;
  }

  stop() {
    this.state.running = false;
  }

  /**
   * Avança o relógio. Não avança se `fullTime` ou se `running === false`.
   * Transições: first_half → halftime → second_half → full_time.
   */
  tick(dt: number): MatchClockState {
    if (!this.state.running || this.state.fullTime) {
      this.recomputeMinute();
      return this.state;
    }

    const d = dt * this.speedMultiplier;
    this.state.periodElapsed += d;

    if (this.state.period === 'first_half') {
      if (this.state.periodElapsed >= FIRST_HALF_DURATION_SEC) {
        this.state.period = 'halftime';
        this.state.periodElapsed = 0;
        this.state.half = 1;
      }
    } else if (this.state.period === 'halftime') {
      if (this.state.periodElapsed >= HALFTIME_DURATION_SEC) {
        this.state.period = 'second_half';
        this.state.periodElapsed = 0;
        this.state.half = 2;
      }
    } else if (this.state.period === 'second_half') {
      if (this.state.periodElapsed >= SECOND_HALF_DURATION_SEC) {
        this.state.period = 'full_time';
        this.state.periodElapsed = SECOND_HALF_DURATION_SEC;
        this.state.minute = 90;
        this.state.fullTime = true;
        this.state.running = false;
      }
    }

    this.recomputeMinute();
    return this.state;
  }

  private recomputeMinute() {
    switch (this.state.period) {
      case 'first_half':
        this.state.minute = displayMinuteFirstHalf(this.state.periodElapsed);
        break;
      case 'halftime':
        this.state.minute = 45;
        break;
      case 'second_half':
        this.state.minute = displayMinuteSecondHalf(this.state.periodElapsed);
        break;
      case 'full_time':
        this.state.minute = 90;
        break;
      default:
        break;
    }
  }
}
