/** Contrato alinhado ao jogo web `src/bridge/matchTruthSchema.ts`. */
export const MATCH_TRUTH_SCHEMA_VERSION = 1 as const;

export type MatchTruthPhase =
  | 'live'
  | 'dead_ball'
  | 'goal_restart'
  | 'kickoff'
  | 'throw_in'
  | 'corner_kick'
  | 'goal_kick'
  | 'pregame_visual';

export interface MatchTruthPlayer {
  id: string;
  side: 'home' | 'away';
  x: number;
  y: number;
  z: number;
  heading?: number;
  speed?: number;
  role: string;
}

export interface MatchTruthSnapshot {
  schemaVersion: typeof MATCH_TRUTH_SCHEMA_VERSION;
  fieldSchemaVersion?: string;
  t: number;
  ball: { x: number; y: number; z: number };
  players: MatchTruthPlayer[];
  matchPhase: MatchTruthPhase;
}
