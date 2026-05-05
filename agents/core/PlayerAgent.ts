import type {
  PositionId, RoleId, ArchetypeId,
  Vec2, ZoneConstraint, Intention, AgentAction,
} from './AgentTypes';
import { createMemory, updateMemory, type AgentMemory } from './AgentMemory';
import { buildPerception, type AgentPerception } from './AgentPerception';
import { decideIntention } from './AgentDecision';
import { resolveAction } from './AgentAction';
import { getArchetypeModifiers } from '../archetypes/balanced';
import { evaluateSkills } from '../skills/SkillEngine';
import type { PlayerMatchBriefing } from '../context/PlayerMatchBriefing';
import type { FieldKnowledge } from '../fieldKnowledge/FieldKnowledge';
import { validateAgentTarget } from '../fieldKnowledge/TerritoryRules';
import { getZoneIdForPoint } from '../fieldKnowledge/FieldZones';
import type { AgentFieldQuery } from '../match/MatchFieldContext';

export interface PlayerAgentState {
  id: string;
  position: PositionId;
  role: RoleId;
  archetype: ArchetypeId;
  basePosition: Vec2;
  currentPosition: Vec2;
  stamina: number;
  confidence: number;
  zone: ZoneConstraint;
  memory: AgentMemory;
  skillIds: string[];
  briefing: PlayerMatchBriefing | null;
  fieldKnowledge: FieldKnowledge | null;
  lastPerception: AgentPerception | null;
  lastIntention: Intention | null;
  lastAction: AgentAction | null;
  lastSkillFired: string | null;
  lastZoneId: string | null;
  lastFieldQuery: AgentFieldQuery | null;
}

export function createAgent(
  id: string,
  position: PositionId,
  role: RoleId,
  archetype: ArchetypeId,
  basePosition: Vec2,
  zone: ZoneConstraint,
  stamina = 100,
  confidence = 75,
  skillIds: string[] = [],
): PlayerAgentState {
  return {
    id, position, role, archetype, basePosition,
    currentPosition: { ...basePosition },
    stamina, confidence, zone,
    memory: createMemory(),
    skillIds,
    briefing: null,
    fieldKnowledge: null,
    lastPerception: null,
    lastIntention: null,
    lastAction: null,
    lastSkillFired: null,
    lastZoneId: null,
    lastFieldQuery: null,
  };
}

// Run one perception→decision→validate cycle for an agent.
// Returns a new immutable state — does NOT mutate in place.
// Position is NOT updated here — MovementBridge is the ONLY source of movement.
export function tickAgent(
  agent: PlayerAgentState,
  ballPosition: Vec2,
  goalPosition: Vec2,
  teammatePositions: Vec2[],
  opponentPositions: Vec2[],
  teamHasBall: boolean,
  ballCarrierId: string | null = null,
  fieldQuery: AgentFieldQuery | null = null,
  teamSide: 'home' | 'away' = 'home',
  possession: 'home' | 'away' | null = null,
): PlayerAgentState {
  const modifiers = getArchetypeModifiers(agent.archetype);
  const hasBall = ballCarrierId === agent.id;

  // shouldIgnoreBall: agent uses recoveryTarget instead of ballPosition
  const shouldIgnoreBall = fieldQuery?.shouldIgnoreBall ?? false;
  const effectiveBallPos = shouldIgnoreBall
    ? (fieldQuery?.recoveryTarget ?? ballPosition)
    : ballPosition;

  const perception = buildPerception(
    agent.currentPosition,
    effectiveBallPos,
    goalPosition,
    teammatePositions,
    opponentPositions,
    teamHasBall,
    hasBall,
  );

  const intention = decideIntention(
    perception, modifiers, agent.confidence, agent.briefing,
    agent.position, teamSide, possession,
  );
  const action    = resolveAction(
    intention,
    agent.currentPosition,
    ballPosition,
    goalPosition,
    agent.zone,
    modifiers,
    hasBall,
    agent.stamina,
    perception.nearestOpponentDist,
    teamHasBall,
    agent.position,
    agent.archetype,
  );

  // Skill override (Fase 2)
  const skillResult = evaluateSkills(agent.skillIds, agent.position, perception, agent.stamina);
  const finalIntention = skillResult.fired ? skillResult.intention! : intention;
  let   finalAction    = skillResult.fired ? skillResult.action!    : action;

  // FieldKnowledge: validate target territory
  if (agent.fieldKnowledge && finalAction.target &&
      (finalAction.type === 'MOVE' || finalAction.type === 'RUN')) {
    const gameState = {
      teamHasBall,
      ballPosition,
      teamSide: agent.fieldKnowledge.teamSide,
    };
    const validation = validateAgentTarget(
      agent.fieldKnowledge,
      agent.currentPosition,
      finalAction.target,
      gameState,
    );
    const dx = validation.adjustedTarget.x - finalAction.target.x;
    const dy = validation.adjustedTarget.y - finalAction.target.y;
    if (Math.sqrt(dx * dx + dy * dy) > 1.0) {
      finalAction = { ...finalAction, target: validation.adjustedTarget };
    }
  }

  const memory = updateMemory(agent.memory, finalIntention, finalAction.type, hasBall);

  // Position stays unchanged — MovementBridge updates it after this
  const currentPosition = agent.currentPosition;

  const baseDrain =
    finalAction.type === 'RUN'   ? 0.3 :
    finalAction.type === 'MOVE'  ? 0.1 :
    finalAction.type === 'SHOOT' ? 0.2 : 0;
  const skillDrain = skillResult.fired ? skillResult.staminaCost : 0;
  const stamina    = Math.max(0, agent.stamina - baseDrain - skillDrain);
  const confidence = Math.min(100, Math.max(10,
    agent.confidence + (skillResult.fired ? skillResult.confidenceDelta : 0)
  ));

  const lastZoneId = getZoneIdForPoint(currentPosition.x, currentPosition.y);

  return {
    ...agent,
    currentPosition,
    stamina,
    confidence,
    memory,
    lastPerception: perception,
    lastIntention: finalIntention,
    lastAction: finalAction,
    lastSkillFired: skillResult.fired ? skillResult.skillName : null,
    lastZoneId,
    lastFieldQuery: fieldQuery,
  };
}
