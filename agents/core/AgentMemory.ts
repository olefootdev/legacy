import type { Intention, ActionType } from './AgentTypes';

// Minimal short-term memory — last intention and last action only.
// Kept deliberately small: no history arrays, no event log.

export interface AgentMemory {
  lastIntention: Intention | null;
  lastAction: ActionType | null;
  ticksInCurrentIntention: number; // how many ticks the current intention has been held
  ticksWithBall: number;           // how many consecutive ticks this agent has had the ball
}

export function createMemory(): AgentMemory {
  return {
    lastIntention: null,
    lastAction: null,
    ticksInCurrentIntention: 0,
    ticksWithBall: 0,
  };
}

export function updateMemory(
  memory: AgentMemory,
  intention: Intention,
  action: ActionType,
  hasBall = false,
): AgentMemory {
  const sameIntention = memory.lastIntention === intention;
  return {
    lastIntention: intention,
    lastAction: action,
    ticksInCurrentIntention: sameIntention ? memory.ticksInCurrentIntention + 1 : 1,
    ticksWithBall: hasBall ? memory.ticksWithBall + 1 : 0,
  };
}
