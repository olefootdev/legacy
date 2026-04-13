/**
 * Formato unificado de resultado pós-execução no motor tático.
 * Usado no encadeamento DECISÃO → AÇÃO → RESULTADO → próxima decisão.
 */
import type { ActionExecutionTier } from '@/match/actionExecutionTier';

export type MotorActionCanonicalKind =
  | 'pass'
  | 'control'
  | 'dribble'
  | 'shot'
  | 'defense'
  | 'marking'
  | 'positioning'
  | 'off_ball_movement'
  | 'pressure'
  | 'decision'
  | 'transition';

export interface MotorNextStateModifier {
  /** Duração sugerida de desorganização defensiva no lado adversário (s). */
  defensiveDisorgBoostSec: number;
  /** Janela de boost de execução/decisão para beneficiário (s). */
  offensiveExecutionBoostSec: number;
  /** Multiplicador sugerido para deltas de confiança aplicados no loop. */
  confidenceDeltaScale: number;
  /** -1 a +1 — ritmo / verticalidade da jogada. */
  tempoShift01: number;
  /** Pico momentâneo de pressão imposta (0–1). */
  pressureSpike01: number;
}

export interface MotorActionOutcome {
  result_type: MotorActionCanonicalKind;
  impact_value: number;
  execution_tier: ActionExecutionTier;
  next_state_modifier: MotorNextStateModifier;
}

function modifiersFromExecution(
  kind: MotorActionCanonicalKind,
  tier: ActionExecutionTier,
  impact01: number,
): MotorNextStateModifier {
  const base: MotorNextStateModifier = {
    defensiveDisorgBoostSec: 0,
    offensiveExecutionBoostSec: 0,
    confidenceDeltaScale: 1,
    tempoShift01: 0,
    pressureSpike01: 0,
  };

  if (tier === 'critical_hit') {
    if (kind === 'pass') {
      base.defensiveDisorgBoostSec = 2.75;
      base.offensiveExecutionBoostSec = 2.35;
      base.tempoShift01 = 0.52;
      base.pressureSpike01 = 0.38;
      base.confidenceDeltaScale = 1.12;
    } else if (kind === 'dribble') {
      base.defensiveDisorgBoostSec = 1.95;
      base.offensiveExecutionBoostSec = 1.85;
      base.tempoShift01 = 0.46;
      base.pressureSpike01 = 0.4;
      base.confidenceDeltaScale = 1.1;
    } else if (kind === 'shot') {
      base.tempoShift01 = 0.58;
      base.pressureSpike01 = 0.48;
      base.confidenceDeltaScale = 1.14;
    } else if (kind === 'defense') {
      base.pressureSpike01 = 0.35;
      base.tempoShift01 = -0.22;
      base.confidenceDeltaScale = 1.08;
    }
    return base;
  }

  if (tier === 'excellent') {
    base.tempoShift01 = kind === 'pass' ? 0.24 : kind === 'dribble' ? 0.2 : 0.14;
    base.offensiveExecutionBoostSec = kind === 'pass' ? 0.9 : kind === 'dribble' ? 0.65 : 0.4;
    base.pressureSpike01 = Math.max(0, impact01) * 0.22;
    return base;
  }

  if (tier === 'good') {
    base.offensiveExecutionBoostSec = kind === 'pass' ? 0.45 : 0.28;
    base.tempoShift01 = 0.1;
    return base;
  }

  if (tier === 'critical_error' || tier === 'error') {
    base.tempoShift01 = -0.18;
    base.pressureSpike01 = 0.15;
    base.confidenceDeltaScale = 0.92;
  }

  return base;
}

export function buildMotorActionOutcome(
  kind: MotorActionCanonicalKind,
  tier: ActionExecutionTier,
  impact01: number,
): MotorActionOutcome {
  return {
    result_type: kind,
    impact_value: impact01,
    execution_tier: tier,
    next_state_modifier: modifiersFromExecution(kind, tier, impact01),
  };
}

// ---------------------------------------------------------------------------
// Telemetria (SimMatchState / GameSpirit opcional)
// ---------------------------------------------------------------------------

export type MotorTelemetryPhaseTag =
  | 'shot'
  | 'gk_save'
  | 'block'
  | 'tackle'
  | 'intercept'
  | 'pass';

export interface MotorTelemetryRecord {
  simTime: number;
  minute: number;
  actorId: string;
  targetId?: string;
  phaseTag: MotorTelemetryPhaseTag;
  outcome: MotorActionOutcome;
}

export const MOTOR_TELEMETRY_LOG_MAX = 48;

export function pushMotorTelemetryRecord(log: MotorTelemetryRecord[], rec: MotorTelemetryRecord): void {
  log.unshift(rec);
  if (log.length > MOTOR_TELEMETRY_LOG_MAX) log.pop();
}
