/**
 * crossTelegraphTelemetry.ts — Telemetria observacional do cross telegraphing (PR2).
 *
 * Buffer in-memory de eventos `telegraphed` (lateral disparou broadcast) e
 * `concluded` (lateral executou cruzamento real dentro da janela do hint).
 * DEV-gated, zero overhead em produção.
 *
 * Console helpers (auto-installed em DEV):
 *   __crossTelemetry()         → array completo
 *   __crossTelemetryCSV()      → CSV
 *   __crossTelemetrySummary()  → estatísticas (telegraphed/concluded por jogador, conversion rate)
 *   __crossTelemetryClear()    → zera buffer
 *   __crossTelemetryCopy()     → CSV → clipboard
 */

export type CrossTelegraphEventKind = 'telegraphed' | 'concluded';

export interface CrossTelegraphEvent {
  t: number;
  kind: CrossTelegraphEventKind;
  senderId: string;
  senderSlot?: string;
  senderSide: 'home' | 'away';
  /** Minuto da partida quando ocorreu. */
  minute?: number;
  /** Para 'telegraphed': ponto esperado de entrega (2º pau). */
  expectedX?: number;
  expectedZ?: number;
  /** Para 'telegraphed': lista de receptores que receberam o hint. */
  receiverIds?: string[];
  /** Para 'concluded': sucesso do cruzamento (cross_ok / cross_fail). */
  outcome?: 'cross_ok' | 'cross_fail';
  /** Para 'concluded': ms desde o telegraphed correspondente (latência da conversão). */
  msSinceTelegraphed?: number;
}

const MAX_EVENTS = 600;
const buffer: CrossTelegraphEvent[] = [];
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

/** Última telegraphed por sender — usada pra computar `msSinceTelegraphed` no concluded. */
const lastTelegraphedBySender = new Map<string, number>();

export function recordCrossTelegraphed(event: Omit<CrossTelegraphEvent, 't' | 'kind'>): void {
  if (!isEnabled()) return;
  const t = nowMs();
  if (buffer.length >= MAX_EVENTS) buffer.shift();
  buffer.push({ ...event, t, kind: 'telegraphed' });
  lastTelegraphedBySender.set(event.senderId, t);
  if (!installed) installGlobals();
}

export function recordCrossConcluded(
  event: Omit<CrossTelegraphEvent, 't' | 'kind' | 'msSinceTelegraphed'>,
): void {
  if (!isEnabled()) return;
  const t = nowMs();
  const last = lastTelegraphedBySender.get(event.senderId);
  // Só conta como "concluded" se houve telegraphed recente (≤ 1.5s) — evita
  // creditar cruzamentos espontâneos que não foram telegrafados.
  if (last === undefined || t - last > 1500) return;
  if (buffer.length >= MAX_EVENTS) buffer.shift();
  buffer.push({ ...event, t, kind: 'concluded', msSinceTelegraphed: t - last });
  lastTelegraphedBySender.delete(event.senderId);
  if (!installed) installGlobals();
}

function installGlobals(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const w = window as unknown as Record<string, unknown>;
  w.__crossTelemetry = () => [...buffer];
  w.__crossTelemetryClear = () => {
    buffer.length = 0;
    lastTelegraphedBySender.clear();
  };
  w.__crossTelemetryCSV = () => toCSV(buffer);
  w.__crossTelemetrySummary = () => summarize(buffer);
  w.__crossTelemetryCopy = async () => {
    const csv = toCSV(buffer);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(csv);
      return `${buffer.length} eventos copiados (CSV).`;
    }
    return 'Clipboard API indisponível — use __crossTelemetryCSV() e copie manualmente.';
  };
  // eslint-disable-next-line no-console
  console.info(
    '[cross-telegraph] Telemetry ativa. Comandos: __crossTelemetry() · __crossTelemetryCSV() · __crossTelemetrySummary() · __crossTelemetryCopy() · __crossTelemetryClear()',
  );
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function toCSV(events: CrossTelegraphEvent[]): string {
  if (events.length === 0) return '';
  const header = [
    't_ms', 'kind', 'senderId', 'senderSlot', 'senderSide', 'minute',
    'expectedX', 'expectedZ', 'numReceivers',
    'outcome', 'msSinceTelegraphed',
  ].join(',');
  const rows = events.map((e) => [
    Math.round(e.t),
    e.kind,
    csvEscape(e.senderId),
    e.senderSlot ?? '',
    e.senderSide,
    e.minute ?? '',
    e.expectedX !== undefined ? e.expectedX.toFixed(1) : '',
    e.expectedZ !== undefined ? e.expectedZ.toFixed(1) : '',
    e.receiverIds?.length ?? '',
    e.outcome ?? '',
    e.msSinceTelegraphed !== undefined ? Math.round(e.msSinceTelegraphed) : '',
  ].join(','));
  return [header, ...rows].join('\n');
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function summarize(events: CrossTelegraphEvent[]) {
  if (events.length === 0) return { count: 0, message: 'No cross telegraphs yet — joga uma partida live com lateral em overlap.' };

  const telegraphed = events.filter((e) => e.kind === 'telegraphed');
  const concluded = events.filter((e) => e.kind === 'concluded');
  const concludedOk = concluded.filter((e) => e.outcome === 'cross_ok');

  const bySender: Record<string, {
    slot?: string;
    side?: string;
    telegraphed: number;
    concluded: number;
    concludedOk: number;
    conversionRate: number;
    okRate: number;
  }> = {};

  for (const e of events) {
    if (!bySender[e.senderId]) {
      bySender[e.senderId] = {
        slot: e.senderSlot,
        side: e.senderSide,
        telegraphed: 0,
        concluded: 0,
        concludedOk: 0,
        conversionRate: 0,
        okRate: 0,
      };
    }
    const s = bySender[e.senderId]!;
    if (e.kind === 'telegraphed') s.telegraphed++;
    if (e.kind === 'concluded') {
      s.concluded++;
      if (e.outcome === 'cross_ok') s.concludedOk++;
    }
  }
  for (const id of Object.keys(bySender)) {
    const s = bySender[id]!;
    s.conversionRate = round3(s.telegraphed > 0 ? s.concluded / s.telegraphed : 0);
    s.okRate = round3(s.concluded > 0 ? s.concludedOk / s.concluded : 0);
  }

  return {
    total: events.length,
    telegraphed: telegraphed.length,
    concluded: concluded.length,
    concludedOk: concludedOk.length,
    conversionRate: round3(telegraphed.length > 0 ? concluded.length / telegraphed.length : 0),
    okRate: round3(concluded.length > 0 ? concludedOk.length / concluded.length : 0),
    bySender,
  };
}
