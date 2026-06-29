/**
 * Match Global — Liga Viva (Elifoot-style)
 *
 * Sistema de rodadas automáticas onde TODOS os jogos acontecem simultaneamente.
 * O manager NÃO interage durante a partida — apenas ASSISTE.
 * Decisões são tomadas ANTES via comandos do treinador.
 */

import type { PossessionSide } from '@/engine/types';

/** Status da rodada global */
export type GlobalRoundStatus =
  | 'scheduled'    // Agendada, aguardando início
  | 'pre_match'    // Janela de comandos aberta (até 5min antes)
  | 'locked'       // Comandos fechados, aguardando kickoff
  | 'live'         // Jogos em andamento (3 minutos)
  | 'finished';    // Rodada concluída

/** Postura tática definida pelo manager */
export type TacticalPosture = 'offensive' | 'balanced' | 'defensive';

/** Intensidade de jogo */
export type MatchIntensity = 'high' | 'medium' | 'low';

/** Estilo de jogo */
export type PlayingStyle = 'possession' | 'counter' | 'direct';

/** Comandos do treinador (definidos pré-jogo) */
export interface CoachCommands {
  posture: TacticalPosture;
  intensity: MatchIntensity;
  style: PlayingStyle;
  /** Timestamp de quando foi definido */
  setAtMs: number;
}

/** Tipo de evento global */
export type GlobalEventType =
  | 'goal'
  | 'yellow_card'
  | 'red_card'
  | 'injury'
  | 'substitution'
  | 'pressure'
  | 'miss'
  | 'walkover'
  | 'penalty'
  | 'crown';

/** Evento que acontece durante a rodada */
export interface GlobalMatchEvent {
  id: string;
  fixtureId: string;
  type: GlobalEventType;
  minute: number;
  /** Timestamp real (Date.now) quando o evento foi gerado */
  timestampMs: number;
  side: PossessionSide;
  playerName?: string;
  playerId?: string;
  text: string;
  /** Se true, destaca visualmente no painel */
  highlight?: boolean;
}

/** Destaque global (eventos importantes para todo o painel) */
export interface GlobalHighlight {
  id: string;
  type: 'leader_goal' | 'comeback' | 'decisive_red' | 'upset';
  fixtureId: string;
  text: string;
  timestampMs: number;
}

/** Partida dentro da rodada global */
export interface GlobalFixture {
  id: string;
  roundId: string;
  division: string;

  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;

  /** Overall dos times (para matchmaking visual) */
  homeOverall: number;
  awayOverall: number;

  /** Placar atual */
  scoreHome: number;
  scoreAway: number;

  /** Minuto atual do jogo (0-90) */
  currentMinute: number;

  /** Comandos definidos pelos managers */
  homeCommands?: CoachCommands;
  awayCommands?: CoachCommands;

  /** Eventos da partida */
  events: GlobalMatchEvent[];

  /** Status específico da partida */
  status: 'scheduled' | 'live' | 'finished';

  /** Timestamp de início real */
  kickoffMs?: number;

  /** Timestamp de fim real */
  finishedAtMs?: number;

  /** Pênaltis — só no mata-mata diário, quando empata no tempo normal */
  penaltyScoreHome?: number;
  penaltyScoreAway?: number;
  wentToPenalties?: boolean;
  /** #4: WO por elenco incompleto (<11). O lado true perdeu 0×3 por ausência. */
  woHome?: boolean;
  woAway?: boolean;
}

/** Rodada global completa */
export interface GlobalRound {
  id: string;
  /** Número sequencial da rodada (1, 2, 3...) */
  roundNumber: number;

  /** Status geral da rodada */
  status: GlobalRoundStatus;

  /** Timestamp agendado para início */
  scheduledKickoffMs: number;

  /** Timestamp real de início dos jogos */
  actualKickoffMs?: number;

  /** Timestamp de fim da rodada */
  finishedAtMs?: number;

  /** Todas as partidas da rodada */
  fixtures: GlobalFixture[];

  /** Destaques globais da rodada */
  highlights: GlobalHighlight[];

  /** Duração esperada da rodada (ms) — padrão 3 minutos */
  durationMs: number;
}

/** Estado global da liga */
export interface GlobalLeagueState {
  /** Rodada atual */
  currentRound?: GlobalRound;

  /** Histórico de rodadas (últimas 5) */
  recentRounds: GlobalRound[];

  /** Próxima rodada agendada */
  nextScheduledMs?: number;

  /** Configuração: intervalo entre rodadas (ms) — padrão 1 hora */
  roundIntervalMs: number;

  /** Configuração: janela de comandos antes do kickoff (ms) — padrão 5 min */
  commandWindowMs: number;
}

/** Consequências pós-rodada */
export interface RoundConsequences {
  roundId: string;

  /** Jogadores suspensos (cartão vermelho ou acúmulo de amarelos) */
  suspensions: Array<{
    playerId: string;
    playerName: string;
    teamId: string;
    reason: 'red_card' | 'yellow_accumulation';
    roundsToServe: number;
  }>;

  /** Jogadores lesionados */
  injuries: Array<{
    playerId: string;
    playerName: string;
    teamId: string;
    severity: 'light' | 'moderate' | 'severe';
    recoveryRounds: number;
  }>;

  /** Mudanças na tabela */
  standingsChanges: Array<{
    teamId: string;
    teamName: string;
    previousPosition: number;
    newPosition: number;
    pointsGained: number;
  }>;
}

/** Constantes do sistema (Liga Global) */
export const GLOBAL_MATCH_CONSTANTS = {
  /** Duração de cada rodada ao vivo (1 minuto real ≡ 90min de jogo) */
  ROUND_DURATION_MS: 1 * 60 * 1000,

  /** Intervalo entre kickoffs dentro de um slot ativo (5 min). */
  ROUND_INTERVAL_MS: 5 * 60 * 1000,

  /** Janela para definir comandos (1 min — pre_match_lock) */
  COMMAND_WINDOW_MS: 1 * 60 * 1000,

  /** Janela 1: descanso e recuperação pós-jogo (1.5min). */
  RECOVERY_WINDOW_MS: 90 * 1000,

  /** Janela 2: preparação e evolução / treinos (1.5min). */
  TRAINING_WINDOW_MS: 90 * 1000,

  /** Janela 3: ajustes técnicos e táticos (1min). */
  TACTICAL_WINDOW_MS: 1 * 60 * 1000,

  /** Janela 4: lock (1min antes do kickoff — sem matchmaking OLEFOOT). */
  LOCK_WINDOW_MS: 1 * 60 * 1000,

  /** Duração de um minuto de jogo em ms real (1min / 90min = 0.67s por minuto) */
  GAME_MINUTE_MS: 667,

  /**
   * Máximo de rodadas por dia: 5 slots × ~30 rodadas/slot = ~150.
   * Cada slot dura 2.5h e roda uma rodada a cada 5min (2.5h ÷ 5min = 30).
   */
  MAX_ROUNDS_PER_DAY: 150,
} as const;

/**
 * Fase fina do ciclo de 5min (derivada do tempo restante até kickoff).
 * Mais granular que GlobalRoundStatus — guia os hooks do coach por janela.
 */
export type CycleWindowPhase = 'recovery' | 'training' | 'tactical' | 'lock' | 'live' | 'finished';

/**
 * Retorna a janela atual do ciclo dado um round agendado e o tempo atual.
 * Janelas (contadas regressivamente a partir do kickoff, ciclo de 5min):
 *  - [-5min   .. -3.5min] → recovery (1.5min)
 *  - [-3.5min .. -2min]   → training (1.5min)
 *  - [-2min   .. -1min]   → tactical (1min)
 *  - [-1min   .. 0]       → lock (1min)
 *  - [0 .. +duration]     → live
 *  - depois               → finished
 */
export function getCycleWindowPhase(round: GlobalRound, nowMs: number): CycleWindowPhase {
  const k = round.scheduledKickoffMs;
  const I = GLOBAL_MATCH_CONSTANTS.ROUND_INTERVAL_MS;
  const lockEnd = k;
  const lockStart = k - GLOBAL_MATCH_CONSTANTS.LOCK_WINDOW_MS;
  const tacticalStart = lockStart - GLOBAL_MATCH_CONSTANTS.TACTICAL_WINDOW_MS;
  const trainingStart = tacticalStart - GLOBAL_MATCH_CONSTANTS.TRAINING_WINDOW_MS;
  const recoveryStart = k - I;

  const liveEnd = (round.actualKickoffMs ?? k) + round.durationMs;
  if (round.status === 'finished' || nowMs >= liveEnd) return 'finished';
  if (round.status === 'live' || nowMs >= lockEnd) return 'live';
  if (nowMs >= lockStart) return 'lock';
  if (nowMs >= tacticalStart) return 'tactical';
  if (nowMs >= trainingStart) return 'training';
  if (nowMs >= recoveryStart) return 'recovery';
  return 'recovery';
}

/**
 * Liga LEGACY trava o matchmaking OLEFOOT durante lock + live (não pode pegar nova partida).
 * Bridge para o futuro módulo OLEFOOT consumir.
 */
export function isLegacyMatchmakingLocked(round: GlobalRound | undefined, nowMs: number): boolean {
  if (!round) return false;
  const phase = getCycleWindowPhase(round, nowMs);
  return phase === 'lock' || phase === 'live';
}

/** Helpers */

export function isCommandWindowOpen(round: GlobalRound, nowMs: number): boolean {
  if (round.status !== 'pre_match') return false;
  const windowStart = round.scheduledKickoffMs - GLOBAL_MATCH_CONSTANTS.COMMAND_WINDOW_MS;
  return nowMs >= windowStart && nowMs < round.scheduledKickoffMs;
}

export function isRoundLive(round: GlobalRound, nowMs: number): boolean {
  if (round.status !== 'live' || !round.actualKickoffMs) return false;
  const endMs = round.actualKickoffMs + round.durationMs;
  return nowMs >= round.actualKickoffMs && nowMs < endMs;
}

export function getCurrentGameMinute(fixture: GlobalFixture, nowMs: number): number {
  if (!fixture.kickoffMs || fixture.status !== 'live') return 0;
  const elapsedMs = nowMs - fixture.kickoffMs;
  const minute = Math.floor(elapsedMs / GLOBAL_MATCH_CONSTANTS.GAME_MINUTE_MS);
  return Math.min(90, Math.max(0, minute));
}

export function createEmptyGlobalLeagueState(): GlobalLeagueState {
  return {
    recentRounds: [],
    roundIntervalMs: GLOBAL_MATCH_CONSTANTS.ROUND_INTERVAL_MS,
    commandWindowMs: GLOBAL_MATCH_CONSTANTS.COMMAND_WINDOW_MS,
  };
}

export function newGlobalRoundId(): string {
  return `gr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newGlobalFixtureId(): string {
  return `gf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newGlobalEventId(): string {
  return `ge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
