import type { PossessionSide } from '@/engine/types';

/** Structural reorganisation modes (extensible for free kick / indirect later). */
export type StructuralEventType =
  | 'goal_restart'
  | 'kickoff'
  | 'goal_kick'
  | 'throw_in'
  | 'corner_kick';

/** Lifecycle of a structural event inside the reorganisation system. */
export type StructuralPhase = 'repositioning' | 'ready' | 'idle';

export interface StructuralConstraints {
  /** Minimum distance opponents must keep from ball at restarts (m). */
  minOpponentDist: number;
}

export interface StructuralEventState {
  type: StructuralEventType;
  /** Team that will restart play (e.g. after goal: conceding side kicks off). */
  restartingSide: PossessionSide;
  phase: StructuralPhase;
  ballAnchor: { x: number; z: number };
  constraints: StructuralConstraints;
  /** Seconds in current phase. */
  elapsed: number;
  /** Seconds before phase advances from repositioning to ready (set-piece). */
  repositionDuration: number;
}

export const DEFAULT_GOAL_RESTART_REPOSITION_SEC = 2;
export const DEFAULT_SET_PIECE_REPOSITION_SEC = 3;
export const MIN_DIST_GOAL_KICK_M = 9.15;
export const MIN_DIST_CORNER_THROW_M = 9.15;

export function defaultConstraintsForEvent(type: StructuralEventType): StructuralConstraints {
  switch (type) {
    case 'goal_kick':
      return { minOpponentDist: MIN_DIST_GOAL_KICK_M };
    case 'corner_kick':
    case 'throw_in':
      return { minOpponentDist: MIN_DIST_CORNER_THROW_M };
    default:
      return { minOpponentDist: 0 };
  }
}
