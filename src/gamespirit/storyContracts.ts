/**
 * Contratos do roteiro ao vivo — GameSpirit como autoridade narrativa.
 * Proibido: predictedWinner, placar final, ou qualquer campo que vaze desfecho no pré-jogo.
 */

/** Intenção tática (áudio / narração futura). */
export enum TacticalIntent {
  HoldShape = 'hold_shape',
  PressHigh = 'press_high',
  BuildUp = 'build_up',
  Progress = 'progress',
  WideOverload = 'wide_overload',
  Counter = 'counter',
  FinalThird = 'final_third',
  Recover = 'recover',
}

export type BeatKind =
  | 'shape'
  | 'press'
  | 'chance_home'
  | 'chance_away'
  | 'set_piece_home'
  | 'set_piece_away'
  | 'card_risk_home'
  | 'card_risk_away'
  | 'narrative'
  /** Espectáculo / resenha — resolvidos em `liveStoryEngine` com várias linhas. */
  | 'play_dribble'
  | 'play_cross'
  | 'play_long_shot'
  /** Falta cometida pela casa (livre / perigo visitante). */
  | 'foul_home'
  /** Falta cometida pelos visitantes (livre casa). */
  | 'foul_away';

export interface BeatPlayerHint {
  /** slotId ou playerId conforme contexto */
  playerRef: string;
  targetUx: number;
  targetUy: number;
  tacticalIntent: TacticalIntent;
}

export interface Beat {
  id: string;
  minuteStart: number;
  minuteEnd: number;
  kind: BeatKind;
  /** Ramos não resolvidos até ao tick (ex.: golo só na resolução do beat). */
  resolved: boolean;
  /** Peso base para resolução (0–1), modulado pela matriz e storyWeights. */
  intensity01: number;
  hints?: BeatPlayerHint[];
  /** Após resolução */
  outcomeTag?: string;
}

export interface StoryTimeline {
  id: string;
  half: 1 | 2;
  beats: Beat[];
  createdAtMs: number;
  /** Seed de variação — não codifica vencedor; só ramifica conteúdo. */
  variationSeed: number;
}

/** Força setorial 0–100 por equipa. */
export interface SectorStrength {
  defensive: number;
  creative: number;
  attack: number;
}

/**
 * Cruzamentos setoriais (modulam tipos de beat e probabilidades, não resultado final).
 * Valores ~0.5–1.5 = multiplicador de tensão naquele duelo.
 */
export interface MatchupMatrix {
  defVsAtk: number;
  criVsCri: number;
  atkVsDef: number;
}

export interface StoryWeights {
  /** Pressão / intensidade de duelos */
  duelIntensity: number;
  /** Tendência a gerar oportunidades de finalização */
  chanceRate: number;
  /** Risco disciplinar (cartões) */
  cardPressure: number;
  /** Último comando técnico relevante (eco para debug/UI) */
  lastCommandEcho?: string;
}

export interface CoachCommand {
  id: string;
  text: string;
  sentAtMs: number;
  minuteApprox: number;
  relevant: boolean;
}

export type RelevanceResult =
  | { relevant: true; matchedIntent: TacticalIntent; reason: string }
  | { relevant: false; reason: string };

export interface LivePrematchBundle {
  sectorHome: SectorStrength;
  sectorAway: SectorStrength;
  matrix: MatchupMatrix;
  storyV1Id: string;
  timelineFirstHalf: StoryTimeline;
  storyWeights: StoryWeights;
  highlights: string[];
  preparedAtMs: number;
}

export interface LiveStoryRuntime {
  storyV1Id: string;
  storyV2Id?: string;
  timelineFirstHalf: StoryTimeline;
  timelineSecondHalf?: StoryTimeline;
  storyWeights: StoryWeights;
  coachCommandLog: CoachCommand[];
  /** Golos da partida ao vivo: quando true, placar vem dos beats (GameSpirit), não do remate tático. */
  spiritScoresAuthoritative?: boolean;
  /** Minutos de jogo já processados pelo motor de história (evita duplo tick). */
  lastStoryMinuteProcessed: number;
  /** Debug: impacto de substituição forte (delta setorial). */
  topPlayerImpactScore?: number;
}
