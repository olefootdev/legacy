/**
 * test2d — Team Shape: derives collective "intention" from game state.
 *
 * Each TeamIntention maps to numeric modifiers that shift the formation
 * (line height, width, compactness, pressing aggression).
 * Consumed by `tacticalPositioning.ts` to move players intelligently.
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
  progress:           { lineHeight: 0.45, width: 0.60, compactness: 0.50, pressTrigger: 0.20 },
  attack_wide:        { lineHeight: 0.65, width: 0.90, compactness: 0.35, pressTrigger: 0.15 },
  attack_central:     { lineHeight: 0.60, width: 0.50, compactness: 0.40, pressTrigger: 0.20 },
  press_high:         { lineHeight: 0.80, width: 0.55, compactness: 0.75, pressTrigger: 0.90 },
  mid_block:          { lineHeight: 0.40, width: 0.50, compactness: 0.70, pressTrigger: 0.45 },
  low_block:          { lineHeight: 0.20, width: 0.40, compactness: 0.80, pressTrigger: 0.15 },
  transition_attack:  { lineHeight: 0.55, width: 0.65, compactness: 0.30, pressTrigger: 0.10 },
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
): TeamIntention {
  const isMySide = side === possession;
  const isOverlay = spiritPhase === 'celebration_goal' || spiritPhase === 'penalty';

  if (isOverlay) return 'mid_block';

  if (spiritPhase === 'buildup_gk') {
    return isMySide ? 'build_low' : 'mid_block';
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

export function getShapeModifiers(intention: TeamIntention): ShapeModifiers {
  return SHAPE_TABLE[intention];
}

/**
 * Derive ball zone in the simple 3-zone system from engine 0-100 x coordinate.
 * Home attacks toward +x, so high x = attacking for home.
 */
export function ballZoneFromEngineX(x: number, side: 'home' | 'away'): BallZoneSimple {
  const nx = x / 100;
  if (side === 'home') {
    if (nx < 0.35) return 'def';
    if (nx < 0.65) return 'mid';
    return 'att';
  }
  // Away attacks toward -x
  if (nx > 0.65) return 'def';
  if (nx > 0.35) return 'mid';
  return 'att';
}
