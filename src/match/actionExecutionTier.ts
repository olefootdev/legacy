/**
 * Tiers de execução + critical hit (baixa probabilidade, alto impacto).
 * `tacticalDisorg01` = desorganização da defesa adversária (0–1), aumenta ligeiramente crit.
 * Usado em ActionResolver — RNG separado por sufixo de seed para determinismo.
 */
import type { AgentSnapshot, PassOption } from '@/simulation/InteractionResolver';
import type { RngDraw } from '@/match/rngDraw';

export type ActionExecutionTier =
  | 'critical_error'
  | 'error'
  | 'normal'
  | 'good'
  | 'excellent'
  | 'critical_hit';

/** Impacto normalizado [-1, 1] para telemetria / encadeamento futuro. */
export type ExecutionImpact01 = number;

const CRIT_CAP = 0.048;
const CRIT_BASE = 0.017;

function stamina01(a: AgentSnapshot): number {
  return Math.max(0.35, Math.min(1, (a.stamina ?? 88) / 100));
}

/** Passe / cru: técnica de passe + mental. */
export function computeCriticalHitProbPassLike(
  agent: AgentSnapshot,
  pressure01: number,
  tacticalDisorg01 = 0,
): number {
  const tech = (agent.passeCurto * 0.55 + agent.passeLongo * 0.45) / 100;
  const mental = (agent.mentalidade + agent.confianca) / 200;
  let p = CRIT_BASE + tech * 0.024 + mental * 0.019;
  p -= pressure01 * 0.029;
  p -= (1 - stamina01(agent)) * 0.014;
  p += tacticalDisorg01 * 0.016;
  return Math.max(0, Math.min(CRIT_CAP, p));
}

export function computeCriticalHitProbShot(
  agent: AgentSnapshot,
  pressure01: number,
  tacticalDisorg01 = 0,
): number {
  const fin = agent.finalizacao / 100;
  const mental = (agent.mentalidade + agent.confianca) / 200;
  let p = CRIT_BASE + fin * 0.026 + mental * 0.021;
  p -= pressure01 * 0.031;
  p -= (1 - stamina01(agent)) * 0.015;
  p += tacticalDisorg01 * 0.015;
  return Math.max(0, Math.min(CRIT_CAP, p));
}

export function computeCriticalHitProbDribble(
  agent: AgentSnapshot,
  pressure01: number,
): number {
  const dr = agent.drible / 100;
  const mental = (agent.mentalidade + agent.confianca) / 200;
  let p = CRIT_BASE + dr * 0.025 + mental * 0.016;
  p -= pressure01 * 0.027;
  p -= (1 - stamina01(agent)) * 0.013;
  return Math.max(0, Math.min(CRIT_CAP, p));
}

export function computeCriticalHitProbDefensive(
  defender: AgentSnapshot,
  carrierSkill01: number,
): number {
  const def = defender.marcacao / 100 + defender.fisico / 200;
  const mental = (defender.mentalidade + defender.confianca) / 200;
  let p = 0.014 + def * 0.02 + mental * 0.014;
  p -= carrierSkill01 * 0.018;
  p -= (1 - stamina01(defender)) * 0.012;
  return Math.max(0, Math.min(0.042, p));
}

export interface PassTierInput {
  completed: boolean;
  interceptPlayerId: string | null;
  roll: number;
  pSuccess: number;
  carrier: AgentSnapshot;
  pressure01: number;
  option: PassOption;
  /** Desorganização da defesa adversária (0–1). */
  tacticalDisorg01?: number;
  rng: RngDraw;
}

export function resolvePassExecutionTier(input: PassTierInput): {
  tier: ActionExecutionTier;
  impact01: ExecutionImpact01;
} {
  const { completed, interceptPlayerId, roll, pSuccess, carrier, pressure01, option, tacticalDisorg01 = 0, rng } =
    input;

  if (interceptPlayerId) {
    return { tier: 'error', impact01: -0.5 };
  }

  if (!completed) {
    const gap = roll - pSuccess;
    if (gap > 0.28) return { tier: 'critical_error', impact01: -0.88 };
    if (gap > 0.12) return { tier: 'error', impact01: -0.48 };
    return { tier: 'normal', impact01: -0.22 };
  }

  const margin = (pSuccess - roll) / Math.max(pSuccess, 0.07);
  const pCrit = computeCriticalHitProbPassLike(carrier, pressure01, tacticalDisorg01);
  const forwardBonus = option.isForward || option.linesBroken > 0 ? 0.08 : 0;

  if (margin > 0.32 && rng.nextUnit() < pCrit + forwardBonus * 0.35) {
    return { tier: 'critical_hit', impact01: 0.94 };
  }
  if (margin > 0.52) return { tier: 'excellent', impact01: 0.72 };
  if (margin > 0.22) return { tier: 'good', impact01: 0.46 };
  return { tier: 'normal', impact01: 0.18 };
}

/** Ajusta posse de bola após passe excelente (bola mais “colada” ao alvo). */
export function tightenPassLandingForTier(
  x: number,
  z: number,
  targetX: number,
  targetZ: number,
  tier: ActionExecutionTier,
): { x: number; z: number } {
  if (tier !== 'critical_hit' && tier !== 'excellent') return { x, z };
  const t = tier === 'critical_hit' ? 0.48 : 0.28;
  return {
    x: x + (targetX - x) * t,
    z: z + (targetZ - z) * t,
  };
}

export function passInterceptMultiplierForTier(tier: ActionExecutionTier): number {
  switch (tier) {
    case 'critical_hit':
      return 0.46;
    case 'excellent':
      return 0.72;
    case 'good':
      return 0.88;
    default:
      return 1;
  }
}

export interface ShotTierInput {
  outcome: 'goal' | 'save' | 'block' | 'miss';
  rollOnTarget: number;
  pOnTarget: number;
  rollBranch: number;
  xGOnTarget: number;
  carrier: AgentSnapshot;
  press01: number;
  /** Desorganização da defesa adversária (0–1). */
  tacticalDisorg01?: number;
  rng: RngDraw;
}

export function resolveShotExecutionTier(input: ShotTierInput): {
  tier: ActionExecutionTier;
  impact01: ExecutionImpact01;
} {
  const {
    outcome,
    rollOnTarget,
    pOnTarget,
    rollBranch,
    xGOnTarget,
    carrier,
    press01,
    tacticalDisorg01 = 0,
    rng,
  } = input;

  if (outcome === 'miss') {
    const gap = rollOnTarget - pOnTarget;
    if (gap > 0.22) return { tier: 'critical_error', impact01: -0.75 };
    if (gap > 0.08) return { tier: 'error', impact01: -0.42 };
    return { tier: 'normal', impact01: -0.2 };
  }

  const contact = (pOnTarget - rollOnTarget) / Math.max(pOnTarget, 0.08);
  const pCrit = computeCriticalHitProbShot(carrier, press01, tacticalDisorg01);

  if (outcome === 'goal') {
    if (contact > 0.45 && rng.nextUnit() < pCrit + 0.012) {
      return { tier: 'critical_hit', impact01: 1 };
    }
    if (rollBranch < xGOnTarget * 0.55) return { tier: 'excellent', impact01: 0.92 };
    return { tier: 'good', impact01: 0.78 };
  }

  if (outcome === 'save') {
    if (rng.nextUnit() < pCrit * 0.85 && contact > 0.35) {
      return { tier: 'critical_hit', impact01: 0.55 };
    }
    return contact > 0.3 ? { tier: 'good', impact01: 0.35 } : { tier: 'normal', impact01: 0.12 };
  }

  if (outcome === 'block') {
    return contact > 0.28 ? { tier: 'good', impact01: 0.22 } : { tier: 'normal', impact01: 0.05 };
  }

  return { tier: 'normal', impact01: 0 };
}

export interface DribbleTierInput {
  success: boolean;
  roll: number;
  pSuccess: number;
  carrier: AgentSnapshot;
  pressure01: number;
  rng: RngDraw;
}

export function resolveDribbleExecutionTier(input: DribbleTierInput): {
  tier: ActionExecutionTier;
  impact01: ExecutionImpact01;
} {
  const { success, roll, pSuccess, carrier, pressure01, rng } = input;
  if (!success) {
    const gap = roll - pSuccess;
    if (gap > 0.25) return { tier: 'critical_error', impact01: -0.82 };
    if (gap > 0.1) return { tier: 'error', impact01: -0.45 };
    return { tier: 'normal', impact01: -0.2 };
  }
  const margin = (pSuccess - roll) / Math.max(pSuccess, 0.08);
  const pCrit = computeCriticalHitProbDribble(carrier, pressure01);
  if (margin > 0.38 && rng.nextUnit() < pCrit) {
    return { tier: 'critical_hit', impact01: 0.9 };
  }
  if (margin > 0.48) return { tier: 'excellent', impact01: 0.68 };
  if (margin > 0.22) return { tier: 'good', impact01: 0.42 };
  return { tier: 'normal', impact01: 0.2 };
}

export interface CrossTierInput {
  success: boolean;
  roll: number;
  pSuccess: number;
  carrier: AgentSnapshot;
  pressure01: number;
  rng: RngDraw;
}

export function resolveCrossExecutionTier(input: CrossTierInput): {
  tier: ActionExecutionTier;
  impact01: ExecutionImpact01;
} {
  const { success, roll, pSuccess, carrier, pressure01, rng } = input;
  if (!success) {
    const gap = roll - pSuccess;
    if (gap > 0.22) return { tier: 'critical_error', impact01: -0.55 };
    return { tier: 'error', impact01: -0.32 };
  }
  const margin = (pSuccess - roll) / Math.max(pSuccess, 0.08);
  const pCrit = computeCriticalHitProbPassLike(carrier, pressure01, 0);
  if (margin > 0.35 && rng.nextUnit() < pCrit * 0.92) {
    return { tier: 'critical_hit', impact01: 0.85 };
  }
  if (margin > 0.42) return { tier: 'excellent', impact01: 0.62 };
  if (margin > 0.2) return { tier: 'good', impact01: 0.38 };
  return { tier: 'normal', impact01: 0.15 };
}

export interface TackleTierInput {
  defender: AgentSnapshot;
  carrier: AgentSnapshot;
  rng: RngDraw;
}

export function resolveTackleExecutionTier(input: TackleTierInput): {
  tier: ActionExecutionTier;
  impact01: ExecutionImpact01;
} {
  const { defender, carrier, rng } = input;
  const carrSkill = carrier.drible / 100 + carrier.velocidade / 200;
  const pCrit = computeCriticalHitProbDefensive(defender, carrSkill);
  if (rng.nextUnit() < pCrit) {
    return { tier: 'critical_hit', impact01: 0.88 };
  }
  if (rng.nextUnit() < 0.22 + defender.marcacao / 400) {
    return { tier: 'excellent', impact01: 0.55 };
  }
  return { tier: 'good', impact01: 0.38 };
}
