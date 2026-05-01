/**
 * utilityShootTelemetry.ts — Telemetria observacional do shoot Utility AI.
 *
 * Buffer in-memory de eventos `shootInstinctUtility` durante uma partida live.
 * Zero overhead em produção (gated por DEV).
 *
 * Console helpers (auto-installed em DEV):
 *   __shootTelemetry()           → array completo
 *   __shootTelemetryCSV()        → CSV (cola em Sheets/Excel)
 *   __shootTelemetrySummary()    → estatísticas (FIRED %, axis dominance, by zone)
 *   __shootTelemetryClear()      → zera buffer
 *   __shootTelemetryCopy()       → CSV → clipboard
 */

export interface ShootTelemetryEvent {
  /** Timestamp ms desde load. */
  t: number;
  /** Identificação do agente. */
  agentId: string;
  slot?: string;
  role: string;
  zone: string;
  minute?: number;
  /** Inputs e cálculos brutos. */
  xG: number;
  distToGoal: number;
  opponentsInZone: number;
  nearestOpponentDist: number;
  lineOfSightScore: number;
  riskAppetite: number;
  /** Breakdown por axis (0–1 cada). */
  axisXG: number;
  axisCloseness: number;
  axisPressure: number;
  axisLineOfSight: number;
  axisRiskMod: number;
  /** Score final + decisão. */
  score: number;
  threshold: number;
  fire: boolean;
  longRange: boolean;
}

const MAX_EVENTS = 600;
const buffer: ShootTelemetryEvent[] = [];
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

export function recordShootTelemetry(event: Omit<ShootTelemetryEvent, 't'>): void {
  if (!isEnabled()) return;
  if (buffer.length >= MAX_EVENTS) buffer.shift();
  buffer.push({ ...event, t: nowMs() });
  if (!installed) installGlobals();
}

function installGlobals(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const w = window as unknown as Record<string, unknown>;
  w.__shootTelemetry = () => [...buffer];
  w.__shootTelemetryClear = () => { buffer.length = 0; };
  w.__shootTelemetryCSV = () => toCSV(buffer);
  w.__shootTelemetrySummary = () => summarize(buffer);
  w.__shootTelemetryCopy = async () => {
    const csv = toCSV(buffer);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(csv);
      return `${buffer.length} eventos copiados (CSV).`;
    }
    return 'Clipboard API indisponível — use __shootTelemetryCSV() e copie manualmente.';
  };
  // eslint-disable-next-line no-console
  console.info(
    '[utility-ai] Shoot telemetry ativa. Comandos: __shootTelemetry() · __shootTelemetryCSV() · __shootTelemetrySummary() · __shootTelemetryCopy() · __shootTelemetryClear()',
  );
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function toCSV(events: ShootTelemetryEvent[]): string {
  if (events.length === 0) return '';
  const header = [
    't_ms', 'agentId', 'slot', 'role', 'zone', 'minute',
    'xG', 'distToGoal', 'opponentsInZone', 'nearestOpponentDist',
    'lineOfSightScore', 'riskAppetite',
    'axis_xG', 'axis_closeness', 'axis_pressure', 'axis_lineOfSight', 'axis_riskMod',
    'score', 'threshold', 'fire', 'longRange',
  ].join(',');
  const rows = events.map((e) => [
    Math.round(e.t),
    csvEscape(e.agentId), e.slot ?? '', e.role, e.zone, e.minute ?? '',
    e.xG.toFixed(4), e.distToGoal.toFixed(1), e.opponentsInZone, e.nearestOpponentDist.toFixed(1),
    e.lineOfSightScore.toFixed(2), e.riskAppetite.toFixed(2),
    e.axisXG.toFixed(3), e.axisCloseness.toFixed(3), e.axisPressure.toFixed(3),
    e.axisLineOfSight.toFixed(3), e.axisRiskMod.toFixed(3),
    e.score.toFixed(3), e.threshold, e.fire ? 1 : 0, e.longRange ? 1 : 0,
  ].join(','));
  return [header, ...rows].join('\n');
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function summarize(events: ShootTelemetryEvent[]) {
  if (events.length === 0) return { count: 0, message: 'No events yet — joga uma partida live.' };
  const fired = events.filter((e) => e.fire);
  const skipped = events.filter((e) => !e.fire);

  const byZone: Record<string, { fired: number; skipped: number; avgScore: number }> = {};
  for (const e of events) {
    if (!byZone[e.zone]) byZone[e.zone] = { fired: 0, skipped: 0, avgScore: 0 };
    if (e.fire) byZone[e.zone]!.fired++;
    else byZone[e.zone]!.skipped++;
  }
  for (const z of Object.keys(byZone)) {
    const evts = events.filter((e) => e.zone === z);
    byZone[z]!.avgScore = round3(avg(evts.map((e) => e.score)));
  }

  return {
    total: events.length,
    fired: fired.length,
    skipped: skipped.length,
    firedRate: round3(fired.length / events.length),
    avgScoreFired: round3(avg(fired.map((e) => e.score))),
    avgScoreSkipped: round3(avg(skipped.map((e) => e.score))),
    avgDistFired: round3(avg(fired.map((e) => e.distToGoal))),
    axisDominance: {
      xG: round3(avg(events.map((e) => e.axisXG))),
      closeness: round3(avg(events.map((e) => e.axisCloseness))),
      pressure: round3(avg(events.map((e) => e.axisPressure))),
      lineOfSight: round3(avg(events.map((e) => e.axisLineOfSight))),
      riskMod: round3(avg(events.map((e) => e.axisRiskMod))),
    },
    byZone,
  };
}
