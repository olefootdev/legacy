/**
 * GOAP Lite — Hierarchical goal tree for match agents.
 *
 * GoalTree per player:
 * ├── ScoreGoal
 * │   ├── GetShootingPosition
 * │   ├── ReceivePassInBox
 * │   └── RunBehindDefense
 * ├── MaintainPossession
 * │   ├── FindSafePass
 * │   ├── CarryForward
 * │   └── RecyclePlay
 * └── PreventGoal
 *     ├── MarkDangerousPlayer
 *     ├── CoverSpace
 *     └── PressCarrier
 */

import type { GoalContext, GoalNode, GoalEvaluation } from './types';

// ── Leaf goals ────────────────────────────────────────────────────

const getShootingPosition: GoalNode = {
  id: 'get_shooting_position',
  biasActions: ['shoot', 'enter_box', 'run_to_byline'],
  biasStrength: 0.18,
  evaluate: (ctx) => {
    if (!ctx.teamHasBall) return 0;
    let score = ctx.isForward ? 0.7 : 0.3;
    if (ctx.inFinalThird) score += 0.2;
    if (ctx.distToGoalM < 25) score += 0.15;
    score -= ctx.fatigue01 * 0.2;
    return Math.min(1, Math.max(0, score));
  },
};

const receivePassInBox: GoalNode = {
  id: 'receive_pass_in_box',
  biasActions: ['striker_infiltrate_box', 'near_post_run', 'far_post_run'],
  biasStrength: 0.20,
  evaluate: (ctx) => {
    if (!ctx.teamHasBall || ctx.isCarrier) return 0;
    let score = ctx.isForward ? 0.65 : 0.15;
    if (ctx.inFinalThird) score += 0.25;
    if (ctx.inBox) score += 0.1;
    return Math.min(1, Math.max(0, score));
  },
};

const runBehindDefense: GoalNode = {
  id: 'run_behind_defense',
  biasActions: ['run_behind', 'diagonal_run', 'channel_run'],
  biasStrength: 0.15,
  evaluate: (ctx) => {
    if (!ctx.teamHasBall || ctx.isCarrier) return 0;
    let score = ctx.isForward ? 0.55 : 0.2;
    if (ctx.distToGoalM > 20 && ctx.distToGoalM < 45) score += 0.2;
    score -= ctx.fatigue01 * 0.3;
    return Math.min(1, Math.max(0, score));
  },
};

const findSafePass: GoalNode = {
  id: 'find_safe_pass',
  biasActions: ['pass_safe', 'pass_short', 'pass_backward'],
  biasStrength: 0.12,
  evaluate: (ctx) => {
    if (!ctx.isCarrier) return 0;
    let score = 0.4;
    if (ctx.pressureLevel > 0.5) score += 0.3;
    if (ctx.inDefensiveThird) score += 0.2;
    if (ctx.fatigue01 > 0.6) score += 0.15;
    return Math.min(1, Math.max(0, score));
  },
};

const carryForward: GoalNode = {
  id: 'carry_forward',
  biasActions: ['progressive_dribble', 'aggressive_carry', 'simple_carry'],
  biasStrength: 0.12,
  evaluate: (ctx) => {
    if (!ctx.isCarrier) return 0;
    let score = 0.35;
    if (ctx.pressureLevel < 0.3) score += 0.25;
    if (ctx.isMidfielder) score += 0.15;
    if (ctx.distToGoalM > 30) score += 0.1;
    score -= ctx.fatigue01 * 0.2;
    return Math.min(1, Math.max(0, score));
  },
};

const recyclePlay: GoalNode = {
  id: 'recycle_play',
  biasActions: ['pass_safe', 'pass_backward', 'switch_play'],
  biasStrength: 0.10,
  evaluate: (ctx) => {
    if (!ctx.isCarrier) return 0;
    let score = 0.3;
    if (ctx.pressureLevel > 0.6) score += 0.3;
    if (ctx.isDefender) score += 0.15;
    return Math.min(1, Math.max(0, score));
  },
};

const markDangerousPlayer: GoalNode = {
  id: 'mark_dangerous_player',
  biasActions: ['mark_man', 'track_runner', 'close_down'],
  biasStrength: 0.15,
  evaluate: (ctx) => {
    if (ctx.teamHasBall) return 0;
    let score = ctx.isDefender ? 0.7 : 0.25;
    if (ctx.inDefensiveThird) score += 0.2;
    return Math.min(1, Math.max(0, score));
  },
};

const coverSpace: GoalNode = {
  id: 'cover_space',
  biasActions: ['hold_position', 'cover_zone', 'drop_deep'],
  biasStrength: 0.12,
  evaluate: (ctx) => {
    if (ctx.teamHasBall) return 0.1;
    let score = ctx.isDefender ? 0.6 : 0.35;
    if (ctx.isMidfielder) score += 0.1;
    if (ctx.fatigue01 > 0.7) score += 0.15;
    return Math.min(1, Math.max(0, score));
  },
};

const pressCarrier: GoalNode = {
  id: 'press_carrier',
  biasActions: ['press', 'tackle', 'close_down'],
  biasStrength: 0.15,
  evaluate: (ctx) => {
    if (ctx.teamHasBall) return 0;
    let score = 0.3;
    if (ctx.distToBallM < 12) score += 0.35;
    if (ctx.distToBallM < 6) score += 0.2;
    score -= ctx.fatigue01 * 0.25;
    return Math.min(1, Math.max(0, score));
  },
};

// ── Composite goals ───────────────────────────────────────────────

const scoreGoal: GoalNode = {
  id: 'score_goal',
  biasActions: ['shoot', 'pass_progressive', 'cross'],
  biasStrength: 0.10,
  children: [getShootingPosition, receivePassInBox, runBehindDefense],
  evaluate: (ctx) => {
    let score = 0.4;
    if (ctx.teamHasBall) score += 0.2;
    if (ctx.scoreDiff < 0) score += 0.2;
    if (ctx.minute > 75 && ctx.scoreDiff <= 0) score += 0.15;
    if (ctx.isForward) score += 0.1;
    return Math.min(1, Math.max(0, score));
  },
};

const maintainPossession: GoalNode = {
  id: 'maintain_possession',
  biasActions: ['pass_safe', 'simple_carry'],
  biasStrength: 0.08,
  children: [findSafePass, carryForward, recyclePlay],
  evaluate: (ctx) => {
    let score = 0.45;
    if (ctx.teamHasBall && ctx.isCarrier) score += 0.25;
    if (ctx.scoreDiff > 0) score += 0.15;
    if (ctx.pressureLevel > 0.4) score += 0.1;
    return Math.min(1, Math.max(0, score));
  },
};

const preventGoal: GoalNode = {
  id: 'prevent_goal',
  biasActions: ['mark_man', 'hold_position', 'clearance'],
  biasStrength: 0.10,
  children: [markDangerousPlayer, coverSpace, pressCarrier],
  evaluate: (ctx) => {
    let score = 0.35;
    if (!ctx.teamHasBall) score += 0.25;
    if (ctx.isDefender) score += 0.15;
    if (ctx.scoreDiff > 0 && ctx.minute > 75) score += 0.2;
    if (ctx.inDefensiveThird && !ctx.teamHasBall) score += 0.15;
    return Math.min(1, Math.max(0, score));
  },
};

// ── Root tree ─────────────────────────────────────────────────────

const ROOT_GOALS: GoalNode[] = [scoreGoal, maintainPossession, preventGoal];

/**
 * Evaluate the goal tree for a player and return the best leaf goal.
 * Parent score gates children — a parent with 0 score disables its subtree.
 */
export function evaluateGoalTree(ctx: GoalContext): GoalEvaluation {
  let bestParentScore = -1;
  let bestParent: GoalNode | null = null;

  for (const parent of ROOT_GOALS) {
    const score = parent.evaluate(ctx);
    if (score > bestParentScore) {
      bestParentScore = score;
      bestParent = parent;
    }
  }

  if (!bestParent) {
    return {
      activeGoal: 'maintain_possession',
      activeLeaf: 'find_safe_pass',
      score: 0,
      biasActions: [],
      biasStrength: 0,
    };
  }

  // Find best leaf within the active parent
  if (!bestParent.children || bestParent.children.length === 0) {
    return {
      activeGoal: bestParent.id,
      activeLeaf: bestParent.id,
      score: bestParentScore,
      biasActions: bestParent.biasActions,
      biasStrength: bestParent.biasStrength,
    };
  }

  let bestLeafScore = -1;
  let bestLeaf: GoalNode = bestParent.children[0];

  for (const child of bestParent.children) {
    const childScore = child.evaluate(ctx) * bestParentScore;
    if (childScore > bestLeafScore) {
      bestLeafScore = childScore;
      bestLeaf = child;
    }
  }

  return {
    activeGoal: bestParent.id,
    activeLeaf: bestLeaf.id,
    score: bestLeafScore,
    biasActions: bestLeaf.biasActions,
    biasStrength: bestLeaf.biasStrength,
  };
}
