import type { PlayerAgentState } from '../core/PlayerAgent';
import type { PitchPlayerState } from '../../src/engine/types';

// Maps the new agent system's PlayerAgentState to the existing PitchPlayerState
// that FieldView.tsx already knows how to render.
// No modifications to FieldView needed — this is a pure adapter.

const POSITION_TO_POS: Record<string, string> = {
  GK:   'GK',
  CB_L: 'CB', CB_R: 'CB',
  LB:   'LB', RB:   'RB',
  LM:   'LM', CM_L: 'CM', CM_R: 'CM', RM: 'RM',
  ST_L: 'ST', ST_R: 'ST',
};

const POSITION_TO_ROLE: Record<string, string> = {
  GK:   'gk',
  CB_L: 'def', CB_R: 'def', LB: 'def', RB: 'def',
  LM:   'mid', CM_L: 'mid', CM_R: 'mid', RM: 'mid',
  ST_L: 'att', ST_R: 'att',
};

let _playerNum = 1;

export function agentToPitchPlayer(
  agent: PlayerAgentState,
  index: number,
): PitchPlayerState {
  // FieldView uses x=depth(0–100), y=width(0–100) — same as our agent coords.
  return {
    playerId: agent.id,
    slotId:   agent.position.toLowerCase(),
    name:     agent.id,
    num:      index + 1,
    pos:      POSITION_TO_POS[agent.position] ?? agent.position,
    role:     POSITION_TO_ROLE[agent.position] as any ?? 'mid',
    x:        agent.currentPosition.x,
    y:        agent.currentPosition.y,
    heading:  0,
    fatigue:  100 - agent.stamina,
    attributes: { overall: 75 } as any,
  } as PitchPlayerState;
}

export function teamToFieldViewPlayers(
  agents: PlayerAgentState[],
): PitchPlayerState[] {
  return agents.map((a, i) => agentToPitchPlayer(a, i));
}
