/**
 * OLEFOOT PYTHON MODE — Handlers de eventos → consequências.
 *
 * Recebe um evento canônico (vermelho, lesão, MVP, etc.) e materializa
 * a lista de `PersistentConsequence` correspondente, usando o catálogo
 * calibrado. UUIDs gerados aqui, timestamps absolutos.
 */
import { MS_PER_HOUR } from '@/systems/timeCalibration';
import { getCatalogEntry, type ImpactEventKind } from '@/systems/impactCatalog';
import type { PersistentConsequence } from './types';

let _idCounter = 0;
function genId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_idCounter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface ImpactEvent {
  kind: ImpactEventKind;
  managerId: string;
  clubId: string;
  /** Jogador foco do evento (para scope='player'). */
  playerId?: string;
  /** ID original do evento na partida (pra rastreabilidade). */
  sourceEventId?: string;
  /** Timestamp do evento (default: agora). */
  at?: number;
  /** Dados extras opcionais. */
  metadata?: Record<string, unknown>;
}

/** Materializa todas as consequências de um evento de impacto. */
export function materializeConsequences(event: ImpactEvent): PersistentConsequence[] {
  const entry = getCatalogEntry(event.kind);
  const startsAt = event.at ?? Date.now();
  const out: PersistentConsequence[] = [];

  for (const tpl of entry.player ?? []) {
    if (!event.playerId) continue; // template é player-scope mas evento não tem player
    out.push({
      id: genId(tpl.kind),
      managerId: event.managerId,
      clubId: event.clubId,
      playerId: event.playerId,
      kind: tpl.kind,
      dimension: tpl.dimension,
      scope: 'player',
      magnitude: tpl.magnitude,
      decayCurve: tpl.decayCurve,
      startsAt,
      expiresAt: startsAt + tpl.durationHours * MS_PER_HOUR,
      sourceEventId: event.sourceEventId,
      metadata: event.metadata,
    });
  }
  for (const tpl of entry.club ?? []) {
    out.push({
      id: genId(tpl.kind),
      managerId: event.managerId,
      clubId: event.clubId,
      kind: tpl.kind,
      dimension: tpl.dimension,
      scope: 'club',
      magnitude: tpl.magnitude,
      decayCurve: tpl.decayCurve,
      startsAt,
      expiresAt: startsAt + tpl.durationHours * MS_PER_HOUR,
      sourceEventId: event.sourceEventId,
      metadata: event.metadata,
    });
  }

  return out;
}

/** Materializa em batch (várias partidas/eventos de uma vez). */
export function materializeBatch(events: ImpactEvent[]): PersistentConsequence[] {
  const out: PersistentConsequence[] = [];
  for (const e of events) out.push(...materializeConsequences(e));
  return out;
}

// ─── Detectores de evento (helpers pra integrar com o engine) ───────

export interface MatchSummaryForImpact {
  managerId: string;
  clubId: string;
  matchId: string;
  scoreFor: number;
  scoreAgainst: number;
  /** Jogadores que pegaram vermelho nesta partida. */
  redCardPlayerIds: string[];
  /** IDs dos jogadores com vermelho nos últimos 7 dias (pra detectar reincidência). */
  redCardLast7dPlayerIds?: string[];
  /** Hat-tricks: playerIds que fizeram 3+ gols. */
  hatTrickPlayerIds: string[];
  /** MVP da partida. */
  mvpPlayerId?: string;
  /** Lesões: playerId → severidade. */
  injuries: Array<{ playerId: string; severity: 'light' | 'medium' | 'severe' }>;
  /** Jogadores com fadiga ≥95% ao final. */
  exhaustedPlayerIds: string[];
  /** É um clássico? */
  isClassic?: boolean;
}

/** Converte um resumo de partida em lista de ImpactEvents. */
export function eventsFromMatchSummary(
  summary: MatchSummaryForImpact,
): ImpactEvent[] {
  const events: ImpactEvent[] = [];
  const at = Date.now();
  const last7d = new Set(summary.redCardLast7dPlayerIds ?? []);

  for (const pid of summary.redCardPlayerIds) {
    const repeat = last7d.has(pid);
    events.push({
      kind: repeat ? 'red_card_repeat_7d' : 'red_card_direct',
      managerId: summary.managerId,
      clubId: summary.clubId,
      playerId: pid,
      sourceEventId: `${summary.matchId}_red_${pid}`,
      at,
    });
  }

  for (const inj of summary.injuries) {
    const map = {
      light: 'injury_light' as const,
      medium: 'injury_medium' as const,
      severe: 'injury_severe' as const,
    };
    events.push({
      kind: map[inj.severity],
      managerId: summary.managerId,
      clubId: summary.clubId,
      playerId: inj.playerId,
      sourceEventId: `${summary.matchId}_inj_${inj.playerId}`,
      at,
    });
  }

  for (const pid of summary.exhaustedPlayerIds) {
    events.push({
      kind: 'exhaustion',
      managerId: summary.managerId,
      clubId: summary.clubId,
      playerId: pid,
      sourceEventId: `${summary.matchId}_exh_${pid}`,
      at,
    });
  }

  if (summary.mvpPlayerId) {
    events.push({
      kind: 'mvp_of_round',
      managerId: summary.managerId,
      clubId: summary.clubId,
      playerId: summary.mvpPlayerId,
      sourceEventId: `${summary.matchId}_mvp`,
      at,
    });
  }

  for (const pid of summary.hatTrickPlayerIds) {
    events.push({
      kind: 'hat_trick',
      managerId: summary.managerId,
      clubId: summary.clubId,
      playerId: pid,
      sourceEventId: `${summary.matchId}_ht_${pid}`,
      at,
    });
  }

  const goalDiff = summary.scoreFor - summary.scoreAgainst;
  if (goalDiff <= -3) {
    events.push({
      kind: 'heavy_defeat',
      managerId: summary.managerId,
      clubId: summary.clubId,
      sourceEventId: `${summary.matchId}_defeat`,
      at,
    });
  }
  if (summary.isClassic && goalDiff > 0) {
    events.push({
      kind: 'classic_win',
      managerId: summary.managerId,
      clubId: summary.clubId,
      sourceEventId: `${summary.matchId}_classic`,
      at,
    });
  }

  return events;
}
