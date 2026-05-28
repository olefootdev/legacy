/**
 * MatchPlan — schema do plano de partida pré-computado pelo Python.
 *
 * O endpoint backend `POST /api/match/quick-plan` invoca o simulador Python
 * (smartfield/match_simulator.py) e devolve este objeto. O TS renderiza ele
 * em ~25s, animando cada evento com timing definido pelo `weightTier`.
 *
 * Determinístico: mesmo `seed` + lineups = mesmo plan (replay coerente).
 */

export type MatchEventKind =
  | 'goal_home' | 'goal_away'
  | 'shot_home' | 'shot_away'
  | 'yellow_home' | 'yellow_away'
  | 'red_home' | 'red_away'
  | 'injury_home' | 'injury_away'
  | 'penalty_home' | 'penalty_away'
  | 'narrative';

export type MatchEventTier = 'epic' | 'big' | 'normal' | 'minor';

export type FieldZone = 'def' | 'mid' | 'att';

export type NarrativeArc =
  | 'underdog_fight'
  | 'dominant_control'
  | 'late_drama'
  | 'collapse'
  | 'balanced';

export interface MatchPlanEvent {
  minute: number;
  kind: MatchEventKind;
  actor_id?: string;
  actor_side: 'home' | 'away';
  xg?: number;
  weight_tier: MatchEventTier;
  zone: FieldZone;
  text: string;
}

export interface MatchPlanMvp {
  player_id: string;
  name: string;
  rating: number;
  goals: number;
  assists: number;
}

export interface MatchPlan {
  version: '1.0';
  seed: string;
  home_short: string;
  away_short: string;
  home_score: number;
  away_score: number;
  events: MatchPlanEvent[];
  momentum_curve: number[]; // 90 valores 0-100 (perspectiva home)
  mvp_projection: MatchPlanMvp | null;
  narrative_arc: NarrativeArc;
  generated_at_ms: number;
  duration_ms: number;
}

/** Duração em ms da animação de cada tier no render condensado (FIX F). */
export const TIER_ANIMATION_MS: Record<MatchEventTier, number> = {
  epic: 3500,
  big: 1800,
  normal: 500,
  minor: 150,
};

/** Tempo total estimado de render condensado de um plan completo. */
export function estimateRenderDurationMs(plan: MatchPlan): number {
  return plan.events.reduce((sum, e) => sum + TIER_ANIMATION_MS[e.weight_tier], 0);
}
