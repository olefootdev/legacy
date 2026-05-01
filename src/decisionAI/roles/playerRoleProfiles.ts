// ---------------------------------------------------------------------------
// Player Role Profiles — 11 canonical tactical roles with behavioural knobs
// ---------------------------------------------------------------------------

export type PlayerRoleId =
  | 'target_man'
  | 'poacher_in_box'
  | 'inverted_winger'
  | 'wide_winger'
  | 'overlapping_fullback'
  | 'inverted_fullback'
  | 'regista'
  | 'box_to_box'
  | 'ball_winner'
  | 'libero'
  | 'sweeper';

export interface PlayerRoleProfile {
  id: PlayerRoleId;
  /** 0-1: frequency of off-ball runs (movement without the ball) */
  offBallRunBias: number;
  /** Preferred support position relative to the ball */
  supportSpotPreference: 'wide' | 'halfspace' | 'central' | 'box';
  /** 0-1: how much the player tracks back defensively */
  defensiveCommit: number;
  /** 0-1: tendency to attempt risky actions */
  riskAppetite: number;
  /** 0-1: tendency to dribble when space is available */
  dribbleBias: number;
  /** 0-1: preference for vertical/forward passes over lateral/backward */
  verticalityBias: number;
  /** true = one-touch / give-and-go; false = hold and carry */
  prefersCombination: boolean;
}

export const ROLE_PROFILES: Record<PlayerRoleId, PlayerRoleProfile> = {
  // -------------------------------------------------------------------------
  // Attackers
  // -------------------------------------------------------------------------

  /** Classic big striker — holds up play, wins headers, lays off to runners */
  target_man: {
    id: 'target_man',
    offBallRunBias: 0.35,
    supportSpotPreference: 'box',
    defensiveCommit: 0.1,
    riskAppetite: 0.45,
    dribbleBias: 0.25,
    verticalityBias: 0.55,
    prefersCombination: false,
  },

  /** Pure finisher — stays in the box, minimal pressing, waits for the chance */
  poacher_in_box: {
    id: 'poacher_in_box',
    offBallRunBias: 0.55,
    supportSpotPreference: 'box',
    defensiveCommit: 0.05,
    riskAppetite: 0.6,
    dribbleBias: 0.3,
    verticalityBias: 0.7,
    prefersCombination: false,
  },

  /** Cuts inside from the flank, looks for shots and through balls */
  inverted_winger: {
    id: 'inverted_winger',
    offBallRunBias: 0.75,
    supportSpotPreference: 'halfspace',
    defensiveCommit: 0.3,
    riskAppetite: 0.72,
    dribbleBias: 0.78,
    verticalityBias: 0.68,
    prefersCombination: false,
  },

  /** Stays wide, delivers crosses, stretches the defence */
  wide_winger: {
    id: 'wide_winger',
    offBallRunBias: 0.7,
    supportSpotPreference: 'wide',
    defensiveCommit: 0.35,
    riskAppetite: 0.55,
    dribbleBias: 0.45,
    verticalityBias: 0.6,
    prefersCombination: false,
  },

  // -------------------------------------------------------------------------
  // Full-backs
  // -------------------------------------------------------------------------

  /** Bombs forward, provides width and crosses, recovers late */
  overlapping_fullback: {
    id: 'overlapping_fullback',
    offBallRunBias: 0.8,
    supportSpotPreference: 'wide',
    defensiveCommit: 0.55,
    riskAppetite: 0.5,
    dribbleBias: 0.38,
    verticalityBias: 0.62,
    prefersCombination: true,
  },

  /** Tucks inside into midfield, creates overloads in halfspaces */
  inverted_fullback: {
    id: 'inverted_fullback',
    offBallRunBias: 0.65,
    supportSpotPreference: 'halfspace',
    defensiveCommit: 0.6,
    riskAppetite: 0.45,
    dribbleBias: 0.35,
    verticalityBias: 0.5,
    prefersCombination: true,
  },

  // -------------------------------------------------------------------------
  // Midfielders
  // -------------------------------------------------------------------------

  /** Deep-lying playmaker — dictates tempo, rarely runs forward */
  regista: {
    id: 'regista',
    offBallRunBias: 0.25,
    supportSpotPreference: 'central',
    defensiveCommit: 0.3,
    riskAppetite: 0.65,
    dribbleBias: 0.3,
    verticalityBias: 0.72,
    prefersCombination: true,
  },

  /** Engine of the team — covers ground both ways, box-to-box runs */
  box_to_box: {
    id: 'box_to_box',
    offBallRunBias: 0.82,
    supportSpotPreference: 'central',
    defensiveCommit: 0.65,
    riskAppetite: 0.5,
    dribbleBias: 0.42,
    verticalityBias: 0.55,
    prefersCombination: true,
  },

  /** Defensive midfielder — wins the ball, keeps it simple, protects the back line */
  ball_winner: {
    id: 'ball_winner',
    offBallRunBias: 0.4,
    supportSpotPreference: 'central',
    defensiveCommit: 0.88,
    riskAppetite: 0.28,
    dribbleBias: 0.2,
    verticalityBias: 0.35,
    prefersCombination: false,
  },

  // -------------------------------------------------------------------------
  // Centre-backs
  // -------------------------------------------------------------------------

  /** Ball-playing centre-back — steps out with the ball, drives into midfield */
  libero: {
    id: 'libero',
    offBallRunBias: 0.3,
    supportSpotPreference: 'central',
    defensiveCommit: 0.75,
    riskAppetite: 0.42,
    dribbleBias: 0.28,
    verticalityBias: 0.48,
    prefersCombination: true,
  },

  /** Classic sweeper — reads danger, clears, stays behind the defensive line */
  sweeper: {
    id: 'sweeper',
    offBallRunBias: 0.15,
    supportSpotPreference: 'central',
    defensiveCommit: 0.95,
    riskAppetite: 0.18,
    dribbleBias: 0.12,
    verticalityBias: 0.28,
    prefersCombination: false,
  },
};
