/**
 * MatchTruth v2 — contrato estável entre simulação, bridge e render (Babylon).
 * fieldSchemaVersion alinha com gramado/admin quando existir.
 */
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

export type CameraCueKind = 'goal_shake' | 'zoom_finish' | 'reset';

export interface CameraCue {
  kind: CameraCueKind;
  /** força 0–1 */
  intensity?: number;
  /** ms desde t=0 da sim */
  at?: number;
}

/** Cores do uniforme vindas do engine/save — render só aplica. */
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
  /** Número da camisa (label na entidade). */
  shirtNumber?: number;
}

export interface MatchTruthSnapshot {
  schemaVersion: number;
  /** Alinhado ao catálogo de zonas / Admin (`olefoot-field-v1`, …). */
  fieldSchemaVersion?: string;
  t: number;
  /** Velocidade da bola no plano XZ (mundo tático) — Match Director / render. */
  ball: { x: number; y: number; z: number; vx?: number; vz?: number };
  players: MatchTruthPlayer[];
  matchPhase: MatchTruthPhase;
  cameraCues?: CameraCue[];
  /** Kits por lado — enviado no primeiro snapshot ou quando muda. */
  kits?: { home: TeamKit; away: TeamKit };
  /**
   * Contagem regressiva (segundos inteiros restantes) antes do pontapé de saída do 2.º tempo,
   * com equipas já na formação de saída e trocadas de campo.
   */
  secondHalfResumeCountdownSec?: number;
}

export function serializeMatchTruth(s: MatchTruthSnapshot): string {
  return JSON.stringify(s);
}
