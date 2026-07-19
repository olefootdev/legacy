import type { LiveMatchSnapshot, MatchEventEntry } from '@/engine/types';
import type { PlayerAttributes, PlayerEntity } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';

/** Agregados da temporada (UI / Meu Time) — actualizados em `FINALIZE_MATCH` e treinos. */
export interface PlayerSeasonLedgerEntry {
  matchesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  passesOk: number;
  passesAttempt: number;
  tackles: number;
  kmTotal: number;
  shots: number;
  /** Planos de treino concluídos (centro de treino / fila). */
  trainingPlansCompleted: number;
  /** Contagem por tipo de treino. */
  trainingByType: Record<string, number>;
  /** Sessões de treino leve (`TRAINING_SESSION`) por jogador. */
  trainingLightSessions: number;
  /** Valor de mercado (BRO centavos) na primeira actividade registada na temporada. */
  seasonBaselineMarketBroCents?: number;
  /** Valor de mercado após o último jogo finalizado (referência para tendência curta). */
  lastMarketBroCentsAfterMatch?: number;
}

export type PlayerSeasonLedgerMap = Record<string, PlayerSeasonLedgerEntry>;

export const PLAYER_SEASON_ATTR_KEYS: (keyof PlayerAttributes)[] = [
  'passe',
  'marcacao',
  'velocidade',
  'drible',
  'finalizacao',
  'fisico',
  'tatico',
  'mentalidade',
  'confianca',
  'fairPlay',
];

export const PLAYER_SEASON_ATTR_LABELS: Record<keyof PlayerAttributes, string> = {
  passe: 'Passe',
  marcacao: 'Marcação',
  velocidade: 'Velocidade',
  drible: 'Drible',
  finalizacao: 'Finalização',
  fisico: 'Físico',
  tatico: 'Tático',
  mentalidade: 'Mentalidade',
  confianca: 'Confiança',
  fairPlay: 'Fair play',
};

const TRAINING_TYPE_LABELS: Record<string, string> = {
  fisico: 'Físico',
  mental: 'Mental',
  tatico: 'Tático',
  atributos: 'Atributos',
  especial: 'Especial',
  formacao: 'Formação',
  empatia: 'Empatia',
  sessao_leve: 'Treino leve (sessão)',
  outro: 'Outro',
};

export function trainingTypeLabel(key: string): string {
  return TRAINING_TYPE_LABELS[key] ?? key;
}

export function emptyPlayerSeasonLedgerEntry(): PlayerSeasonLedgerEntry {
  return {
    matchesPlayed: 0,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    passesOk: 0,
    passesAttempt: 0,
    tackles: 0,
    kmTotal: 0,
    shots: 0,
    trainingPlansCompleted: 0,
    trainingByType: {},
    trainingLightSessions: 0,
  };
}

function ensureEntry(map: PlayerSeasonLedgerMap, playerId: string): PlayerSeasonLedgerEntry {
  if (!map[playerId]) {
    map[playerId] = emptyPlayerSeasonLedgerEntry();
  }
  return map[playerId]!;
}

function ingestHomeEvent(e: MatchEventEntry, map: PlayerSeasonLedgerMap): void {
  const pid = e.playerId;
  if (!pid) return;
  if (e.kind === 'goal_home') {
    ensureEntry(map, pid).goals += 1;
    return;
  }
  if (e.kind === 'yellow_home') {
    ensureEntry(map, pid).yellowCards += 1;
    return;
  }
  if (e.kind === 'red_home') {
    ensureEntry(map, pid).redCards += 1;
  }
}

function playedPlayerIds(lm: LiveMatchSnapshot): string[] {
  const statIds = Object.keys(lm.homeStats ?? {});
  if (statIds.length > 0) return statIds;
  const fromPitch = (lm.homePlayers ?? []).map((h) => h.playerId).filter(Boolean);
  return [...new Set(fromPitch)];
}

/**
 * Agrega uma partida finalizada (casa) ao livro de temporada.
 * `marketBroByPlayer` — valores de mercado (centavos BRO) antes da evolução pós-jogo, para baseline.
 */
export function mergeLedgerAfterMatch(
  ledger: PlayerSeasonLedgerMap,
  lm: LiveMatchSnapshot,
  marketBroByPlayer?: Record<string, number | undefined>,
): PlayerSeasonLedgerMap {
  const next: PlayerSeasonLedgerMap = { ...ledger };
  const played = playedPlayerIds(lm);

  for (const pid of played) {
    const e = ensureEntry(next, pid);
    e.matchesPlayed += 1;
    const mv = marketBroByPlayer?.[pid];
    if (mv != null && Number.isFinite(mv) && e.seasonBaselineMarketBroCents == null) {
      e.seasonBaselineMarketBroCents = Math.max(0, Math.round(mv));
    }
  }

  for (const [pid, row] of Object.entries(lm.homeStats ?? {})) {
    const e = ensureEntry(next, pid);
    e.passesOk += row.passesOk ?? 0;
    e.passesAttempt += row.passesAttempt ?? 0;
    e.tackles += row.tackles ?? 0;
    e.kmTotal += row.km ?? 0;
    const ext = row as { shots?: number };
    e.shots += ext.shots ?? 0;
  }

  for (const ev of lm.events ?? []) {
    ingestHomeEvent(ev, next);
  }

  return next;
}

/** Após actualizar `players` com evolução pós-jogo, grava referência de mercado para a UI. */
export function ledgerTouchMarketAfterMatch(
  ledger: PlayerSeasonLedgerMap,
  playerIds: string[],
  marketAfterBroByPlayer: Record<string, number | undefined>,
): PlayerSeasonLedgerMap {
  const next = { ...ledger };
  for (const pid of playerIds) {
    const v = marketAfterBroByPlayer[pid];
    if (v == null || !Number.isFinite(v)) continue;
    const e = ensureEntry(next, pid);
    e.lastMarketBroCentsAfterMatch = Math.max(0, Math.round(v));
  }
  return next;
}

export function mergeLedgerAfterTrainingPlan(
  ledger: PlayerSeasonLedgerMap,
  playerIds: string[],
  trainingType: string,
  marketBroByPlayer?: Record<string, number | undefined>,
): PlayerSeasonLedgerMap {
  const next = { ...ledger };
  const k = trainingType || 'outro';
  for (const pid of playerIds) {
    const e = ensureEntry(next, pid);
    e.trainingPlansCompleted += 1;
    e.trainingByType[k] = (e.trainingByType[k] ?? 0) + 1;
    const mv = marketBroByPlayer?.[pid];
    if (mv != null && Number.isFinite(mv) && e.seasonBaselineMarketBroCents == null) {
      e.seasonBaselineMarketBroCents = Math.max(0, Math.round(mv));
    }
  }
  return next;
}

export function mergeLedgerAfterTrainingLightSession(
  ledger: PlayerSeasonLedgerMap,
  playerIds: string[],
  marketBroByPlayer?: Record<string, number | undefined>,
): PlayerSeasonLedgerMap {
  const next = { ...ledger };
  for (const pid of playerIds) {
    const e = ensureEntry(next, pid);
    e.trainingLightSessions += 1;
    e.trainingByType.sessao_leve = (e.trainingByType.sessao_leve ?? 0) + 1;
    const mv = marketBroByPlayer?.[pid];
    if (mv != null && Number.isFinite(mv) && e.seasonBaselineMarketBroCents == null) {
      e.seasonBaselineMarketBroCents = Math.max(0, Math.round(mv));
    }
  }
  return next;
}

/**
 * Valor de mercado de referência por jogador (número inteiro por id).
 * — Se `marketValueExp` estiver definido (Genesis), usa EXP (livro de temporada guarda o mesmo número nos campos *BroCents* como referência numérica).
 * — Caso contrário, centavos de BRO ou estimativa por OVR.
 */
export function marketBroSnapshotFromPlayers(players: Record<string, PlayerEntity>): Record<string, number> {
  const o: Record<string, number> = {};
  for (const [id, pl] of Object.entries(players)) {
    if (!pl) continue;
    if (pl.marketValueExp != null && Number.isFinite(pl.marketValueExp) && pl.marketValueExp > 0) {
      o[id] = Math.max(0, Math.round(pl.marketValueExp));
    } else if (pl.marketValueBroCents != null && Number.isFinite(pl.marketValueBroCents)) {
      o[id] = Math.max(0, Math.round(pl.marketValueBroCents));
    } else {
      o[id] = estimateMarketBroCentsFromOvr(overallFromAttributes(pl.attrs, pl.pos));
    }
  }
  return o;
}

export function estimateMarketBroCentsFromOvr(ovr: number): number {
  const o = Math.max(40, Math.min(99, Math.round(ovr)));
  return Math.round(250_000 + o * o * 420 + o * 1800);
}

export function marketTrendVsBaseline(
  currentBroCents: number | undefined,
  baseline: number | undefined,
): { delta: number; pct: number | null; label: 'up' | 'down' | 'flat' | 'unknown' } {
  if (currentBroCents == null || !Number.isFinite(currentBroCents)) {
    return { delta: 0, pct: null, label: 'unknown' };
  }
  if (baseline == null || !Number.isFinite(baseline) || baseline <= 0) {
    return { delta: 0, pct: null, label: 'unknown' };
  }
  const delta = currentBroCents - baseline;
  const pct = (delta / baseline) * 100;
  if (Math.abs(pct) < 0.35) return { delta, pct, label: 'flat' };
  return { delta, pct, label: delta > 0 ? 'up' : 'down' };
}

export function sanitizePlayerSeasonLedger(
  ledger: PlayerSeasonLedgerMap | undefined,
  validPlayerIds: Set<string>,
): PlayerSeasonLedgerMap {
  if (!ledger || typeof ledger !== 'object') return {};
  const out: PlayerSeasonLedgerMap = {};
  for (const [pid, row] of Object.entries(ledger)) {
    if (!validPlayerIds.has(pid)) continue;
    if (!row || typeof row !== 'object') continue;
    const e = row as PlayerSeasonLedgerEntry;
    out[pid] = {
      matchesPlayed: Math.max(0, Math.floor(e.matchesPlayed ?? 0)),
      goals: Math.max(0, Math.floor(e.goals ?? 0)),
      assists: Math.max(0, Math.floor(e.assists ?? 0)),
      yellowCards: Math.max(0, Math.floor(e.yellowCards ?? 0)),
      redCards: Math.max(0, Math.floor(e.redCards ?? 0)),
      passesOk: Math.max(0, Math.floor(e.passesOk ?? 0)),
      passesAttempt: Math.max(0, Math.floor(e.passesAttempt ?? 0)),
      tackles: Math.max(0, Math.floor(e.tackles ?? 0)),
      kmTotal: Math.max(0, Number(e.kmTotal ?? 0) || 0),
      shots: Math.max(0, Math.floor(e.shots ?? 0)),
      trainingPlansCompleted: Math.max(0, Math.floor(e.trainingPlansCompleted ?? 0)),
      trainingByType:
        e.trainingByType && typeof e.trainingByType === 'object' ? { ...e.trainingByType } : {},
      trainingLightSessions: Math.max(0, Math.floor(e.trainingLightSessions ?? 0)),
      seasonBaselineMarketBroCents:
        e.seasonBaselineMarketBroCents != null && Number.isFinite(e.seasonBaselineMarketBroCents)
          ? Math.max(0, Math.round(e.seasonBaselineMarketBroCents))
          : undefined,
      lastMarketBroCentsAfterMatch:
        e.lastMarketBroCentsAfterMatch != null && Number.isFinite(e.lastMarketBroCentsAfterMatch)
          ? Math.max(0, Math.round(e.lastMarketBroCentsAfterMatch))
          : undefined,
    };
  }
  return out;
}
