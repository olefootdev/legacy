/**
 * test2d — Team Shape: derives collective "intention" from game state.
 *
 * Each TeamIntention maps to numeric modifiers that shift the formation
 * (line height, width, compactness, pressing aggression).
 * Consumed by `tacticalPositioning.ts` to move players intelligently.
 *
 * Zona da bola (def/mid/att) vem de `tacticalBallZoneForTeam` em `fieldZones`
 * (terços por profundidade desde a baliza), não de faixas fixas no % do motor.
 */
import type { PossessionSide } from '@/engine/types';
import type { SpiritPhase } from '@/gamespirit/spiritSnapshotTypes';

export type TeamIntention =
  | 'build_low'
  | 'progress'
  | 'attack_wide'
  | 'attack_central'
  | 'press_high'
  | 'mid_block'
  | 'low_block'
  | 'transition_attack'
  | 'transition_defend';

export interface ShapeModifiers {
  /** 0 = deep, 1 = very high defensive line */
  lineHeight: number;
  /** 0 = narrow, 1 = maximum width */
  width: number;
  /** 0 = stretched, 1 = very compact vertical distance between lines */
  compactness: number;
  /** 0 = passive, 1 = full press */
  pressTrigger: number;
}

export type BallZoneSimple = 'def' | 'mid' | 'att';

const SHAPE_TABLE: Record<TeamIntention, ShapeModifiers> = {
  build_low:          { lineHeight: 0.25, width: 0.70, compactness: 0.55, pressTrigger: 0.10 },
  progress:           { lineHeight: 0.47, width: 0.60, compactness: 0.50, pressTrigger: 0.20 },
  // Invasão dosada — movimento muito grande quebra a coerência entre passe e destino.
  attack_wide:        { lineHeight: 0.70, width: 0.88, compactness: 0.38, pressTrigger: 0.15 },
  attack_central:     { lineHeight: 0.72, width: 0.46, compactness: 0.42, pressTrigger: 0.20 },
  press_high:         { lineHeight: 0.80, width: 0.55, compactness: 0.75, pressTrigger: 0.90 },
  mid_block:          { lineHeight: 0.40, width: 0.50, compactness: 0.70, pressTrigger: 0.45 },
  low_block:          { lineHeight: 0.20, width: 0.40, compactness: 0.80, pressTrigger: 0.15 },
  transition_attack:  { lineHeight: 0.62, width: 0.65, compactness: 0.32, pressTrigger: 0.10 },
  transition_defend:  { lineHeight: 0.30, width: 0.45, compactness: 0.70, pressTrigger: 0.60 },
};

export function deriveTeamIntention(
  hasBall: boolean,
  ballZone: BallZoneSimple,
  spiritPhase: SpiritPhase | undefined,
  actionKind: string | undefined,
  possession: PossessionSide,
  side: 'home' | 'away',
  tacticalMentality: number,
  ballSubzone: string | null = null,
): TeamIntention {
  const isMySide = side === possession;
  const isOverlay = spiritPhase === 'celebration_goal' || spiritPhase === 'penalty';

  if (isOverlay) return 'mid_block';

  if (spiritPhase === 'buildup_gk') {
    return isMySide ? 'build_low' : 'mid_block';
  }

  // Subzone override — granular SmartField zone takes priority over 3-bucket ballZone
  if (ballSubzone && isMySide && hasBall) {
    if (ballSubzone === 'BOX_CENTER' || ballSubzone === 'SIX_YARD_CENTER') return 'attack_central';
    if (ballSubzone === 'CREATION_LEFT' || ballSubzone === 'BOX_LEFT') return 'attack_wide';
    if (ballSubzone === 'CREATION_RIGHT' || ballSubzone === 'BOX_RIGHT') return 'attack_wide';
    if (ballSubzone === 'RECOVERY_CENTER' || ballSubzone === 'RECOVERY_LEFT' || ballSubzone === 'RECOVERY_RIGHT') return 'low_block';
    if (ballSubzone === 'PRESS_CENTER' || ballSubzone === 'PRESS_LEFT' || ballSubzone === 'PRESS_RIGHT') return 'press_high';
  }

  if (isMySide && hasBall) {
    if (actionKind === 'counter') return 'transition_attack';
    if (ballZone === 'def') return 'build_low';
    if (ballZone === 'mid') {
      return 'progress';
    }
    if (ballZone === 'att') {
      return actionKind === 'shot' ? 'attack_central' : 'attack_wide';
    }
    return 'progress';
  }

  // Defending: ballZone is from THIS team's perspective.
  // 'def' = ball near our goal (danger, drop deep).
  // 'att' = ball near opponent's goal (press high, opponent building from back).
  if (!isMySide) {
    const highPress = tacticalMentality > 70;
    if (ballZone === 'def') return 'low_block';
    if (ballZone === 'mid') return highPress ? 'press_high' : 'mid_block';
    if (ballZone === 'att') return highPress ? 'press_high' : 'mid_block';
    return 'mid_block';
  }

  return 'mid_block';
}

export function getShapeModifiers(intention: TeamIntention, formation?: import('@/match-engine/types').FormationSchemeId): ShapeModifiers {
  const base = SHAPE_TABLE[intention];
  if (!formation) return base;
  const bias = FORMATION_SHAPE_BIAS[formation];
  if (!bias) return base;
  return {
    lineHeight: clamp01(base.lineHeight + bias.lineHeight),
    width: clamp01(base.width + bias.width),
    compactness: clamp01(base.compactness + bias.compactness),
    pressTrigger: clamp01(base.pressTrigger + bias.pressTrigger),
  };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Formation-specific biases applied on top of the base SHAPE_TABLE.
 * Values are additive nudges (±) — small enough to flavor, not override.
 */
const FORMATION_SHAPE_BIAS: Partial<Record<import('@/match-engine/types').FormationSchemeId, ShapeModifiers>> = {
  '4-4-2': { lineHeight: 0, width: 0.05, compactness: 0.05, pressTrigger: 0 },
  '4-2-3-1': { lineHeight: 0.03, width: -0.03, compactness: 0.04, pressTrigger: 0.03 },
  '3-5-2': { lineHeight: -0.04, width: 0.08, compactness: 0.06, pressTrigger: -0.03 },
  '4-5-1': { lineHeight: -0.06, width: 0.04, compactness: 0.08, pressTrigger: -0.05 },
  '5-3-2': { lineHeight: -0.08, width: -0.04, compactness: 0.10, pressTrigger: -0.06 },
  '3-4-3': { lineHeight: 0.05, width: 0.10, compactness: -0.04, pressTrigger: 0.05 },
  '4-3-3': { lineHeight: 0, width: 0, compactness: 0, pressTrigger: 0 },
};

// ── Smartfield phase mapping ────────────────────────────────────────
// Maps test2d TeamIntention → Python-aligned SfTeamPhase for the
// smartfield bridge (phase-aware radius, zone activation, recovery).

import type { SfTeamPhase } from '@/smartfield/smartfieldBridge';

const INTENTION_TO_SF_PHASE: Record<TeamIntention, SfTeamPhase> = {
  build_low: 'organized_attack',
  progress: 'organized_attack',
  attack_wide: 'organized_attack',
  attack_central: 'organized_attack',
  press_high: 'high_press',
  mid_block: 'mid_block',
  low_block: 'low_block',
  transition_attack: 'offensive_transition',
  transition_defend: 'defensive_transition',
};

export function sfPhaseFromIntention(intention: TeamIntention): SfTeamPhase {
  return INTENTION_TO_SF_PHASE[intention];
}

// ── Voice command → collective intention override ───────────────────
// Comandos coletivos do treinador sobrepõem a intenção derivada do
// contexto. O peso é pela obediência média efetiva dos jogadores sob
// o comando — se só 40% do time topou, aplicamos mistura parcial.

import type { PendingCommand, VoiceIntent } from '@/voiceCommand/types';
import { isCommandActive } from '@/voiceCommand/commandQueue';

const VOICE_TO_INTENTION: Partial<Record<VoiceIntent, TeamIntention>> = {
  team_press_high: 'press_high',
  forwards_press_defenders: 'press_high',
  team_high_line: 'press_high',
  team_retreat: 'low_block',
  team_hold_possession: 'build_low',
  pedal_to_metal: 'transition_attack',
  stretch_team: 'attack_wide',
  break_line: 'attack_wide',
  run_behind: 'attack_wide',
  midfielders_compact: 'mid_block',
};

export interface VoiceIntentionOverride {
  intention: TeamIntention;
  /** 0..1 — peso do override sobre a intenção derivada. */
  weight: number;
}

/**
 * Varre comandos ativos da equipa e, se houver intent coletivo dominante,
 * devolve override ponderado pela obediência efetiva média.
 */
export function voiceIntentionOverride(
  voiceCommands: Record<string, PendingCommand> | undefined,
  nowMs: number,
): VoiceIntentionOverride | null {
  if (!voiceCommands) return null;
  const tally = new Map<TeamIntention, { count: number; obeSum: number }>();
  for (const cmd of Object.values(voiceCommands)) {
    if (!isCommandActive(cmd, nowMs)) continue;
    const mapped = VOICE_TO_INTENTION[cmd.intent];
    if (!mapped) continue;
    const entry = tally.get(mapped) ?? { count: 0, obeSum: 0 };
    entry.count++;
    entry.obeSum += Math.max(0, Math.min(100, cmd.effectiveObedience));
    tally.set(mapped, entry);
  }
  if (tally.size === 0) return null;
  let best: TeamIntention | null = null;
  let bestCount = 0;
  let bestAvgObe = 0;
  for (const [intent, entry] of tally) {
    if (entry.count > bestCount) {
      best = intent;
      bestCount = entry.count;
      bestAvgObe = entry.obeSum / entry.count;
    }
  }
  if (!best) return null;
  // Peso: fração de jogadores sob comando × obediência média.
  // 5 jogadores com 80% de obed = ~0.38 de peso → mistura forte, não trava tudo.
  const coverage = Math.min(1, bestCount / 11);
  const weight = coverage * (bestAvgObe / 100);
  return { intention: best, weight };
}

/** Mistura dois ShapeModifiers com peso [0..1] no segundo. */
export function blendShape(a: ShapeModifiers, b: ShapeModifiers, w: number): ShapeModifiers {
  const t = Math.max(0, Math.min(1, w));
  return {
    lineHeight: a.lineHeight * (1 - t) + b.lineHeight * t,
    width: a.width * (1 - t) + b.width * t,
    compactness: a.compactness * (1 - t) + b.compactness * t,
    pressTrigger: a.pressTrigger * (1 - t) + b.pressTrigger * t,
  };
}
