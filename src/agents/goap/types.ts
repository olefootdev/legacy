/**
 * GOAP Lite types — Goal-Oriented Action Planning for match agents.
 *
 * Hierarchical goal tree evaluated per-agent on regulator tick.
 * Each goal scores utility 0-1 based on match context; the active
 * goal biases the decision engine toward aligned actions.
 */

export interface GoalContext {
  isCarrier: boolean;
  teamHasBall: boolean;
  distToGoalM: number;
  distToBallM: number;
  minute: number;
  scoreDiff: number;
  fatigue01: number;
  pressureLevel: number;
  inBox: boolean;
  inFinalThird: boolean;
  inDefensiveThird: boolean;
  isForward: boolean;
  isDefender: boolean;
  isMidfielder: boolean;
}

export type GoalId =
  | 'score_goal'
  | 'maintain_possession'
  | 'prevent_goal'
  | 'get_shooting_position'
  | 'receive_pass_in_box'
  | 'run_behind_defense'
  | 'find_safe_pass'
  | 'carry_forward'
  | 'recycle_play'
  | 'mark_dangerous_player'
  | 'cover_space'
  | 'press_carrier';

export interface GoalNode {
  id: GoalId;
  evaluate: (ctx: GoalContext) => number;
  children?: GoalNode[];
  /** Action types this goal biases positively. */
  biasActions: string[];
  /** Bias strength applied when this goal is active. */
  biasStrength: number;
}

export interface GoalEvaluation {
  activeGoal: GoalId;
  activeLeaf: GoalId;
  score: number;
  biasActions: string[];
  biasStrength: number;
}
