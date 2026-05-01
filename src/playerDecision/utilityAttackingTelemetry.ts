/**
 * utilityAttackingTelemetry.ts — Telemetria observacional do attacking Utility AI.
 *
 * Buffer in-memory de eventos `evaluateAttackingUtility` durante partida live.
 * DEV-gated, zero overhead em produção.
 *
 * Console helpers (auto-installed em DEV):
 *   __attackingTelemetry()           → array completo
 *   __attackingTelemetryCSV()        → CSV
 *   __attackingTelemetrySummary()    → estatísticas (action distribution, fall-through %)
 *   __attackingTelemetryClear()      → zera buffer
 *   __attackingTelemetryCopy()       → CSV → clipboard
 */

import type { AttackingUtilityInputs } from './utilityAttackingSupport';

export interface AttackingTelemetryEvent {
  t: number;
  agentId: string;
  slot?: string;
  role: string;
  attackPhase: string | undefined;
  minute?: number;
  inputs: AttackingUtilityInputs;
  /** null quando fire=false → caller delega pra role dispatch legacy. */
  actionId: string | null;
  score: number;
  margin: number;
  fire: boolean;
  candidates: { id: string; score: number }[];
}

const MAX_EVENTS = 800;
const buffer: AttackingTelemetryEvent[] = [];
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

export function recordAttackingTelemetry(event: Omit<AttackingTelemetryEvent, 't'>): void {
  if (!isEnabled()) return;
  if (buffer.length >= MAX_EVENTS) buffer.shift();
  buffer.push({ ...event, t: nowMs() });
  if (!installed) installGlobals();
}

function installGlobals(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const w = window as unknown as Record<string, unknown>;
  w.__attackingTelemetry = () => [...buffer];
  w.__attackingTelemetryClear = () => { buffer.length = 0; };
  w.__attackingTelemetryCSV = () => toCSV(buffer);
  w.__attackingTelemetrySummary = () => summarize(buffer);
  w.__attackingTelemetryCopy = async () => {
    const csv = toCSV(buffer);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(csv);
      return `${buffer.length} eventos copiados (CSV).`;
    }
    return 'Clipboard API indisponível — use __attackingTelemetryCSV() e copie manualmente.';
  };
  // eslint-disable-next-line no-console
  console.info(
    '[utility-ai] Attacking telemetry ativa. Comandos: __attackingTelemetry() · __attackingTelemetryCSV() · __attackingTelemetrySummary() · __attackingTelemetryCopy() · __attackingTelemetryClear()',
  );
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function toCSV(events: AttackingTelemetryEvent[]): string {
  if (events.length === 0) return '';
  const header = [
    't_ms', 'agentId', 'slot', 'role', 'attackPhase', 'minute',
    'in_roleAttack', 'in_slotWinger', 'in_slotFullback', 'in_slotMidAtt',
    'in_inFinalThird', 'in_inBoxEntry', 'in_boxNotFull',
    'in_shouldAnchor', 'in_farFromBall',
    'in_sqLowUsefulness', 'in_sqWidth', 'in_sqAttackSpace', 'in_sqRecycle', 'in_sqOffer',
    'actionId', 'score', 'margin', 'fire',
    'cand_striker_infiltrate', 'cand_winger_depth', 'cand_fb_overlap', 'cand_mid_depth',
    'cand_anchor', 'cand_structural', 'cand_sq_width', 'cand_sq_attack', 'cand_sq_recycle', 'cand_sq_offer',
  ].join(',');
  const rows = events.map((e) => {
    const cm: Record<string, number> = {};
    for (const c of e.candidates) cm[c.id] = c.score;
    return [
      Math.round(e.t),
      csvEscape(e.agentId), e.slot ?? '', e.role, e.attackPhase ?? '', e.minute ?? '',
      e.inputs.roleAttack, e.inputs.slotWinger, e.inputs.slotFullback, e.inputs.slotMidAtt,
      e.inputs.inFinalThird, e.inputs.inBoxEntry, e.inputs.boxNotFull,
      e.inputs.shouldAnchor, e.inputs.farFromBall,
      e.inputs.sqLowUsefulness, e.inputs.sqSuggestionWidth, e.inputs.sqSuggestionAttackSpace,
      e.inputs.sqSuggestionRecycle, e.inputs.sqSuggestionOffer,
      e.actionId ?? '_FALLTHROUGH_', e.score.toFixed(3), e.margin.toFixed(3), e.fire ? 1 : 0,
      (cm['striker_infiltrate_box'] ?? 0).toFixed(3),
      (cm['winger_attack_depth'] ?? 0).toFixed(3),
      (cm['fullback_overlap_box_entry'] ?? 0).toFixed(3),
      (cm['mid_attack_depth'] ?? 0).toFixed(3),
      (cm['anchor_to_slot'] ?? 0).toFixed(3),
      (cm['structural_hold'] ?? 0).toFixed(3),
      (cm['sq_create_width'] ?? 0).toFixed(3),
      (cm['sq_attack_space'] ?? 0).toFixed(3),
      (cm['sq_recycle'] ?? 0).toFixed(3),
      (cm['sq_offer_line'] ?? 0).toFixed(3),
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

function summarize(events: AttackingTelemetryEvent[]) {
  if (events.length === 0) return { count: 0, message: 'No events yet — joga uma partida live.' };

  const fired = events.filter((e) => e.fire);
  const fellThrough = events.filter((e) => !e.fire);

  const byAction: Record<string, number> = {};
  for (const e of fired) {
    if (e.actionId) byAction[e.actionId] = (byAction[e.actionId] ?? 0) + 1;
  }
  const actionDist: Record<string, { count: number; pct: number; avgScore: number }> = {};
  for (const id of Object.keys(byAction)) {
    const evts = fired.filter((e) => e.actionId === id);
    actionDist[id] = {
      count: byAction[id]!,
      pct: round3(byAction[id]! / fired.length),
      avgScore: round3(avg(evts.map((e) => e.score))),
    };
  }

  const byRole: Record<string, { fired: number; fallthrough: number }> = {};
  for (const e of events) {
    if (!byRole[e.role]) byRole[e.role] = { fired: 0, fallthrough: 0 };
    if (e.fire) byRole[e.role]!.fired++;
    else byRole[e.role]!.fallthrough++;
  }

  // PR3 — breakdown por agente: quantas vezes cada jogador venceu cada ação.
  // Foco principal em striker_infiltrate_box (validação direta do PR1).
  const byAgent: Record<string, {
    slot?: string;
    role: string;
    fired: number;
    actions: Record<string, number>;
  }> = {};
  for (const e of events) {
    if (!e.fire || !e.actionId) continue;
    if (!byAgent[e.agentId]) {
      byAgent[e.agentId] = { slot: e.slot, role: e.role, fired: 0, actions: {} };
    }
    const a = byAgent[e.agentId]!;
    a.fired++;
    a.actions[e.actionId] = (a.actions[e.actionId] ?? 0) + 1;
  }

  const lowMarginRate = fired.filter((e) => e.margin < 0.05).length / Math.max(1, fired.length);

  return {
    total: events.length,
    fired: fired.length,
    fellThrough: fellThrough.length,
    fireRate: round3(fired.length / events.length),
    fellThroughRate: round3(fellThrough.length / events.length),
    lowMarginRate: round3(lowMarginRate),
    actionDistribution: actionDist,
    byRole,
    byAgent,
    avgFiredScore: round3(avg(fired.map((e) => e.score))),
    avgFellThroughScore: round3(avg(fellThrough.map((e) => e.score))),
  };
}
