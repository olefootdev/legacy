/**
 * /agents/fieldKnowledge/FieldKnowledgeLoader.ts
 *
 * Attaches FieldKnowledge to each PlayerAgent before the first tick.
 *
 * Flow:
 *   create442Team()
 *     → loadTeamBriefings()       (context layer)
 *     → loadFieldKnowledge()      (this loader)
 *     → TeamSimulator             (first tick)
 *
 * The loader:
 *   1. Reads field dimensions from fieldGeometry.ts (source of truth)
 *   2. Builds the zone map (already done statically in FieldZones.ts)
 *   3. Assigns the correct PositionTerritory per position + side
 *   4. Attaches FieldKnowledge to each agent
 */

import type { PlayerAgentState } from '../core/PlayerAgent';
import type { PositionId } from '../core/AgentTypes';
import type { FieldKnowledge } from './FieldKnowledge';
import { FIELD_ZONES } from './FieldZones';
import { getTerritory } from './PositionTerritories';

// ── Extend PlayerAgentState with field knowledge ──────────────────────────────

export interface FieldAwareAgentState extends PlayerAgentState {
  fieldKnowledge: FieldKnowledge;
}

// ── Loader ────────────────────────────────────────────────────────────────────

function buildFieldKnowledge(
  positionId: PositionId,
  side: 'home' | 'away',
): FieldKnowledge {
  const territory = getTerritory(positionId, side);

  return {
    zones: new Map(Object.entries(FIELD_ZONES)),
    territory,
    teamSide: side,
    attackingDirection: side === 'home' ? 'up' : 'down',
  };
}

export function attachFieldKnowledge(
  agent: PlayerAgentState,
  side: 'home' | 'away',
): FieldAwareAgentState {
  return {
    ...agent,
    fieldKnowledge: buildFieldKnowledge(agent.position, side),
  };
}

export function loadTeamFieldKnowledge(
  agents: PlayerAgentState[],
  side: 'home' | 'away',
): FieldAwareAgentState[] {
  return agents.map((a) => attachFieldKnowledge(a, side));
}
