/** Espelha o contrato do jogo web (`src/bridge/matchTruthSchema.ts`) para o viewer isolado. */
export const MATCH_TRUTH_SCHEMA_VERSION = 2 as const;

export type MatchTruthPhase =
  | 'live'
  | 'dead_ball'
  | 'goal_restart'
  | 'kickoff'
  | 'throw_in'
  | 'corner_kick'
  | 'goal_kick'
  | 'pregame_visual';

export interface TeamKit {
  primaryColor: string;
  secondaryColor: string;
  accent?: string;
}

export interface MatchTruthPlayer {
  id: string;
  side: 'home' | 'away';
  x: number;
  y: number;
  z: number;
  heading?: number;
  speed?: number;
  role: string;
  shirtNumber?: number;
}

export interface MatchTruthSnapshot {
  schemaVersion: number;
  fieldSchemaVersion?: string;
  t: number;
  ball: { x: number; y: number; z: number; vx?: number; vz?: number };
  players: MatchTruthPlayer[];
  matchPhase: MatchTruthPhase;
  kits?: { home: TeamKit; away: TeamKit };
}
