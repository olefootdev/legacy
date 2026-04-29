import type { InjurySeverity } from '@/systems/injury';

/**
 * Single Source of Truth para saúde/disponibilidade de um jogador.
 * Lido por TODOS os modos (quick, auto, test2d, global, penalty, friendly).
 * Substitui os campos `fatigue/injuryRisk/outForMatches` espalhados em PlayerEntity.
 */
export interface PlayerHealth {
  playerId: string;

  /** 0–100. >=90 = crítico (dobra risco de lesão ao entrar em campo). */
  fatigue: number;
  /** 0–100. Acumulado por jogos extenuantes; reseta com descanso/booster. */
  injuryRisk: number;

  /** Jogos restantes indisponível (qualquer modo: liga, amistoso, global). */
  outForMatches: number;
  /** Severidade da lesão atual; null se saudável ou apenas suspenso. */
  injurySeverity: InjurySeverity | null;

  /** Amarelos por liga (suspensão escopo-liga). */
  yellowCardsByLeague: Record<string, number>;
  /** Jogos restantes suspenso por cartão vermelho/acumulado. */
  suspendedMatches: number;

  /** Derivado: fadiga >=80 OU injuryRisk >=70. AI usa pra propor descanso. */
  atRisk: boolean;

  /** Timestamp da última partida que afetou esta saúde. */
  lastMatchAt: number;
  /** Modo da última partida — debug/telemetria. */
  lastMatchMode: MatchModeForHealth | null;
}

/** Modos que produzem efeito de saúde unificado. */
export type MatchModeForHealth =
  | 'quick'
  | 'auto'
  | 'test2d'
  | 'global'
  | 'penalty'
  | 'friendly';

export type InjurySeverityCode = InjurySeverity;

/* ───────────────────────── Eventos por partida ─────────────────────────
 * Todo modo de partida emite uma lista de MatchOutcomeEvent ao final.
 * `applyMatchConsequences(state, events)` é o ÚNICO ponto que muta playerHealth.
 * ──────────────────────────────────────────────────────────────────── */

interface BaseEvent {
  playerId: string;
  matchId: string;
  matchMode: MatchModeForHealth;
  /** Liga/competição — usado para escopo de cartões amarelos. */
  leagueId?: string;
  at: number;
}

export interface PlayedEvent extends BaseEvent {
  type: 'played';
  /** Minutos jogados (0–120). */
  minutes: number;
  /** Intensidade média (0–1) — alimenta acúmulo de fadiga e injuryRisk. */
  intensity: number;
}

export interface InjuryEvent extends BaseEvent {
  type: 'injury';
  severity: InjurySeverity;
}

export interface YellowCardEvent extends BaseEvent {
  type: 'yellow_card';
  leagueId: string;
}

export interface RedCardEvent extends BaseEvent {
  type: 'red_card';
  /** Direto vs. segundo amarelo — ambos suspendem ao menos 1 jogo. */
  reason: 'direct' | 'second_yellow';
}

export interface SuspensionEvent extends BaseEvent {
  type: 'suspension';
  /** Jogos a cumprir (ex.: 1 vermelho direto, 2 violência). */
  matches: number;
}

export type MatchOutcomeEvent =
  | PlayedEvent
  | InjuryEvent
  | YellowCardEvent
  | RedCardEvent
  | SuspensionEvent;

/** Resumo retornado por applyMatchConsequences — UI/AI consumem. */
export interface MatchHealthOutcome {
  playerId: string;
  before: PlayerHealth;
  after: PlayerHealth;
  injured: InjurySeverity | null;
  newlySuspended: boolean;
  becameAtRisk: boolean;
}
