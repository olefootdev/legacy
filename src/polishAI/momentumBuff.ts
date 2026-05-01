/**
 * Reação a eventos extra-campo: gol da casa = buff ofensivo de 5min.
 * Modula moraleRuntime e confidenceRuntime dos agentes do time que marcou.
 */

/** Duração padrão do buff em segundos de simulação (5 minutos de jogo) */
const DEFAULT_BUFF_DURATION_SEC = 300;
/** Boost de confiança durante o buff */
const DEFAULT_CONFIDENCE_BOOST = 1.12;
/** Boost de morale durante o buff */
const DEFAULT_MORALE_BOOST = 0.18;

export interface MomentumBuffState {
  side: 'home' | 'away';
  active: boolean;
  activatedAt: number;  // simTime
  durationSec: number;  // default 300 (5min)
  /** Multiplicador de confiança durante o buff (1.0-1.15) */
  confidenceBoost: number;
  /** Boost de morale durante o buff (0.0-0.2) */
  moraleBoost: number;
}

export function createMomentumBuffState(side: 'home' | 'away'): MomentumBuffState {
  return {
    side,
    active: false,
    activatedAt: 0,
    durationSec: DEFAULT_BUFF_DURATION_SEC,
    confidenceBoost: DEFAULT_CONFIDENCE_BOOST,
    moraleBoost: DEFAULT_MORALE_BOOST,
  };
}

/**
 * Ativa o buff de momentum para o time que marcou.
 * Se já estava ativo, reinicia o timer (gol duplo = buff renovado).
 */
export function activateMomentumBuff(state: MomentumBuffState, simTime: number): void {
  state.active = true;
  state.activatedAt = simTime;
}

/**
 * Tick do buff: desativa automaticamente quando a duração expira.
 * Deve ser chamado a cada frame/tick do motor.
 */
export function tickMomentumBuff(state: MomentumBuffState, simTime: number): void {
  if (!state.active) return;
  if (simTime >= state.activatedAt + state.durationSec) {
    state.active = false;
  }
}

/**
 * Verifica se o buff está ativo no momento dado.
 */
export function isMomentumBuffActive(state: MomentumBuffState, simTime: number): boolean {
  return state.active && simTime < state.activatedAt + state.durationSec;
}

/**
 * Retorna modificadores a aplicar no runtime do agente.
 * O boost diminui linearmente nos últimos 20% da duração (fade-out suave).
 * Retorna null se buff não está ativo.
 */
export function getMomentumBuffModifiers(
  state: MomentumBuffState,
  simTime: number,
): { confidenceBoost: number; moraleBoost: number } | null {
  if (!isMomentumBuffActive(state, simTime)) return null;

  const elapsed = simTime - state.activatedAt;
  const remaining = state.durationSec - elapsed;
  const fadeWindow = state.durationSec * 0.2;

  // Fade-out linear nos últimos 20% da duração
  const fadeFactor = remaining < fadeWindow
    ? remaining / fadeWindow
    : 1.0;

  return {
    confidenceBoost: 1.0 + (state.confidenceBoost - 1.0) * fadeFactor,
    moraleBoost: state.moraleBoost * fadeFactor,
  };
}
