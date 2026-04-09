/**
 * Contrato único: fases e eventos da simulação de campo (autoritativo).
 * Narrativa, YUKA e render devem derivar disto — não o contrário.
 */

export type SimulationMatchPhase =
  | 'OPEN_PLAY'
  | 'STOPPED'
  | 'SET_PIECE_CORNER'
  | 'SET_PIECE_THROW_IN'
  | 'SET_PIECE_GOAL_KICK'
  | 'KICKOFF'
  | 'DEAD_BALL'
  | 'PREGAME'
  | 'HALFTIME'
  | 'GOAL_CELEBRATION';

export type MatchSimulationEvent =
  | { kind: 'PhaseChanged'; from: SimulationMatchPhase; to: SimulationMatchPhase; at: number }
  | { kind: 'BallPositionChanged'; x: number; z: number; at: number }
  | { kind: 'PossessionChanged'; side: 'home' | 'away'; at: number }
  | { kind: 'Whistle'; reason: string; at: number }
  | { kind: 'PassAttempt'; fromPlayerId: string; at: number }
  | { kind: 'PassCompleted'; fromPlayerId: string; toPlayerId: string; at: number }
  | { kind: 'Shot'; playerId: string; at: number }
  | {
      kind: 'SetPiecePosition';
      piece: 'corner' | 'throw_in' | 'goal_kick';
      side: 'home' | 'away';
      at: number;
    }
  | { kind: 'Goal'; side: 'home' | 'away'; at: number }
  | { kind: 'KickoffTaken'; at: number }
  | { kind: 'EngineNarrativeLine'; text: string; minute: number; at: number }
  /** Cadeia causal textual (minuto): remate antes do golo. */
  | {
      kind: 'CausalShotAttempt';
      side: 'home' | 'away';
      shooterId: string;
      zone: string;
      minute: number;
      at: number;
    }
  | {
      kind: 'CausalShotResult';
      side: 'home' | 'away';
      shooterId: string;
      outcome: 'goal' | 'save' | 'miss' | 'block' | 'post_in' | 'post_out' | 'wide';
      at: number;
    }
  | { kind: 'CausalEnginePhase'; from: string; to: string; reason?: string; at: number }
  | { kind: 'CausalBallState'; xPercent: number; yPercent: number; reason: string; at: number };

import type { MatchTruthPhase } from '@/bridge/matchTruthSchema';

export function truthPhaseToSimulationPhase(
  truth: MatchTruthPhase,
  liveEnginePhase: 'pregame' | 'playing' | 'postgame' | null,
): SimulationMatchPhase {
  if (liveEnginePhase === 'pregame') return 'PREGAME';
  if (liveEnginePhase === 'postgame') return 'DEAD_BALL';
  switch (truth) {
    case 'live':
      return 'OPEN_PLAY';
    case 'goal_restart':
      return 'STOPPED';
    case 'kickoff':
      return 'KICKOFF';
    case 'corner_kick':
      return 'SET_PIECE_CORNER';
    case 'throw_in':
      return 'SET_PIECE_THROW_IN';
    case 'goal_kick':
      return 'SET_PIECE_GOAL_KICK';
    case 'dead_ball':
      return 'STOPPED';
    case 'pregame_visual':
      return 'PREGAME';
    default:
      return 'STOPPED';
  }
}
