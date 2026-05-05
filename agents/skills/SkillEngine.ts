/**
 * /agents/skills/SkillEngine.ts
 *
 * Minimal skill trigger engine.
 * Skills are loaded by name and evaluated against AgentPerception each tick.
 * When a skill fires, it returns an override for intention + action.
 * No LLM calls — purely deterministic trigger evaluation.
 */

import type { AgentPerception } from '../core/AgentPerception';
import { distanceTo } from '../core/AgentPerception';
import type { Intention, AgentAction, Vec2 } from '../core/AgentTypes';

export interface SkillDefinition {
  name: string;
  // Positions that can use this skill
  positions: string[];
  // Returns true when the skill should activate
  trigger: (perception: AgentPerception, stamina: number) => boolean;
  // What the skill does when it fires
  execute: (perception: AgentPerception) => {
    intention: Intention;
    action: AgentAction;
    confidenceDelta: number;
    staminaCost: number;
  };
}

// ── Skill catalog ─────────────────────────────────────────────────────────────

export const SKILL_CATALOG: Record<string, SkillDefinition> = {

  'clinical-finisher': {
    name: 'clinical-finisher',
    positions: ['ST_L', 'ST_R'],
    trigger: (p, stamina) =>
      p.hasBall &&
      distanceTo(p.ownPosition, p.goalPosition) < 25 &&
      p.nearestOpponentDist > 5 &&
      stamina > 15,
    execute: (p) => ({
      intention: 'FINISH',
      action: { type: 'SHOOT', target: p.goalPosition },
      confidenceDelta: +8,
      staminaCost: 2,
    }),
  },

  'overlap-run': {
    name: 'overlap-run',
    positions: ['LB', 'RB'],
    trigger: (p, stamina) =>
      !p.hasBall &&
      p.teamHasBall &&
      p.ownPosition.x > 40 &&
      stamina > 40,
    execute: (p) => ({
      intention: 'OVERLAP' as Intention,
      action: {
        type: 'RUN',
        target: { x: Math.min(p.ownPosition.x + 20, 85), y: p.ownPosition.y },
      },
      confidenceDelta: +2,
      staminaCost: 4,
    }),
  },

  'anchor-hold': {
    name: 'anchor-hold',
    positions: ['CM_L', 'CM_R'],
    trigger: (p, _stamina) =>
      !p.teamHasBall &&
      p.ownPosition.x > 55,
    execute: (p) => ({
      intention: 'RECOVER' as Intention,
      action: { type: 'MOVE', target: { x: 48, y: p.ownPosition.y } },
      confidenceDelta: 0,
      staminaCost: 0,
    }),
  },

};

// ── Engine ────────────────────────────────────────────────────────────────────

export interface SkillResult {
  fired: boolean;
  skillName: string | null;
  intention: Intention | null;
  action: AgentAction | null;
  confidenceDelta: number;
  staminaCost: number;
}

/**
 * Evaluate all skills assigned to an agent.
 * Returns the first skill that fires, or a no-op result.
 */
export function evaluateSkills(
  skillIds: string[],
  position: string,
  perception: AgentPerception,
  stamina: number,
): SkillResult {
  for (const id of skillIds) {
    const skill = SKILL_CATALOG[id];
    if (!skill) continue;
    if (!skill.positions.includes(position)) continue;
    if (!skill.trigger(perception, stamina)) continue;

    const result = skill.execute(perception);
    return {
      fired: true,
      skillName: id,
      intention: result.intention,
      action: result.action,
      confidenceDelta: result.confidenceDelta,
      staminaCost: result.staminaCost,
    };
  }

  return { fired: false, skillName: null, intention: null, action: null, confidenceDelta: 0, staminaCost: 0 };
}
