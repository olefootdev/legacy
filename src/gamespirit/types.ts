import type { PitchPlayerState, PitchPoint, PossessionSide } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import type { CrowdSpiritPressure } from '@/systems/crowdSpirit';
import type { CausalMatchEvent } from '@/match/causal/matchCausalTypes';
import type { TeamTacticalStyle } from '@/tactics/playingStyle';
import type { PenaltyState, SpiritOverlay, SpiritPhase } from '@/gamespirit/spiritSnapshotTypes';
import type { MotorTelemetryRecord } from '@/match/motorActionOutcome';

export type ProposedAction =
  | 'recycle'
  | 'progress'
  | 'shot'
  | 'press'
  | 'clear'
  | 'counter';

export type BallZone = 'def' | 'mid' | 'att';

export interface SpiritContext {
  minute: number;
  homeScore: number;
  awayScore: number;
  possession: PossessionSide;
  onBall?: PitchPlayerState;
  ball: PitchPoint;
  crowdSupport: number;
  tacticalMentality: number;
  tacticalStyle?: TeamTacticalStyle;
  opponentStrength: number;
  homeTeamAvg: number;
  nearbyOpponentDist: number;
  ballZone: BallZone;
  nearestTeammateDist: number;
  homeDensityNearBall: number;
  crowdPressure: CrowdSpiritPressure;
  /** Textos recentes do feed (mais recente primeiro), para continuidade narrativa. */
  recentFeedLines?: string[];
  /** Média de fadiga (0–100) dos jogadores da casa em campo. */
  avgHomeFatigue: number;
  homeShort?: string;
  /** Jogadores da casa em campo — para narrativa com dois intervenientes. */
  homePlayers?: PitchPlayerState[];
  /** Roster sintético visitante — usado para atribuir golo/cartão a jogador real. */
  awayRoster?: { id: string; num: number; name: string; pos: string }[];

  /**
   * TESTE 2D: in/out de posse (casa) — modula probabilidades no `pickAction` / condução.
   */
  test2dTickModifiers?: {
    homeInPossession: boolean;
    progressLossMult: number;
    shotInAttThirdBias: number;
    awayPressMult: number;
  };

  /** live2d: ticks de estagnação (recycle em cadeia) — força condução/passe. */
  live2dStagnationTicks?: number;

  /**
   * Opcional: últimos outcomes do motor tático (ex.: `SimMatchState.motorOutcomeLog`),
   * para narração reativa sem o Spirit “decidir” o resultado antes da simulação.
   */
  motorTelemetryTail?: readonly MotorTelemetryRecord[];

  /**
   * Conhecimento de posição do jogador com a bola (positionKnowledge do PlayerEntity).
   * Lido localmente do estado do jogador — zero tokens, zero chamadas externas.
   * Injetado por `buildSpiritContext` quando o jogador tem DNA de lenda treinado.
   */
  onBallKnowledge?: import('@/gamespirit/legacy/positionKnowledgeTypes').PositionKnowledge;
  /** Ticks restantes de cooldown pós-pênalti (bloqueia novo pênalti enquanto > 0). */
  penaltyCooldownTicks?: number;
  /**
   * Booster agregado dos jogadores LegacyDNA titulares em campo.
   * Soma dos `legacyTeamBooster` de cada legacy presente em `homePlayers` (XI inicial).
   * Consumido por moral de time, posse, defesa/ataque etc.
   */
  legacyTeamBooster?: Record<string, number>;

  /**
   * Momentum acumulado entre ticks (-1..+1 por lado).
   * Injetado pelo caller; o tick atualiza e retorna novo valor em `spiritMeta.momentum`.
   */
  momentum?: import('@/gamespirit/momentum').MomentumState;

  /**
   * Escanteio pendente desde o tick anterior — força cabeçada nessa posse.
   * Consumido/limpo no tick corrente via `spiritMeta.pendingCornerForSide = null`.
   */
  pendingCornerForSide?: PossessionSide | null;
}

/** Patch opcional ao estado de espírito / overlay no snapshot (só chaves definidas são aplicadas). */
export interface SpiritSnapshotMeta {
  spiritPhase?: SpiritPhase;
  spiritOverlay?: SpiritOverlay | null;
  penalty?: PenaltyState | null;
  spiritBuildupGkTicksRemaining?: number;
  spiritMomentumClamp01?: number | null;
  preGoalHint?: import('@/engine/types').PreGoalHint | null;
  /** Momentum atualizado com os eventos deste tick. */
  momentum?: import('@/gamespirit/momentum').MomentumState;
  /** Set/limpa hint de escanteio entre ticks. `null` = consumido. */
  pendingCornerForSide?: PossessionSide | null;
}

export interface SpiritOutcome {
  narrative: string;
  action: ProposedAction;
  nextPossession: PossessionSide;
  ball: PitchPoint;
  /** Derivado do log causal (shot_result); manter alinhado com `causalEvents`. */
  goalFor?: PossessionSide;
  /** Id real do marcador (home = playerId do elenco; away = id sintético do roster). */
  goalScorerPlayerId?: string;
  /** Posicional ou contra-ataque — só definido quando `goalFor` está presente. */
  goalBuildUp?: import('@/engine/types').GoalBuildUp;
  /** 0–1 barra de momento no instante do golo (home=1, away=0). */
  threatBar01?: number;
  statDeltas?: {
    playerId: string;
    passesOk?: number;
    passesAttempt?: number;
    tackles?: number;
    km?: number;
  };
  /** Append-only deste tick; placar e bola coerentes com estas entradas. */
  causalEvents: CausalMatchEvent[];
  /** Campos de `LiveMatchSnapshot` (GameSpirit como autoridade de posse/bola/overlay em quick). */
  spiritMeta?: SpiritSnapshotMeta;
}

export interface SpiritPlayerBrainInput {
  self: PlayerEntity;
  ctx: SpiritContext;
}
