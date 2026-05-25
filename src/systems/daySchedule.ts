/**
 * OLEFOOT PYTHON MODE — Slots horários do dia do manager.
 *
 * Alinhado à rotina do trabalhador brasileiro:
 *   05:30  Despertar          (longo, atenção alta — "Café com o time")
 *   07:00  Commute manhã      (médio)
 *   08:00  Trabalho focado    (zero engajamento — background)
 *   09:30  Café no trabalho   (curto, 5min — "Boletim do café")
 *   09:45  Trabalho           (zero)
 *   12:00  Almoço             (longo, 30-60min — "Almoço tático")
 *   13:30  Trabalho           (zero)
 *   15:00  Café da tarde      (curto, 5min — "Boletim do café")
 *   15:15  Trabalho           (zero)
 *   17:30  Commute volta      (médio)
 *   19:00  Jantar/família     (sistema discreto)
 *   21:00  Prime time         (longo, 60-120min — grandes eventos)
 *   23:00  Noite regenerativa (sem partidas competitivas)
 */
import { brtHourDecimal, isNightRegenWindow } from './timeCalibration';

export type SlotId =
  | 'wake'              // 05:30-07:00
  | 'commute_morning'   // 07:00-08:00
  | 'work_morning'      // 08:00-09:30 (background)
  | 'morning_coffee'    // 09:30-09:45
  | 'work_late_morning' // 09:45-12:00 (background)
  | 'lunch'             // 12:00-13:30
  | 'work_afternoon'    // 13:30-15:00 (background)
  | 'afternoon_coffee'  // 15:00-15:15
  | 'work_late_pm'      // 15:15-17:30 (background)
  | 'commute_return'    // 17:30-19:00
  | 'family'            // 19:00-21:00 (passive)
  | 'prime_time'        // 21:00-23:00
  | 'night_regen';      // 23:00-05:30

export type SlotKind = 'long' | 'short' | 'background' | 'passive' | 'regen';

export interface SlotDef {
  id: SlotId;
  startHour: number; // BRT decimal
  endHour: number;   // BRT decimal (exclusive; 24 = next day 00:00)
  kind: SlotKind;
  /** Curto label pra UI. */
  label: string;
  /** Manager pode receber push neste slot? */
  pushAllowed: boolean;
  /** Eventos grandes (finais, clássicos) priorizam este slot? */
  bigEventTarget: boolean;
}

export const SLOTS: ReadonlyArray<SlotDef> = [
  { id: 'wake',              startHour:  5.5,  endHour:  7.0,  kind: 'long',       label: 'Café com o time',     pushAllowed: true,  bigEventTarget: false },
  { id: 'commute_morning',   startHour:  7.0,  endHour:  8.0,  kind: 'short',      label: 'Aquecimento',         pushAllowed: true,  bigEventTarget: false },
  { id: 'work_morning',      startHour:  8.0,  endHour:  9.5,  kind: 'background', label: 'Trabalho',            pushAllowed: false, bigEventTarget: false },
  { id: 'morning_coffee',    startHour:  9.5,  endHour:  9.75, kind: 'short',      label: 'Boletim do café',     pushAllowed: true,  bigEventTarget: false },
  { id: 'work_late_morning', startHour:  9.75, endHour: 12.0,  kind: 'background', label: 'Trabalho',            pushAllowed: false, bigEventTarget: false },
  { id: 'lunch',             startHour: 12.0,  endHour: 13.5,  kind: 'long',       label: 'Almoço tático',       pushAllowed: true,  bigEventTarget: false },
  { id: 'work_afternoon',    startHour: 13.5,  endHour: 15.0,  kind: 'background', label: 'Trabalho',            pushAllowed: false, bigEventTarget: false },
  { id: 'afternoon_coffee',  startHour: 15.0,  endHour: 15.25, kind: 'short',      label: 'Boletim do café',     pushAllowed: true,  bigEventTarget: false },
  { id: 'work_late_pm',      startHour: 15.25, endHour: 17.5,  kind: 'background', label: 'Trabalho',            pushAllowed: false, bigEventTarget: false },
  { id: 'commute_return',    startHour: 17.5,  endHour: 19.0,  kind: 'short',      label: 'Resenha do dia',      pushAllowed: true,  bigEventTarget: false },
  { id: 'family',            startHour: 19.0,  endHour: 21.0,  kind: 'passive',    label: 'Em casa',             pushAllowed: false, bigEventTarget: false },
  { id: 'prime_time',        startHour: 21.0,  endHour: 23.0,  kind: 'long',       label: 'Prime Time',          pushAllowed: true,  bigEventTarget: true  },
  { id: 'night_regen',       startHour: 23.0,  endHour: 29.5,  kind: 'regen',      label: 'Noite regenerativa',  pushAllowed: false, bigEventTarget: false },
];

/** Mapa rápido. */
const SLOTS_BY_ID = new Map<SlotId, SlotDef>(SLOTS.map((s) => [s.id, s]));
export function getSlotDef(id: SlotId): SlotDef {
  const def = SLOTS_BY_ID.get(id);
  if (!def) throw new Error(`Unknown slot: ${id}`);
  return def;
}

/** Slot ativo agora. */
export function getCurrentSlot(ms: number): SlotDef {
  if (isNightRegenWindow(ms)) return getSlotDef('night_regen');
  const h = brtHourDecimal(ms);
  for (const s of SLOTS) {
    if (s.id === 'night_regen') continue;
    if (h >= s.startHour && h < s.endHour) return s;
  }
  return getSlotDef('night_regen');
}

/** Próximo slot + ms até começar. */
export function getNextSlot(ms: number): { slot: SlotDef; msUntil: number } {
  const current = getCurrentSlot(ms);
  const idx = SLOTS.findIndex((s) => s.id === current.id);
  const next = SLOTS[(idx + 1) % SLOTS.length]!;
  const h = brtHourDecimal(ms);
  const targetH = next.startHour > h ? next.startHour : next.startHour + 24;
  const msUntil = Math.round((targetH - h) * 60 * 60 * 1000);
  return { slot: next, msUntil };
}

/** É um slot onde manager espera engajar de verdade? */
export function isActiveSlot(slot: SlotDef): boolean {
  return slot.kind === 'long' || slot.kind === 'short';
}

/** Está em pausa competitiva (sem partidas de Liga Global)? */
export function isCompetitivePauseActive(ms: number): boolean {
  return isNightRegenWindow(ms);
}
