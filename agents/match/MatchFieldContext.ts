/**
 * /agents/match/MatchFieldContext.ts
 *
 * Estado vivo do campo — 3 camadas de estado conforme AP-FIELD_CONTEXT.md.
 *
 * REGRA CRÍTICA (AP-RULES.md):
 *   updateTick() é chamado UMA ÚNICA VEZ por tick, antes de todos os agentes.
 *   Cada agente chama queryForAgent() individualmente — o estado já está calculado.
 *
 * Camada 1 — FieldStructure: imutável, carrega uma vez antes do tick 0.
 * Camada 2 — PhaseFieldState: atualiza quando a posse muda.
 * Camada 3 — LiveFieldState: atualiza a cada tick.
 *
 * Coordinate system (x=depth, y=width — matches /agents/positions/*):
 *   x: 0=home goal → 100=away goal
 *   y: 0=left → 100=right
 */

import type { Vec2, PositionId } from '../core/AgentTypes';
import type { PlayerAgentState } from '../core/PlayerAgent';
import type { FieldZone } from '../fieldKnowledge/FieldKnowledge';
import { FIELD_ZONES, getZoneIdForPoint } from '../fieldKnowledge/FieldZones';
import { getTerritory } from '../fieldKnowledge/PositionTerritories';
import {
  isPointInsidePrimaryTerritory,
  isPointInsideSupportTerritory,
  isPointForbidden,
  shouldRecoverPosition,
  getRecoveryTarget,
  clampTargetToAllowedTerritory,
} from '../fieldKnowledge/TerritoryRules';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GamePhase =
  | 'POSSESSION'          // this team has the ball
  | 'DEFENDING'           // opponent has the ball
  | 'TRANSITION_ATTACK'   // just won the ball
  | 'TRANSITION_DEFENSE'; // just lost the ball

export type PressurePriority = 'HIGH' | 'MEDIUM' | 'LOW';

// ── Layer 1: FieldStructure (immutable) ───────────────────────────────────────

export interface FieldStructure {
  zones: Map<string, FieldZone>;
  fieldWidth: number;   // normalized 100
  fieldHeight: number;  // normalized 100
  ownPenaltyArea: FieldZone;
  opponentPenaltyArea: FieldZone;
}

// ── Layer 2: PhaseFieldState (updates on possession change) ───────────────────

export interface PhaseFieldState {
  currentPhase: GamePhase;
  possessionTeam: 'home' | 'away' | null;
  pressureZoneId: string | null;
  compactnessFactor: number;  // 0=spread, 1=compact
  // Per-position allowed zones for this phase
  activeZonesByPosition: Map<PositionId, string[]>;
}

// ── Layer 3: LiveFieldState (updates every tick) ──────────────────────────────

export interface LiveFieldState {
  tick: number;
  ballPosition: Vec2;
  ballZoneId: string;
  homeCentroid: Vec2;
  awayCentroid: Vec2;
  defensiveLineX: number;   // x position of defensive line (depth)
  playersPerZone: Map<string, number>;
}

// ── AgentFieldQuery — what each agent receives ────────────────────────────────

export interface AgentFieldQuery {
  currentZoneId: string;
  currentZone: FieldZone | undefined;
  allowedZoneIds: string[];
  primaryZoneIds: string[];
  isOutOfPosition: boolean;
  recoveryTarget: Vec2;
  shouldIgnoreBall: boolean;   // true = ignore ballPosition, go to recoveryTarget
  pressurePriority: PressurePriority;
  phase: GamePhase;
}

// ── Phase-aware zone expansion ────────────────────────────────────────────────
// Defines which extra zones each position can access per phase.
// AP-FIELD_CONTEXT.md: "zonas mudam conforme a fase do jogo"

const PHASE_EXPANSION: Record<GamePhase, Partial<Record<PositionId, string[]>>> = {
  POSSESSION: {
    LB:   ['ATT_LEFT_FLANK', 'MID_LEFT_FLANK'],
    RB:   ['ATT_RIGHT_FLANK', 'MID_RIGHT_FLANK'],
    LM:   ['ATT_LEFT_FLANK', 'ATT_LEFT_HALFSPACE'],
    RM:   ['ATT_RIGHT_FLANK', 'ATT_RIGHT_HALFSPACE'],
    CM_L: ['ATT_LEFT_HALFSPACE', 'ATT_CENTER'],
    CM_R: ['ATT_RIGHT_HALFSPACE', 'ATT_CENTER'],
    ST_L: ['OPPONENT_BOX', 'ATT_LEFT_HALFSPACE'],
    ST_R: ['OPPONENT_BOX', 'ATT_RIGHT_HALFSPACE'],
  },
  DEFENDING: {
    LB:   [],  // stay in primary only
    RB:   [],
    LM:   ['MID_LEFT_FLANK'],
    RM:   ['MID_RIGHT_FLANK'],
    CM_L: ['MID_LEFT_HALFSPACE', 'MID_CENTER'],
    CM_R: ['MID_RIGHT_HALFSPACE', 'MID_CENTER'],
    ST_L: ['MID_LEFT_HALFSPACE'],  // press high but don't go deep
    ST_R: ['MID_RIGHT_HALFSPACE'],
  },
  TRANSITION_ATTACK: {
    LB:   ['MID_LEFT_FLANK'],
    RB:   ['MID_RIGHT_FLANK'],
    LM:   ['ATT_LEFT_FLANK'],
    RM:   ['ATT_RIGHT_FLANK'],
    CM_L: ['ATT_LEFT_HALFSPACE', 'ATT_CENTER'],
    CM_R: ['ATT_RIGHT_HALFSPACE', 'ATT_CENTER'],
    ST_L: ['OPPONENT_BOX', 'ATT_CENTER'],
    ST_R: ['OPPONENT_BOX', 'ATT_CENTER'],
  },
  TRANSITION_DEFENSE: {
    LB:   [],  // sprint back immediately
    RB:   [],
    LM:   ['MID_LEFT_FLANK'],
    RM:   ['MID_RIGHT_FLANK'],
    CM_L: ['MID_CENTER', 'OWN_CENTER'],
    CM_R: ['MID_CENTER', 'OWN_CENTER'],
    ST_L: ['MID_LEFT_HALFSPACE'],
    ST_R: ['MID_RIGHT_HALFSPACE'],
  },
};

// ── MatchFieldContext class ───────────────────────────────────────────────────

export class MatchFieldContext {
  private structure: FieldStructure;
  private phaseState: PhaseFieldState;
  private liveState: LiveFieldState;
  private side: 'home' | 'away';

  constructor(side: 'home' | 'away') {
    this.side = side;

    // Layer 1: build once
    this.structure = {
      zones: new Map(Object.entries(FIELD_ZONES)),
      fieldWidth: 100,
      fieldHeight: 100,
      ownPenaltyArea: FIELD_ZONES['OWN_BOX']!,
      opponentPenaltyArea: FIELD_ZONES['OPPONENT_BOX']!,
    };

    // Layer 2: initial phase
    this.phaseState = {
      currentPhase: 'DEFENDING',
      possessionTeam: null,
      pressureZoneId: null,
      compactnessFactor: 0.5,
      activeZonesByPosition: new Map(),
    };

    // Layer 3: initial live state
    this.liveState = {
      tick: 0,
      ballPosition: { x: 50, y: 50 },
      ballZoneId: 'MID_CENTER',
      homeCentroid: { x: 30, y: 50 },
      awayCentroid: { x: 70, y: 50 },
      defensiveLineX: 25,
      playersPerZone: new Map(),
    };
  }

  // ── Layer 2 update: call when possession changes ──────────────────────────

  updatePhase(
    possession: 'home' | 'away' | null,
    prevPossession: 'home' | 'away' | null,
  ): void {
    const teamPossession = possession === this.side;
    const hadPossession  = prevPossession === this.side;

    let phase: GamePhase;
    if (teamPossession) {
      phase = hadPossession ? 'POSSESSION' : 'TRANSITION_ATTACK';
    } else if (possession !== null) {
      phase = hadPossession ? 'TRANSITION_DEFENSE' : 'DEFENDING';
    } else {
      phase = 'DEFENDING';
    }

    const compactness = phase === 'DEFENDING' || phase === 'TRANSITION_DEFENSE' ? 0.8 : 0.3;

    this.phaseState = {
      currentPhase: phase,
      possessionTeam: possession,
      pressureZoneId: this.liveState.ballZoneId,
      compactnessFactor: compactness,
      activeZonesByPosition: this._buildActiveZones(phase),
    };
  }

  private _buildActiveZones(phase: GamePhase): Map<PositionId, string[]> {
    const map = new Map<PositionId, string[]>();
    const positions: PositionId[] = ['GK','LB','CB_L','CB_R','RB','LM','CM_L','CM_R','RM','ST_L','ST_R'];
    const expansion = PHASE_EXPANSION[phase];

    for (const pos of positions) {
      const territory = getTerritory(pos, this.side);
      const base = [...territory.primaryZoneIds, ...territory.supportZoneIds];
      const extra = expansion[pos] ?? [];
      // Deduplicate
      map.set(pos, [...new Set([...base, ...extra])]);
    }
    return map;
  }

  // ── Layer 3 update: call ONCE per tick before all agents ─────────────────

  updateTick(
    tick: number,
    ballPosition: Vec2,
    players: PlayerAgentState[],
    possession: 'home' | 'away' | null,
  ): void {
    const ballZoneId = getZoneIdForPoint(ballPosition.x, ballPosition.y);

    // Centroid
    const centroid = players.reduce(
      (acc, p) => ({ x: acc.x + p.currentPosition.x, y: acc.y + p.currentPosition.y }),
      { x: 0, y: 0 },
    );
    const n = players.length || 1;
    const teamCentroid = { x: centroid.x / n, y: centroid.y / n };

    // Defensive line: x of the deepest defender (min x for home, max x for away)
    const defenders = players.filter(p =>
      ['GK','LB','CB_L','CB_R','RB'].includes(p.position)
    );
    const defensiveLineX = this.side === 'home'
      ? Math.max(...defenders.map(p => p.currentPosition.x), 0)
      : Math.min(...defenders.map(p => p.currentPosition.x), 100);

    // Players per zone
    const playersPerZone = new Map<string, number>();
    for (const p of players) {
      const zid = getZoneIdForPoint(p.currentPosition.x, p.currentPosition.y);
      playersPerZone.set(zid, (playersPerZone.get(zid) ?? 0) + 1);
    }

    this.liveState = {
      tick,
      ballPosition,
      ballZoneId,
      homeCentroid: this.side === 'home' ? teamCentroid : this.liveState.homeCentroid,
      awayCentroid: this.side === 'away' ? teamCentroid : this.liveState.awayCentroid,
      defensiveLineX,
      playersPerZone,
    };

    // Update phase if possession changed
    if (possession !== this.phaseState.possessionTeam) {
      this.updatePhase(possession, this.phaseState.possessionTeam);
    }
  }

  // ── queryForAgent: the main interface for each agent ─────────────────────
  // AP-CLAUDE.md: "Cada agente chama queryForAgent() individualmente"

  queryForAgent(agent: PlayerAgentState): AgentFieldQuery {
    const pos = agent.currentPosition;
    const currentZoneId = getZoneIdForPoint(pos.x, pos.y);
    const currentZone = FIELD_ZONES[currentZoneId];
    const territory = getTerritory(agent.position, this.side);
    const phase = this.phaseState.currentPhase;
    const teamHasBall = this.phaseState.possessionTeam === this.side;

    // Allowed zones for this position in this phase
    const allowedZoneIds = this.phaseState.activeZonesByPosition.get(agent.position)
      ?? [...territory.primaryZoneIds, ...territory.supportZoneIds];

    // Territory game state for TerritoryRules
    const gameState = {
      teamHasBall,
      ballPosition: this.liveState.ballPosition,
      teamSide: this.side,
    };

    const isInPrimary = isPointInsidePrimaryTerritory(territory, pos);
    const isInSupport = isPointInsideSupportTerritory(territory, pos);
    const isForbidden = isPointForbidden(territory, pos);
    const isOutOfPosition = !isInPrimary && !isInSupport;

    const recover = shouldRecoverPosition(territory, pos, gameState);
    const recoveryTarget = getRecoveryTarget(territory, gameState);

    // shouldIgnoreBall: true when recovery is absolute priority
    // AP-RULES.md: "shouldIgnoreBall: true significa que o agente ignora ballPosition"
    const shouldIgnoreBall =
      isForbidden ||
      (recover && (phase === 'DEFENDING' || phase === 'TRANSITION_DEFENSE'));

    // Pressure priority based on ball proximity and phase
    const distToBall = Math.hypot(
      pos.x - this.liveState.ballPosition.x,
      pos.y - this.liveState.ballPosition.y,
    );
    const pressurePriority: PressurePriority =
      distToBall < 15 && phase === 'DEFENDING' ? 'HIGH' :
      distToBall < 30 ? 'MEDIUM' : 'LOW';

    return {
      currentZoneId,
      currentZone,
      allowedZoneIds,
      primaryZoneIds: territory.primaryZoneIds,
      isOutOfPosition,
      recoveryTarget,
      shouldIgnoreBall,
      pressurePriority,
      phase,
    };
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  getPhase(): GamePhase { return this.phaseState.currentPhase; }
  getLiveState(): LiveFieldState { return this.liveState; }
  getPhaseState(): PhaseFieldState { return this.phaseState; }
  getStructure(): FieldStructure { return this.structure; }
}
