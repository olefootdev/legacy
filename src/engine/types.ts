import type { CausalLogState, EngineSimPhase } from '@/match/causal/matchCausalTypes';
import type { MatchCognitiveArchetype, MatchPlayerAttributes } from '@/match/playerInMatch';
import type { TeamStyleMatchMetrics } from '@/tactics/playingStyle';
import type {
  CoachCommand,
  LivePrematchBundle,
  LiveStoryRuntime,
} from '@/gamespirit/storyContracts';
import type { ImpactLedgerEntry } from '@/match/impactTypes';
import type { FormationSchemeId } from '@/match-engine/types';
import type { PenaltyState, SpiritOverlay, SpiritPhase } from '@/gamespirit/spiritSnapshotTypes';

export type { PenaltyState, SpiritOverlay, SpiritPhase } from '@/gamespirit/spiritSnapshotTypes';

/** `test2d` = partida ao vivo MVP (campo 2D + motor tático + coreografia causal). */
export type MatchMode = 'quick' | 'auto' | 'test2d';

export type MatchPhase = 'pregame' | 'playing' | 'postgame';

/** Relógio da partida (incl. interpolação do relógio em campo 2D). */
export type LiveMatchClockPeriod = 'first_half' | 'halftime' | 'second_half';

export type PossessionSide = 'home' | 'away';

export interface PitchPoint {
  x: number;
  y: number;
}

export interface PitchPlayerState {
  playerId: string;
  /** Slot tático na formação (ex.: mc1, zag1) — necessário para papel coletivo no sim */
  slotId: string;
  name: string;
  num: number;
  pos: string;
  x: number;
  y: number;
  fatigue: number;
  role: 'attack' | 'mid' | 'def' | 'gk';
  /** Atributos de partida normalizados (opcional: preenchido a partir do elenco) */
  attributes?: MatchPlayerAttributes;
  /** Perfil cognitivo para decisão individual (opcional) */
  cognitiveArchetype?: MatchCognitiveArchetype;
}

export type GoalBuildUp = 'positional' | 'counter';

export interface MatchEventEntry {
  id: string;
  minute: number;
  text: string;
  kind: 'narrative' | 'goal_home' | 'goal_away' | 'whistle' | 'sub' | 'yellow_home' | 'red_home' | 'yellow_away' | 'red_away' | 'injury_home' | 'penalty_start' | 'penalty_result';
  /** Jogador da casa (golo, cartões, lesão) ou metadado de golo visitante quando aplicável */
  playerId?: string;
  /** Barra de momento: true em qualquer golo. */
  momentumFlash?: boolean;
  /** Estilo da jogada de golo: posicional ou contra-ataque. */
  goalBuildUp?: GoalBuildUp;
  /** 0–1 posição ideal da barra de momento no instante do golo (home=1, away=0). */
  threatBar01?: number;
}

/**
 * Relógio de jogo: 90 minutos = 5400 segundos de futebol.
 * Partida rápida: ~50s reais → SECONDS_PER_TICK = 60 (1 tick = 1 minuto de jogo).
 * UI interpola entre ticks para mostrar MM:SS suave.
 */
export const FOOTBALL_TOTAL_SECONDS = 5400;
export const SECONDS_PER_TICK = 60;
/** Duração real (ms) da animação de antecipação antes de confirmar o golo na UI. */
export const PRE_GOAL_DURATION_MS = 3000;

/** Hint visual: barra cresce e desliza até ao extremo antes de confirmar o golo. */
export interface PreGoalHint {
  side: PossessionSide;
  /** ~0.98 (casa marca) ou ~0.02 (visitante marca). */
  threat01Target: number;
  /** Timestamp real (Date.now) quando começou. */
  startedAtMs: number;
  /** Duração da animação de antecipação (ms). */
  durationMs: number;
}

export interface LiveMatchSnapshot {
  mode: MatchMode;
  phase: MatchPhase;
  minute: number;
  /** Relógio de jogo em segundos (0–5400); incrementado por SECONDS_PER_TICK a cada tick. */
  footballElapsedSec: number;
  /** Sincronizado com o TacticalSimLoop / MatchClock (modo live). */
  clockPeriod?: LiveMatchClockPeriod;
  homeScore: number;
  awayScore: number;
  homeShort: string;
  awayShort: string;
  /** Nomes completos para UI (vs. siglas em `homeShort` / `awayShort`). */
  homeName?: string;
  awayName?: string;
  possession: PossessionSide;
  ball: PitchPoint;
  /** Fase lógica do motor causal (última transição no log). */
  engineSimPhase?: EngineSimPhase;
  homePlayers: PitchPlayerState[];
  onBallPlayerId?: string;
  events: MatchEventEntry[];
  /** Log append-only: UI, narrativa e projeções devem preferir isto ao “atalho” de números soltos. */
  causalLog?: CausalLogState;
  /** Estatísticas simples por jogador (lado casa) */
  homeStats: Record<
    string,
    { passesOk: number; passesAttempt: number; tackles: number; km: number; rating: number }
  >;
  /** Formação do time da casa nesta partida (congelada no início / ao salvar titulares). */
  homeFormationScheme?: FormationSchemeId;
  /** Titulares atuais slot → playerId (permite substituições) */
  matchLineupBySlot: Record<string, string>;
  substitutionsUsed: number;
  /** km de viagem debitados nesta partida (logística) */
  travelKm: number;
  /** Seed opcional para reprodutibilidade da resolução de ações no motor tático. */
  simulationSeed?: number;
  /** Métricas agregadas de execução do PlayingStyle (time da casa). */
  styleMetrics?: TeamStyleMatchMetrics;
  /** Aderência ao plano tático (0–100). */
  styleAdherence?: number;

  /** Pré-jogo ao vivo: forças setoriais, matriz, roteiro 1.º tempo — sem vencedor/placar. */
  livePrematch?: LivePrematchBundle;
  /** Motor de história GameSpirit (golos/cartões autoritativos no modo ao vivo). */
  liveStory?: LiveStoryRuntime;
  /** Após golo do roteiro: o loop tático deve entrar em reinício (consumido pela UI). */
  spiritPendingRestart?: { side: PossessionSide } | null;
  /** Jogadores expulsos (não elegíveis para voltar à mesma partida). */
  sentOffPlayerIds?: string[];
  /** Substituições visitantes (paridade FIFA simplificada). */
  awaySubstitutionsUsed?: number;
  /** Auditoria pós-jogo (copiada em FINALIZE_MATCH). */
  lastCoachCommands?: CoachCommand[];
  /** ID da partida no Supabase (quando configurado). */
  supabaseMatchId?: string;

  /** Ledger de fatores de impacto (casa), append-only por evento. */
  homeImpactLedger?: ImpactLedgerEntry[];
  /** Capitão — amplifica só fatores individuais (ver `impactRules.ts`). */
  homeCaptainPlayerId?: string;

  /** Fase lógica GameSpirit (partida rápida / texto) — ver `spiritStateMachine.ts`. */
  spiritPhase?: SpiritPhase;
  /** Painel central (golo, penálti, intervalo, cena). */
  spiritOverlay?: SpiritOverlay | null;
  /** Máquina de penálti (estágios + desfecho). */
  penalty?: PenaltyState | null;
  /** Ticks de minuto em `buildup_gk` antes de voltar a `open_play`. */
  spiritBuildupGkTicksRemaining?: number;
  /** 0–1: força a barra de momento (ex.: extremo de quem marcou durante overlay de golo). */
  spiritMomentumClamp01?: number | null;
  /** Antecipação visual antes de confirmar o golo (barra cresce + desliza). */
  preGoalHint?: PreGoalHint | null;
  /** Roster visitante sintético (partida rápida) — cartões/golos com playerId concreto. */
  awayRoster?: { id: string; num: number; name: string; pos: string }[];

  /* ── Partida ao vivo 2D (`test2d`) ─────────────────────────────────── */

  /** Jogadores visitantes simulados com posicionamento tático. */
  awayPitchPlayers?: PitchPlayerState[];
  /** Tipo da última ação Spirit (progress, shot, recycle…) — para posicionamento tático. */
  spiritActionKind?: string;
  /** Trajeto da bola para interpolação visual contínua entre ticks. */
  ballTrajectory?: {
    from: PitchPoint;
    to: PitchPoint;
    kind: string;
    progress01: number;
  };

  /**
   * Legado: coreografia simples (só persistência antiga). O MVP usa `ultralive2dStagedPlay`.
   */
  test2dVisualBeat?: {
    causalSeqAnchor: number;
    kind: string;
    ballFrom: PitchPoint;
    ballTo: PitchPoint;
    durationMs: number;
    deferredFeedEvent: MatchEventEntry;
  };

  /** Fase tática simples (casa): com bola vs sem — espelho in/out of possession. */
  test2dHomePossessionPhase?: 'in_possession' | 'out_of_possession';

  /**
   * Campo 2D: minutos seguidos em que a casa manteve posse com ação só `recycle`.
   */
  live2dDecisionStagnationTicks?: number;

  /**
   * Legado: coreografia diferida; no MVP o feed entra logo em `runMatchMinute` (campo 2D segue o truth).
   */
  ultralive2dStagedPlay?: Ultralive2dStagedPlay;
}

/** Payload de coreografia no snapshot (motor → viewer → reducer). */
export interface Ultralive2dStagedPlay {
  causalSeqAnchor: number;
  kind: string;
  ballFrom: PitchPoint;
  ballTo: PitchPoint;
  durationMs: number;
  substeps: number;
  deferredFeedEvent: MatchEventEntry;
  heroPlayerIds: string[];
  heroBurstOffsets: { playerId: string; ox: number; oy: number }[];
}
