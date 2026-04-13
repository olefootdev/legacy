/**
 * test2d — Ball Trajectory
 *
 * Instead of the ball teleporting to Spirit-determined positions,
 * we store origin/destination and interpolate smoothly.
 * The viewer reads the trajectory state and renders the ball
 * along the path with appropriate speed per action type.
 */
import type { PitchPoint } from '@/engine/types';

export type BallTrajectoryKind =
  | 'pass_short'
  | 'pass_long'
  | 'cross'
  | 'shot'
  | 'carry'
  | 'loose'
  | 'gk_restart'
  | 'kickoff';

export interface BallTrajectoryState {
  from: PitchPoint;
  to: PitchPoint;
  kind: BallTrajectoryKind;
  /** 0–1 how far along the trajectory the ball has progressed. */
  progress01: number;
}

/** How much progress (0–1) each tick advances per trajectory kind. */
const SPEED_TABLE: Record<BallTrajectoryKind, number> = {
  pass_short: 0.85,
  pass_long: 0.55,
  cross: 0.60,
  shot: 0.90,
  carry: 0.40,
  loose: 0.70,
  gk_restart: 0.45,
  kickoff: 0.30,
};

/**
 * Determine what kind of ball trajectory this tick represents,
 * based on Spirit action and ball displacement.
 */
export function inferTrajectoryKind(
  actionKind: string | undefined,
  ballFrom: PitchPoint,
  ballTo: PitchPoint,
  possessionChanged: boolean,
): BallTrajectoryKind {
  const dx = Math.abs(ballTo.x - ballFrom.x);
  const dy = Math.abs(ballTo.y - ballFrom.y);
  const totalDist = Math.hypot(dx, dy);

  if (actionKind === 'shot') return 'shot';
  if (actionKind === 'counter') return 'pass_long';
  if (actionKind === 'clear') return 'pass_long';

  if (possessionChanged) return 'loose';

  if (actionKind === 'progress') {
    if (totalDist > 25) return 'pass_long';
    if (dy > dx * 1.5 && totalDist > 12) return 'cross';
    return totalDist > 10 ? 'pass_short' : 'carry';
  }

  if (actionKind === 'recycle') {
    return totalDist > 15 ? 'pass_short' : 'carry';
  }

  // Default: infer from distance
  if (totalDist < 6) return 'carry';
  if (totalDist > 30) return 'pass_long';
  return 'pass_short';
}

/**
 * Create or advance a ball trajectory for the current tick.
 */
export function computeBallTrajectory(
  prev: BallTrajectoryState | undefined,
  ballFrom: PitchPoint,
  ballTo: PitchPoint,
  actionKind: string | undefined,
  possessionChanged: boolean,
): BallTrajectoryState {
  const totalDist = Math.hypot(ballTo.x - ballFrom.x, ballTo.y - ballFrom.y);
  const isNewDestination = totalDist > 2;

  if (isNewDestination || !prev) {
    const kind = inferTrajectoryKind(actionKind, ballFrom, ballTo, possessionChanged);
    return {
      from: { ...ballFrom },
      to: { ...ballTo },
      kind,
      progress01: SPEED_TABLE[kind],
    };
  }

  // Same destination — advance progress
  const speed = SPEED_TABLE[prev.kind];
  return {
    ...prev,
    progress01: Math.min(1, prev.progress01 + speed * 0.5),
  };
}

/**
 * Interpolate ball position from trajectory state.
 * Used by the viewer to get smooth ball position between ticks.
 */
export function interpolateBallPosition(traj: BallTrajectoryState): PitchPoint {
  const t = traj.progress01;
  return {
    x: traj.from.x + (traj.to.x - traj.from.x) * t,
    y: traj.from.y + (traj.to.y - traj.from.y) * t,
  };
}
