/**
 * /agents/context/PreMatchAgentLoader.ts
 *
 * Loads tactical identity briefings onto each PlayerAgent before the first tick.
 * Call this once after create442Team() and before the first stepSimulator().
 *
 * Flow:
 *   create442Team() → loadTeamBriefings() → TeamSimulator
 *
 * Each agent receives:
 *   - PlayerIdentityContext (from ROLE_EXPECTATIONS catalog)
 *   - PlayerMatchBriefing (resolved values for decision engine)
 *   - Validation log printed to console
 */

import type { PlayerAgentState } from '../core/PlayerAgent';
import type { Team442 } from '../team/create442Team';
import type { MatchBriefingOverride, PlayerMatchBriefing } from './PlayerMatchBriefing';
import { buildMatchBriefing } from './PlayerMatchBriefing';
import { ROLE_EXPECTATIONS } from './PlayerRoleExpectations';
import type { PlayerIdentityContext } from './PlayerIdentityContext';

// ── Attach briefing to agent state ───────────────────────────────────────────

// Extend PlayerAgentState with briefing (non-breaking — optional field)
export interface BriefedAgentState extends PlayerAgentState {
  briefing: PlayerMatchBriefing;
}

function attachBriefing(
  agent: PlayerAgentState,
  teamSide: 'home' | 'away',
  override: MatchBriefingOverride = {},
): BriefedAgentState {
  const roleDefaults = ROLE_EXPECTATIONS[agent.position];

  const context: PlayerIdentityContext = {
    ...roleDefaults,
    positionId:  agent.position,
    archetypeId: agent.archetype,
    teamSide,
  };

  const briefing = buildMatchBriefing(context, override);

  return { ...agent, briefing };
}

// ── Validation log ────────────────────────────────────────────────────────────

function printBriefingSummary(agent: BriefedAgentState): void {
  const b = agent.briefing;
  const c = b.context;
  const r = b.resolved;
  const pos = c.zoneResponsibility;

  console.log(`\n[BRIEFING] ${agent.id} — ${c.positionId} (${c.archetypeId})`);
  console.log(`  Mission:          ${c.matchMission.summary}`);
  console.log(`  Primary Zone:     ${pos.primaryZone} | Base: (${pos.basePosition.x}, ${pos.basePosition.y}) | Roam: ${pos.maxRoamDistance}`);
  console.log(`  Forbidden Zones:  ${pos.forbiddenZones.join(', ') || 'none'}`);
  console.log(`  Preferred:        pass=${c.preferredActions.passType} move=${c.preferredActions.movementType} def=${c.preferredActions.defensiveAction} att=${c.preferredActions.attackingAction}`);
  console.log(`  Avoid:            ${c.behavioralLimits.dontChaseBallWhen}`);
  console.log(`  Resolved:         chase≤${r.maxDistToChaseBall} shoot≤${r.minDistToShoot} recovery=${r.recoveryPriority.toFixed(2)} aggr=${r.aggressionLevel.toFixed(2)}`);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface BriefedTeam442 {
  id: string;
  name: string;
  players: BriefedAgentState[];
}

/**
 * Load tactical briefings onto all 11 players of a team.
 * Prints a validation summary for each player.
 *
 * @param team       — output of create442Team() or create442TeamAway()
 * @param side       — 'home' | 'away'
 * @param overrides  — optional per-position coach overrides
 * @param silent     — suppress console output (useful in tests)
 */
export function loadTeamBriefings(
  team: Team442,
  side: 'home' | 'away',
  overrides: Partial<Record<string, MatchBriefingOverride>> = {},
  silent = false,
): BriefedTeam442 {
  if (!silent) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`PRE-MATCH BRIEFING — ${team.name.toUpperCase()} (${side.toUpperCase()})`);
    console.log('═'.repeat(60));
  }

  const players = team.players.map((agent) => {
    const posOverride = overrides[agent.position] ?? overrides[agent.id] ?? {};
    const briefed = attachBriefing(agent, side, posOverride);
    if (!silent) printBriefingSummary(briefed);
    return briefed;
  });

  if (!silent) {
    console.log(`\n✅ ${players.length} players briefed and ready.\n`);
  }

  return { id: team.id, name: team.name, players };
}

/**
 * Convenience: brief both teams at once.
 */
export function loadMatchBriefings(
  homeTeam: Team442,
  awayTeam: Team442,
  silent = false,
): { home: BriefedTeam442; away: BriefedTeam442 } {
  return {
    home: loadTeamBriefings(homeTeam, 'home', {}, silent),
    away: loadTeamBriefings(awayTeam, 'away', {}, silent),
  };
}
