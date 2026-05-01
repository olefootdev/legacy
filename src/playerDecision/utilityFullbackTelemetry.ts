/**
 * utilityFullbackTelemetry.ts — Telemetria observacional do fullback Utility AI.
 *
 * Buffer in-memory de eventos `selectFullbackAction` durante uma partida live.
 * DEV-gated, zero overhead em produção.
 *
 * Console helpers (auto-installed em DEV):
 *   __fullbackTelemetry()           → array completo
 *   __fullbackTelemetryCSV()        → CSV para análise
 *   __fullbackTelemetrySummary()    → estatísticas (action distribution, médias)
 *   __fullbackTelemetryClear()      → zera buffer
 *   __fullbackTelemetryCopy()       → CSV → clipboard
 */

import type { FullbackUtilityInputs } from './utilityFullbackSupport';

export interface FullbackTelemetryEvent {
  t: number;
  agentId: string;
  slot?: string;
  isLeft: boolean;
  sector: string;
  teamPhase: string;
  minute?: number;
  inputs: FullbackUtilityInputs;
  actionId: string;
  score: number;
  margin: number;
  candidates: { id: string; score: number }[];
}

const MAX_EVENTS = 600;
const buffer: FullbackTelemetryEvent[] = [];
const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
let installed = false;

function isEnabled(): boolean {
  try {
    return import.meta.env?.DEV === true;
  } catch {
    return false;
  }
}

function nowMs(): number {
  return (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
}

export function recordFullbackTelemetry(event: Omit<FullbackTelemetryEvent, 't'>): void {
  if (!isEnabled()) return;
  if (buffer.length >= MAX_EVENTS) buffer.shift();
  buffer.push({ ...event, t: nowMs() });
  if (!installed) installGlobals();
}

function installGlobals(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const w = window as unknown as Record<string, unknown>;
  w.__fullbackTelemetry = () => [...buffer];
  w.__fullbackTelemetryClear = () => { buffer.length = 0; };
  w.__fullbackTelemetryCSV = () => toCSV(buffer);
  w.__fullbackTelemetrySummary = () => summarize(buffer);
  w.__fullbackTelemetryCopy = async () => {
    const csv = toCSV(buffer);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(csv);
      return `${buffer.length} eventos copiados (CSV).`;
    }
    return 'Clipboard API indisponível — use __fullbackTelemetryCSV() e copie manualmente.';
  };
  // eslint-disable-next-line no-console
  console.info(
    '[utility-ai] Fullback telemetry ativa. Comandos: __fullbackTelemetry() · __fullbackTelemetryCSV() · __fullbackTelemetrySummary() · __fullbackTelemetryCopy() · __fullbackTelemetryClear()',
  );
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function toCSV(events: FullbackTelemetryEvent[]): string {
  if (events.length === 0) return '';
  const header = [
    't_ms', 'agentId', 'slot', 'isLeft', 'sector', 'teamPhase', 'minute',
    'in_ballSideMatch', 'in_ballOpposite', 'in_ballCentral', 'in_inAttackPhase',
    'in_workRate', 'in_overlapRoll', 'in_defenseScore',
    'actionId', 'score', 'margin',
    'cand_overlap_run', 'cand_offer_short_line', 'cand_defensive_cover', 'cand_open_width',
  ].join(',');
  const rows = events.map((e) => {
    const candMap: Record<string, number> = {};
    for (const c of e.candidates) candMap[c.id] = c.score;
    return [
      Math.round(e.t),
      csvEscape(e.agentId), e.slot ?? '', e.isLeft ? 1 : 0, e.sector, e.teamPhase, e.minute ?? '',
      e.inputs.ballSideMatch, e.inputs.ballOpposite, e.inputs.ballCentral, e.inputs.inAttackPhase,
      e.inputs.workRate.toFixed(2), e.inputs.overlapRoll.toFixed(2), e.inputs.defenseScore.toFixed(2),
      e.actionId, e.score.toFixed(3), e.margin.toFixed(3),
      (candMap['overlap_run'] ?? 0).toFixed(3),
      (candMap['offer_short_line'] ?? 0).toFixed(3),
      (candMap['defensive_cover'] ?? 0).toFixed(3),
      (candMap['open_width'] ?? 0).toFixed(3),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function summarize(events: FullbackTelemetryEvent[]) {
  if (events.length === 0) return { count: 0, message: 'No events yet — joga uma partida live.' };

  const byAction: Record<string, number> = {};
  for (const e of events) {
    byAction[e.actionId] = (byAction[e.actionId] ?? 0) + 1;
  }
  const actionDist: Record<string, { count: number; pct: number; avgScore: number; avgMargin: number }> = {};
  for (const id of Object.keys(byAction)) {
    const evts = events.filter((e) => e.actionId === id);
    actionDist[id] = {
      count: byAction[id]!,
      pct: round3(byAction[id]! / events.length),
      avgScore: round3(avg(evts.map((e) => e.score))),
      avgMargin: round3(avg(evts.map((e) => e.margin))),
    };
  }

  const byPhase: Record<string, { overlap_run: number; offer: number; cover: number; width: number }> = {};
  for (const e of events) {
    if (!byPhase[e.teamPhase]) byPhase[e.teamPhase] = { overlap_run: 0, offer: 0, cover: 0, width: 0 };
    const p = byPhase[e.teamPhase]!;
    if (e.actionId === 'overlap_run') p.overlap_run++;
    else if (e.actionId === 'offer_short_line') p.offer++;
    else if (e.actionId === 'defensive_cover') p.cover++;
    else if (e.actionId === 'open_width') p.width++;
  }

  const lowMarginRate = events.filter((e) => e.margin < 0.05).length / events.length;

  return {
    total: events.length,
    actionDistribution: actionDist,
    byTeamPhase: byPhase,
    lowMarginRate: round3(lowMarginRate),
    avgInputs: {
      ballSideMatch: round3(avg(events.map((e) => e.inputs.ballSideMatch))),
      inAttackPhase: round3(avg(events.map((e) => e.inputs.inAttackPhase))),
      workRate: round3(avg(events.map((e) => e.inputs.workRate))),
      overlapRoll: round3(avg(events.map((e) => e.inputs.overlapRoll))),
    },
  };
}
