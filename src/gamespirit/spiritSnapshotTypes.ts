/**
 * Estado de jogo lógico ao nível do GameSpirit (partida rápida / texto).
 * Distinto de `engineSimPhase` no log causal e do FSM 3D (Babylon).
 * Sem importar `@/engine/types` (evita ciclo com `LiveMatchSnapshot`).
 */

export type PossessionSideSpirit = 'home' | 'away';

export type SpiritPhase =
  | 'open_play'
  | 'shot_resolve'
  | 'buildup_gk'
  | 'set_piece'
  | 'penalty'
  | 'celebration_goal';

export type SpiritOverlayKind = 'halftime' | 'goal' | 'penalty' | 'scene' | 'red_card';

export interface SpiritOverlay {
  kind: SpiritOverlayKind;
  title: string;
  lines: string[];
  startedAtMs: number;
  autoDismissMs: number;
}

export type PenaltyStage = 'banner' | 'walk' | 'kick' | 'result';

/** Desfecho do penálti (UI + narrativa). */
export type PenaltyOutcomeKind = 'goal' | 'miss_wide' | 'save' | 'post_in' | 'post_out' | 'miss_far';

export interface PenaltyState {
  stage: PenaltyStage;
  /** Quem bate o penálti. */
  side: PossessionSideSpirit;
  takerName: string;
  /** PlayerId do cobrador (para atribuir golo/evento ao jogador correto). */
  takerId?: string;
  outcome?: PenaltyOutcomeKind;
}

/** Resultado lógico de um remate da casa (antes de mapear para causal `shot_result`). */
export type HomeShotLogicalOutcome =
  | 'goal'
  | 'post_in'
  | 'save'
  | 'block'
  | 'wide'
  | 'post_out'
  | 'miss_far';

export interface SpiritBallPossessionPatch {
  possession: PossessionSideSpirit;
  ball: { x: number; y: number };
  spiritPhase: SpiritPhase;
  /** Ticks de minuto a saltar lance completo do Spirit enquanto > 0; decrementa em `runMatchMinute`. */
  spiritBuildupGkTicksRemaining: number;
}
