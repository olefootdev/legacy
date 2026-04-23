import type { PossessionSide } from '@/engine/types';
import type { MatchTruthPhase } from '@/bridge/matchTruthSchema';
import { FORMATION_BASES } from '@/match-engine/formations/catalog';
import type { FormationSchemeId } from '@/match-engine/types';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import { kickoffWorldXZ } from '@/engine/kickoffFormationLayout';
import {
  clampWorldOutsidePenaltyAreaAtEnd,
  defendingPenaltyEndForTeam,
  goalKickEndFromBallPosition,
  type MatchHalf,
} from '@/match/fieldZones';
import {
  DEFAULT_GOAL_RESTART_REPOSITION_SEC,
  DEFAULT_SET_PIECE_REPOSITION_SEC,
  type StructuralEventState,
  type StructuralEventType,
  defaultConstraintsForEvent,
} from './StructuralEvent';
import { applyFormationPreset, buildSetPieceTeamMaps } from '@/formation/presets';

/** In the 2nd half teams swap ends, so the effective side for positioning is inverted. */
function effectiveSideForHalf(side: 'home' | 'away', half: MatchHalf): 'home' | 'away' {
  if (half === 2) return side === 'home' ? 'away' : 'home';
  return side;
}

export type StructuralTargetMap = Map<string, { x: number; z: number }>;

const DEFAULT_SCHEME: FormationSchemeId = '4-3-3';

/**
 * Kickoff-constrained anchors: every player stays in their own half,
 * matching the layout used at the start of the match (IFAB kickoff positioning).
 */
function kickoffAnchorsForSide(
  side: 'home' | 'away',
  scheme: FormationSchemeId = DEFAULT_SCHEME,
  half: MatchHalf = 1,
): Map<string, { x: number; z: number }> {
  const eSide = effectiveSideForHalf(side, half);
  const bases = FORMATION_BASES[scheme];
  const out = new Map<string, { x: number; z: number }>();
  if (!bases) return out;
  for (const slot of Object.keys(bases)) {
    out.set(slot, kickoffWorldXZ(eSide, scheme, slot));
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
export type GoalRestartVariant = 'kickoff_after_goal' | 'goal_kick_wide';

export class StructuralReorganizationSystem {
  private goalRestart: {
    restartingSide: PossessionSide;
    elapsed: number;
    variant: GoalRestartVariant;
  } | null = null;
  private setPiece: {
    phase: Extract<MatchTruthPhase, 'throw_in' | 'corner_kick' | 'goal_kick'>;
    restartingSide: PossessionSide;
    ballX: number;
    ballZ: number;
    elapsed: number;
  } | null = null;

  /**
   * Reinício estrutural: golo (formações para pontapé de saída no meio-campo) ou
   * remate para fora (`goal_kick_wide` — só bandeira para o sim; afastamento local no loop).
   */
  beginGoalRestart(
    restartingSide: PossessionSide,
    variant: GoalRestartVariant = 'kickoff_after_goal',
  ): void {
    this.goalRestart = { restartingSide, elapsed: 0, variant };
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

  /** Remate para fora / saída com GR: variante distinta do pontapé de saída após golo. */
  isGoalKickWideRestart(): boolean {
    return this.goalRestart !== null && this.goalRestart.variant === 'goal_kick_wide';
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
   * Full per-player targets for goal restart: both teams to kickoff formation in own half.
   * Em `goal_kick_wide` (remate para fora / bola com o GR): não há mapa estrutural — o
   * TacticalSimLoop só pede um afastamento curto à volta da bola para não atravessar o campo.
   */
  getGoalRestartPlayerTargets(
    homeAgents: { id: string; slotId: string; side: PossessionSide; role: string }[],
    awayAgents: { id: string; slotId: string; side: PossessionSide; role: string }[],
    half: MatchHalf,
    homeScheme: FormationSchemeId = DEFAULT_SCHEME,
    awayScheme: FormationSchemeId = DEFAULT_SCHEME,
  ): StructuralTargetMap {
    const rs = this.goalRestart;
    if (!rs) return new Map();
    if (rs.variant === 'goal_kick_wide') {
      return new Map();
    }

    const homeSlots = kickoffAnchorsForSide('home', homeScheme, half);
    const awaySlots = kickoffAnchorsForSide('away', awayScheme, half);

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
    half: MatchHalf,
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

    if (phase === 'goal_kick') {
      const kickEnd =
        goalKickEndFromBallPosition(ballX, ballZ) ?? defendingPenaltyEndForTeam(restartingSide, half);
      for (const ag of homeAgents) {
        const pos = m.get(ag.id);
        if (!pos) continue;
        if (ag.slotId === 'gol') continue;
        m.set(ag.id, clampWorldOutsidePenaltyAreaAtEnd(pos.x, pos.z, kickEnd));
      }
      for (const ag of awayAgents) {
        const pos = m.get(ag.id);
        if (!pos) continue;
        if (ag.slotId === 'gol') continue;
        m.set(ag.id, clampWorldOutsidePenaltyAreaAtEnd(pos.x, pos.z, kickEnd));
      }
    }

    return m;
  }
}
