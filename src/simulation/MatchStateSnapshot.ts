import type { PossessionSide } from '@/engine/types';
import type { MatchTruthPhase } from '@/bridge/matchTruthSchema';

/**
 * Snapshot canônico do estado de jogo — inspirado em Simple115 (Google Research Football).
 * Computado 1x por decision tick (4Hz), consumido por todas as utility axes e agentes.
 * Evita leituras dispersas de simState/homeAgents/awayAgents em cada decisão.
 */

/** 5 floats por jogador: x, z, vx, vz, stamina (0-1) */
export const PLAYER_FLOATS = 5;
export const PLAYER_COUNT = 22;

export type GameMode =
  | 'normal'
  | 'freekick'
  | 'corner'
  | 'throwin'
  | 'kickoff'
  | 'penalty'
  | 'goalkick';

export interface MatchStateSnapshot {
  /** Posições + velocidades + stamina: [home0..home10, away0..away10] × 5 floats */
  players: Float32Array;
  /** Bola: [x, z, vx, vz] em metros (world coords) */
  ball: Float32Array;
  /** Modo de jogo canônico — determina action space disponível */
  mode: GameMode;
  possession: PossessionSide;
  /** ID do portador da bola, null se bola livre */
  carrierId: string | null;
  homeScore: number;
  awayScore: number;
  minute: number;
  /** simTime em segundos */
  simTime: number;
}

export function createMatchStateSnapshot(): MatchStateSnapshot {
  return {
    players: new Float32Array(PLAYER_COUNT * PLAYER_FLOATS),
    ball: new Float32Array(4),
    mode: 'normal',
    possession: 'home',
    carrierId: null,
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    simTime: 0,
  };
}

/** Mapeia MatchTruthPhase → GameMode canônico */
export function truthPhaseToGameMode(phase: MatchTruthPhase | 'stopped' | 'halftime' | 'fulltime'): GameMode {
  switch (phase) {
    case 'corner_kick': return 'corner';
    case 'throw_in': return 'throwin';
    case 'kickoff': return 'kickoff';
    case 'goal_kick': return 'goalkick';
    case 'dead_ball': return 'freekick';
    default: return 'normal';
  }
}

export interface PlayerPositionEntry {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  stamina: number;
}

/**
 * Atualiza o snapshot in-place — zero alocação por tick.
 * homePlayers e awayPlayers devem ter exatamente 11 entradas cada.
 */
export function updateMatchStateSnapshot(
  snap: MatchStateSnapshot,
  homePlayers: PlayerPositionEntry[],
  awayPlayers: PlayerPositionEntry[],
  ball: { x: number; z: number; vx: number; vz: number },
  mode: GameMode,
  possession: PossessionSide,
  carrierId: string | null,
  homeScore: number,
  awayScore: number,
  minute: number,
  simTime: number,
): void {
  const p = snap.players;
  for (let i = 0; i < 11; i++) {
    const ag = homePlayers[i];
    if (!ag) continue;
    const base = i * PLAYER_FLOATS;
    p[base]     = ag.x;
    p[base + 1] = ag.z;
    p[base + 2] = ag.vx;
    p[base + 3] = ag.vz;
    p[base + 4] = ag.stamina;
  }
  for (let i = 0; i < 11; i++) {
    const ag = awayPlayers[i];
    if (!ag) continue;
    const base = (11 + i) * PLAYER_FLOATS;
    p[base]     = ag.x;
    p[base + 1] = ag.z;
    p[base + 2] = ag.vx;
    p[base + 3] = ag.vz;
    p[base + 4] = ag.stamina;
  }
  snap.ball[0] = ball.x;
  snap.ball[1] = ball.z;
  snap.ball[2] = ball.vx;
  snap.ball[3] = ball.vz;
  snap.mode = mode;
  snap.possession = possession;
  snap.carrierId = carrierId;
  snap.homeScore = homeScore;
  snap.awayScore = awayScore;
  snap.minute = minute;
  snap.simTime = simTime;
}
