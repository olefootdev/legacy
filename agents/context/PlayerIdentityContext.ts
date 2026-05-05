/**
 * /agents/context/PlayerIdentityContext.ts
 *
 * Structured identity profile attached to each PlayerAgent before match start.
 * This is NOT cosmetic — it directly influences the perception→decision→action loop.
 *
 * Every field here maps to a concrete behavioral constraint or modifier
 * consumed by AgentDecision and AgentAction.
 */

import type { PositionId, RoleId, ArchetypeId, Vec2 } from '../core/AgentTypes';

// ── Zone responsibility ───────────────────────────────────────────────────────

export interface ZoneResponsibility {
  primaryZone: string;        // main zone label (e.g. 'DD' = Defensivo Direito)
  secondaryZone: string;      // zone to move into when supporting
  forbiddenZones: string[];   // zones this player must never enter
  basePosition: Vec2;         // tactical anchor (normalized 0–100)
  maxRoamDistance: number;    // max deviation from base (normalized units)
  recoveryTarget: Vec2;       // where to return when out of position
}

// ── Tactical expectations per phase ──────────────────────────────────────────

export interface TacticalExpectations {
  inPossession: string;         // what to do when team has ball
  outOfPossession: string;      // what to do when team doesn't have ball
  transitionAttack: string;     // what to do when team just won ball
  transitionDefense: string;    // what to do when team just lost ball
}

// ── Preferred action profile ──────────────────────────────────────────────────

export type PassType   = 'short' | 'long' | 'through' | 'cross' | 'none';
export type MoveType   = 'hold' | 'walk' | 'run' | 'sprint' | 'overlap';
export type DefAction  = 'tackle' | 'intercept' | 'block' | 'press' | 'cover' | 'hold';
export type AttAction  = 'shoot' | 'dribble' | 'pass' | 'cross' | 'run_behind' | 'hold_up';

export interface PreferredActions {
  passType: PassType;
  movementType: MoveType;
  defensiveAction: DefAction;
  attackingAction: AttAction;
}

// ── Behavioral limits — when to do / not do ──────────────────────────────────

export interface BehavioralLimits {
  dontChaseBallWhen: string;   // condition description
  holdPositionWhen: string;
  supportWhen: string;
  progressWhen: string;
  shootWhen: string;
  retreatWhen: string;
  // Numeric thresholds that override generic decision constants
  maxDistToChaseBall: number;  // normalized units — beyond this, don't chase
  minDistToShoot: number;      // normalized units — closer than this, consider shooting
  recoveryPriority: number;    // 0–1: how urgently to return to base (1 = always recover first)
}

// ── Match mission ─────────────────────────────────────────────────────────────

export interface MatchMission {
  summary: string;             // plain text — "Protect right flank, support wide, overlap when safe"
  tacticalPriority: number;    // 0–100: how central this player is to the team plan
  riskTolerance: number;       // 0–1: 0=never gamble, 1=always gamble
  aggressionLevel: number;     // 0–1: influences press triggers
  supportResponsibility: number; // 0–1: how much this player must offer passing options
}

// ── Full identity context ─────────────────────────────────────────────────────

export interface PlayerIdentityContext {
  // 1. Identity
  positionId: PositionId;
  roleId: RoleId;
  archetypeId: ArchetypeId;
  formationSlot: string;       // e.g. 'cb_left', 'rm', 'st_right'
  teamSide: 'home' | 'away';

  // 2–6. Full profile
  zoneResponsibility: ZoneResponsibility;
  tacticalExpectations: TacticalExpectations;
  preferredActions: PreferredActions;
  behavioralLimits: BehavioralLimits;
  matchMission: MatchMission;
}
