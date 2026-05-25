import type { PlayerAttributes, PlayerEntity } from '@/entities/types';
import {
  emptyPlayerSeasonLedgerEntry,
  type PlayerSeasonLedgerEntry,
  type PlayerSeasonLedgerMap,
} from '@/team/playerSeasonLedger';

/** Subconjunto do livro de temporada gravado em cada ponto (valores cumulativos na altura do evento). */
export interface EvolutionLedgerSlice {
  matchesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  passesOk: number;
  passesAttempt: number;
  tackles: number;
  shots: number;
  /** Só em pontos originados de jogo: 1 vitória da equipa, 0 caso contrário. */
  matchWin?: 0 | 1;
}

export interface PlayerEvolutionPoint {
  atIso: string;
  source: 'match' | 'training_plan' | 'training_light';
  attrs: PlayerAttributes;
  ledger: EvolutionLedgerSlice;
  /**
   * Valor de mercado em centavos BRO no instante do snapshot.
   * Permite reconstruir histórico de preço sem tabela dedicada.
   * Opcional pra retrocompatibilidade com pontos antigos.
   */
  marketValueBroCents?: number;
}

export type PlayerEvolutionTimelineMap = Record<string, PlayerEvolutionPoint[]>;

export const EVOLUTION_TIMELINE_MAX_POINTS = 96;

function sliceFromLedgerEntry(e: PlayerSeasonLedgerEntry, matchWin?: boolean): EvolutionLedgerSlice {
  return {
    matchesPlayed: Math.max(0, Math.floor(e.matchesPlayed ?? 0)),
    goals: Math.max(0, Math.floor(e.goals ?? 0)),
    assists: Math.max(0, Math.floor(e.assists ?? 0)),
    yellowCards: Math.max(0, Math.floor(e.yellowCards ?? 0)),
    redCards: Math.max(0, Math.floor(e.redCards ?? 0)),
    passesOk: Math.max(0, Math.floor(e.passesOk ?? 0)),
    passesAttempt: Math.max(0, Math.floor(e.passesAttempt ?? 0)),
    tackles: Math.max(0, Math.floor(e.tackles ?? 0)),
    shots: Math.max(0, Math.floor(e.shots ?? 0)),
    matchWin: matchWin === undefined ? undefined : matchWin ? 1 : 0,
  };
}

function cloneAttrs(a: PlayerAttributes): PlayerAttributes {
  return { ...a };
}

/**
 * Acrescenta um ponto na linha do tempo por jogador (após jogo concluído, treino concluído ou sessão leve).
 */
export function appendEvolutionTimelinePoints(
  timeline: PlayerEvolutionTimelineMap | undefined,
  playerIds: string[],
  players: Record<string, PlayerEntity>,
  ledger: PlayerSeasonLedgerMap,
  source: PlayerEvolutionPoint['source'],
  /** Em `match`, o mesmo resultado aplica-se a todos os `playerIds` do jogo. */
  teamWonMatch?: boolean,
): PlayerEvolutionTimelineMap {
  const base = timeline && typeof timeline === 'object' ? { ...timeline } : {};
  const now = new Date().toISOString();
  const mw = source === 'match' ? teamWonMatch : undefined;
  for (const pid of playerIds) {
    const pl = players[pid];
    if (!pl) continue;
    const L = ledger[pid] ?? emptyPlayerSeasonLedgerEntry();
    const mv = (pl as PlayerEntity & { marketValueBroCents?: number }).marketValueBroCents;
    const row: PlayerEvolutionPoint = {
      atIso: now,
      source,
      attrs: cloneAttrs(pl.attrs),
      ledger: sliceFromLedgerEntry(L, mw),
      ...(typeof mv === 'number' && Number.isFinite(mv) ? { marketValueBroCents: Math.round(mv) } : {}),
    };
    const prev = base[pid] ?? [];
    base[pid] = [...prev, row].slice(-EVOLUTION_TIMELINE_MAX_POINTS);
  }
  return base;
}

function sanitizeAttrs(raw: unknown): PlayerAttributes | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, number>;
  const keys: (keyof PlayerAttributes)[] = [
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
  const out = {} as PlayerAttributes;
  for (const k of keys) {
    const n = Number(o[k as string]);
    out[k] = Number.isFinite(n) ? Math.max(1, Math.min(99, Math.round(n))) : 1;
  }
  return out;
}

function sanitizeSlice(raw: unknown): EvolutionLedgerSlice | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const num = (k: string) => {
    const n = Number(o[k]);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  };
  const mw = o.matchWin;
  return {
    matchesPlayed: num('matchesPlayed'),
    goals: num('goals'),
    assists: num('assists'),
    yellowCards: num('yellowCards'),
    redCards: num('redCards'),
    passesOk: num('passesOk'),
    passesAttempt: num('passesAttempt'),
    tackles: num('tackles'),
    shots: num('shots'),
    matchWin: mw === 1 ? 1 : mw === 0 ? 0 : undefined,
  };
}

export function sanitizePlayerEvolutionTimeline(
  raw: PlayerEvolutionTimelineMap | undefined,
  validPlayerIds: Set<string>,
): PlayerEvolutionTimelineMap {
  if (!raw || typeof raw !== 'object') return {};
  const out: PlayerEvolutionTimelineMap = {};
  for (const [pid, rows] of Object.entries(raw)) {
    if (!validPlayerIds.has(pid)) continue;
    if (!Array.isArray(rows)) continue;
    const cleaned: PlayerEvolutionPoint[] = [];
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      const atIso = typeof (r as PlayerEvolutionPoint).atIso === 'string' ? (r as PlayerEvolutionPoint).atIso : '';
      if (!atIso) continue;
      const src = (r as PlayerEvolutionPoint).source;
      if (src !== 'match' && src !== 'training_plan' && src !== 'training_light') continue;
      const attrs = sanitizeAttrs((r as PlayerEvolutionPoint).attrs);
      const ledger = sanitizeSlice((r as PlayerEvolutionPoint).ledger);
      if (!attrs || !ledger) continue;
      const mvRaw = (r as PlayerEvolutionPoint).marketValueBroCents;
      const mv = typeof mvRaw === 'number' && Number.isFinite(mvRaw) && mvRaw >= 0
        ? Math.round(mvRaw)
        : undefined;
      cleaned.push({
        atIso,
        source: src,
        attrs,
        ledger,
        ...(mv !== undefined ? { marketValueBroCents: mv } : {}),
      });
    }
    if (cleaned.length > 0) out[pid] = cleaned.slice(-EVOLUTION_TIMELINE_MAX_POINTS);
  }
  return out;
}
