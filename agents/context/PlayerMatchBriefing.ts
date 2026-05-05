/**
 * /agents/context/PlayerMatchBriefing.ts
 *
 * Runtime briefing snapshot — combines the static role expectations
 * with match-specific overrides (opponent scouting, coach instructions).
 *
 * This is what the agent actually reads each tick via its identityContext.
 * Static defaults come from PlayerRoleExpectations.
 * Match-specific overrides can be injected by PreMatchAgentLoader.
 */

import type { PlayerIdentityContext } from './PlayerIdentityContext';

export interface MatchBriefingOverride {
  // Coach can override specific limits for this match
  maxDistToChaseBall?: number;
  recoveryPriority?: number;
  aggressionLevel?: number;
  riskTolerance?: number;
  // Opponent-specific instructions
  markOpponentId?: string;       // man-mark a specific opponent
  pressHigherThan?: number;      // press when ball is above this y threshold
  // Phase-specific instruction override
  inPossessionOverride?: string;
  outOfPossessionOverride?: string;
}

export interface PlayerMatchBriefing {
  context: PlayerIdentityContext;
  override: MatchBriefingOverride;
  // Resolved values (context + override merged) — used by decision engine
  resolved: {
    maxDistToChaseBall: number;
    minDistToShoot: number;
    recoveryPriority: number;
    aggressionLevel: number;
    riskTolerance: number;
    supportResponsibility: number;
    tacticalPriority: number;
  };
}

/**
 * Build a resolved briefing from a context + optional override.
 * Override values take precedence over context defaults.
 */
export function buildMatchBriefing(
  context: PlayerIdentityContext,
  override: MatchBriefingOverride = {},
): PlayerMatchBriefing {
  const limits = context.behavioralLimits;
  const mission = context.matchMission;

  return {
    context,
    override,
    resolved: {
      maxDistToChaseBall: override.maxDistToChaseBall ?? limits.maxDistToChaseBall,
      minDistToShoot:     limits.minDistToShoot,
      recoveryPriority:   override.recoveryPriority   ?? mission.riskTolerance < 0.2 ? 0.95 : mission.riskTolerance < 0.5 ? 0.75 : 0.4,
      aggressionLevel:    override.aggressionLevel    ?? mission.aggressionLevel,
      riskTolerance:      override.riskTolerance      ?? mission.riskTolerance,
      supportResponsibility: mission.supportResponsibility,
      tacticalPriority:   mission.tacticalPriority,
    },
  };
}
