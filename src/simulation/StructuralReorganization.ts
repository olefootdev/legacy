import type { PossessionSide } from '@/engine/types';
import type { MatchTruthPhase } from '@/bridge/matchTruthSchema';
import { slotToWorld } from '@/formation/layout433';
import { FORMATION_BASES } from '@/match-engine/formations/catalog';
import type { FormationSchemeId } from '@/match-engine/types';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import {
  DEFAULT_GOAL_RESTART_REPOSITION_SEC,
  DEFAULT_SET_PIECE_REPOSITION_SEC,
  type StructuralEventState,
  type StructuralEventType,
  defaultConstraintsForEvent,
} from './StructuralEvent';
import { applyFormationPreset, buildSetPieceTeamMaps } from '@/formation/presets';

export type StructuralTargetMap = Map<string, { x: number; z: number }>;

const DEFAULT_SCHEME: FormationSchemeId = '4-3-3';

function formationAnchorsForSide(
  side: 'home' | 'away',
  scheme: FormationSchemeId = DEFAULT_SCHEME,
): Map<string, { x: number; z: number }> {
  const bases = FORMATION_BASES[scheme];
  const out = new Map<string, { x: number; z: number }>();
  if (!bases) return out;
  for (const [slot, base] of Object.entries(bases)) {
    out.set(slot, slotToWorld(side, { nx: base.nx, nz: base.nz }));
  }
  return out;
}

/** Per-player targets from slot-keyed map + agent list. */
function mapSlotsToPlayerIds(
  agents: { id: string; slotId: string }[],
  bySlot: Map<string, { x: number; z: number }>,
): StructuralTargetMap {
  const m = new Map<string, { x: number; z: number }>();
  for (const ag of agents) {
    const p = bySlot.get(ag.slotId);
    if (p) m.set(ag.id, p);
  }
  return m;
}

/**
 * Structural reorganisation: formation locks for goal restart and blended set-piece targets.
 * Does not move agents directly — TacticalSimLoop feeds targets into setArriveTarget.
 */
export class StructuralReorganizationSystem {
  private goalRestart: { restartingSide: PossessionSide; elapsed: number } | null = null;
  private setPiece: {
    phase: Extract<MatchTruthPhase, 'throw_in' | 'corner_kick' | 'goal_kick'>;
    restartingSide: PossessionSide;
    ballX: number;
    ballZ: number;
    elapsed: number;
  } | null = null;

  /** Call when a goal is scored — players walk to kickoff formation until FSM leaves goal_restart. */
  beginGoalRestart(restartingSide: PossessionSide): void {
    this.goalRestart = { restartingSide, elapsed: 0 };
  }

  /** Call when UI triggers a set-piece preset — merged home/away maps for reposition window. */
  beginSetPiece(
    phase: Extract<MatchTruthPhase, 'throw_in' | 'corner_kick' | 'goal_kick'>,
    restartingSide: PossessionSide,
    ballX: number,
    ballZ: number,
  ): void {
    this.setPiece = { phase, restartingSide, ballX, ballZ, elapsed: 0 };
  }

  update(dt: number): void {
    if (this.goalRestart) this.goalRestart.elapsed += dt;
    if (this.setPiece) {
      this.setPiece.elapsed += dt;
      if (this.setPiece.elapsed >= DEFAULT_SET_PIECE_REPOSITION_SEC) {
        this.setPiece = null;
      }
    }
  }

  clearGoalRestart(): void {
    this.goalRestart = null;
  }

  /** End set-piece structural override (e.g. user pressed “bola viva”). */
  clearSetPieceStructural(): void {
    this.setPiece = null;
  }

  hasGoalRestart(): boolean {
    return this.goalRestart !== null;
  }

  /** True while set-piece structural blend is driving targets (first ~3s). */
  hasSetPieceStructural(): boolean {
    return this.setPiece !== null;
  }

  /** Snapshot for debug / UI. */
  snapshotGoalEvent(): StructuralEventState | null {
    if (!this.goalRestart) return null;
    return {
      type: 'goal_restart',
      restartingSide: this.goalRestart.restartingSide,
      phase: 'repositioning',
      ballAnchor: { x: FIELD_LENGTH / 2, z: FIELD_WIDTH / 2 },
      constraints: defaultConstraintsForEvent('goal_restart'),
      elapsed: this.goalRestart.elapsed,
      repositionDuration: DEFAULT_GOAL_RESTART_REPOSITION_SEC,
    };
  }

  /**
   * Full per-player targets for goal restart: both teams to catalogue formation on own half.
   */
  getGoalRestartPlayerTargets(
    homeAgents: { id: string; slotId: string }[],
    awayAgents: { id: string; slotId: string }[],
  ): StructuralTargetMap {
    const homeSlots = formationAnchorsForSide('home');
    const awaySlots = formationAnchorsForSide('away');
    const m = new Map<string, { x: number; z: number }>();
    for (const [id, pos] of mapSlotsToPlayerIds(homeAgents, homeSlots)) m.set(id, pos);
    for (const [id, pos] of mapSlotsToPlayerIds(awayAgents, awaySlots)) m.set(id, pos);
    return m;
  }

  /**
   * During set-piece structural window: restarting team + opponents with min-distance rule.
   */
  getSetPiecePlayerTargets(
    homeAgents: { id: string; slotId: string }[],
    awayAgents: { id: string; slotId: string }[],
  ): StructuralTargetMap | null {
    if (!this.setPiece) return null;
    const { phase, restartingSide, ballX, ballZ } = this.setPiece;
    const restartingPreset = applyFormationPreset(phase, ballX, ballZ);
    const { home: homeMap, away: awayMap } = buildSetPieceTeamMaps(
      phase,
      ballX,
      ballZ,
      restartingSide,
      restartingPreset,
    );
    const m = new Map<string, { x: number; z: number }>();
    for (const [id, pos] of mapSlotsToPlayerIds(homeAgents, homeMap)) m.set(id, pos);
    for (const [id, pos] of mapSlotsToPlayerIds(awayAgents, awayMap)) m.set(id, pos);
    return m;
  }
}
