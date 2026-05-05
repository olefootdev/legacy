/**
 * Catálogo de formações: posições base normalizadas (nx,nz) e linha (bloco).
 * Slots canónicos OLEFOOT: 11 posições; esquemas diferentes reatribuem funções no mesmo conjunto.
 */
import type { FormationSchemeId } from '../types';

export type LineRole = 'def' | 'mid' | 'att';

export interface BaseSlot {
  nx: number;
  nz: number;
  line: LineRole;
}

/** Grupos para coesão de bloco (índices lógicos). */
export const SCHEME_LINE_GROUPS: Record<FormationSchemeId, { def: string[]; mid: string[]; att: string[] }> = {
  '4-3-3': {
    def: ['gol', 'zag1', 'zag2', 'le', 'ld'],
    mid: ['vol', 'mc1', 'mc2'],
    att: ['pe', 'ata', 'pd'],
  },
  '4-4-2': {
    def: ['gol', 'zag1', 'zag2', 'le', 'ld'],
    mid: ['mc1', 'mc2', 'pe', 'pd'],
    att: ['vol', 'ata'],
  },
  '4-2-3-1': {
    def: ['gol', 'zag1', 'zag2', 'le', 'ld'],
    mid: ['vol', 'mc2', 'mc1', 'pe', 'pd'],
    att: ['ata'],
  },
  '3-5-2': {
    def: ['gol', 'zag1', 'zag2', 'ld'],
    mid: ['le', 'vol', 'mc1', 'mc2', 'pe'],
    att: ['ata', 'pd'],
  },
  '4-5-1': {
    def: ['gol', 'zag1', 'zag2', 'le', 'ld'],
    mid: ['vol', 'mc1', 'mc2', 'pe', 'pd'],
    att: ['ata'],
  },
  '5-3-2': {
    def: ['gol', 'zag1', 'zag2', 'le', 'ld', 'vol'],
    mid: ['mc1', 'mc2', 'pe'],
    att: ['ata', 'pd'],
  },
  '3-4-3': {
    def: ['gol', 'zag1', 'zag2', 'le'],
    mid: ['ld', 'vol', 'mc1', 'mc2'],
    att: ['pe', 'ata', 'pd'],
  },
};

export const FORMATION_BASES: Record<FormationSchemeId, Record<string, BaseSlot>> = {
  '4-3-3': {
    gol: { nx: 0.08, nz: 0.5, line: 'def' },
    zag1: { nx: 0.26, nz: 0.38, line: 'def' },
    zag2: { nx: 0.26, nz: 0.62, line: 'def' },
    le: { nx: 0.32, nz: 0.12, line: 'def' },
    ld: { nx: 0.32, nz: 0.88, line: 'def' },
    vol: { nx: 0.48, nz: 0.5, line: 'mid' },
    mc1: { nx: 0.55, nz: 0.32, line: 'mid' },
    mc2: { nx: 0.55, nz: 0.68, line: 'mid' },
    pe: { nx: 0.72, nz: 0.2, line: 'att' },
    ata: { nx: 0.78, nz: 0.5, line: 'att' },
    pd: { nx: 0.72, nz: 0.8, line: 'att' },
  },
  '4-4-2': {
    gol:  { nx: 0.080, nz: 0.500, line: 'def' },
    le:   { nx: 0.220, nz: 0.100, line: 'def' },
    zag1: { nx: 0.220, nz: 0.360, line: 'def' },
    zag2: { nx: 0.220, nz: 0.640, line: 'def' },
    ld:   { nx: 0.220, nz: 0.900, line: 'def' },
    vol:  { nx: 0.500, nz: 0.100, line: 'mid' },
    mc1:  { nx: 0.500, nz: 0.360, line: 'mid' },
    mc2:  { nx: 0.500, nz: 0.640, line: 'mid' },
    pd:   { nx: 0.500, nz: 0.900, line: 'mid' },
    ata:  { nx: 0.760, nz: 0.380, line: 'att' },
    pe:   { nx: 0.760, nz: 0.620, line: 'att' },
  },
  '4-2-3-1': {
    gol:  { nx: 0.080, nz: 0.500, line: 'def' },
    zag1: { nx: 0.250, nz: 0.380, line: 'def' },
    zag2: { nx: 0.250, nz: 0.620, line: 'def' },
    le:   { nx: 0.300, nz: 0.120, line: 'def' },
    ld:   { nx: 0.300, nz: 0.880, line: 'def' },
    vol:  { nx: 0.400, nz: 0.400, line: 'mid' },
    mc2:  { nx: 0.400, nz: 0.600, line: 'mid' },
    mc1:  { nx: 0.580, nz: 0.500, line: 'mid' },
    pe:   { nx: 0.620, nz: 0.220, line: 'mid' },
    pd:   { nx: 0.620, nz: 0.780, line: 'mid' },
    ata:  { nx: 0.800, nz: 0.500, line: 'att' },
  },
  '3-5-2': {
    gol:  { nx: 0.080, nz: 0.500, line: 'def' },
    zag1: { nx: 0.220, nz: 0.320, line: 'def' },
    zag2: { nx: 0.220, nz: 0.500, line: 'def' },
    ld:   { nx: 0.220, nz: 0.680, line: 'def' },
    le:   { nx: 0.380, nz: 0.080, line: 'mid' },
    vol:  { nx: 0.420, nz: 0.500, line: 'mid' },
    mc1:  { nx: 0.520, nz: 0.280, line: 'mid' },
    mc2:  { nx: 0.520, nz: 0.720, line: 'mid' },
    pe:   { nx: 0.580, nz: 0.500, line: 'mid' },
    ata:  { nx: 0.760, nz: 0.400, line: 'att' },
    pd:   { nx: 0.760, nz: 0.600, line: 'att' },
  },
  '4-5-1': {
    gol:  { nx: 0.080, nz: 0.500, line: 'def' },
    zag1: { nx: 0.220, nz: 0.360, line: 'def' },
    zag2: { nx: 0.220, nz: 0.640, line: 'def' },
    le:   { nx: 0.280, nz: 0.100, line: 'def' },
    ld:   { nx: 0.280, nz: 0.900, line: 'def' },
    vol:  { nx: 0.400, nz: 0.500, line: 'mid' },
    mc1:  { nx: 0.480, nz: 0.250, line: 'mid' },
    mc2:  { nx: 0.480, nz: 0.750, line: 'mid' },
    pe:   { nx: 0.550, nz: 0.120, line: 'mid' },
    pd:   { nx: 0.550, nz: 0.880, line: 'mid' },
    ata:  { nx: 0.720, nz: 0.500, line: 'att' },
  },
  '5-3-2': {
    gol:  { nx: 0.060, nz: 0.500, line: 'def' },
    zag1: { nx: 0.180, nz: 0.300, line: 'def' },
    zag2: { nx: 0.180, nz: 0.500, line: 'def' },
    le:   { nx: 0.180, nz: 0.700, line: 'def' },
    ld:   { nx: 0.260, nz: 0.120, line: 'def' },
    vol:  { nx: 0.260, nz: 0.880, line: 'def' },
    mc1:  { nx: 0.440, nz: 0.350, line: 'mid' },
    mc2:  { nx: 0.440, nz: 0.650, line: 'mid' },
    pe:   { nx: 0.520, nz: 0.500, line: 'mid' },
    ata:  { nx: 0.700, nz: 0.400, line: 'att' },
    pd:   { nx: 0.700, nz: 0.600, line: 'att' },
  },
  '3-4-3': {
    gol:  { nx: 0.080, nz: 0.500, line: 'def' },
    zag1: { nx: 0.220, nz: 0.350, line: 'def' },
    zag2: { nx: 0.220, nz: 0.650, line: 'def' },
    le:   { nx: 0.280, nz: 0.100, line: 'def' },
    ld:   { nx: 0.420, nz: 0.120, line: 'mid' },
    vol:  { nx: 0.450, nz: 0.500, line: 'mid' },
    mc1:  { nx: 0.520, nz: 0.320, line: 'mid' },
    mc2:  { nx: 0.520, nz: 0.680, line: 'mid' },
    pe:   { nx: 0.740, nz: 0.180, line: 'att' },
    ata:  { nx: 0.800, nz: 0.500, line: 'att' },
    pd:   { nx: 0.740, nz: 0.820, line: 'att' },
  },
};

export function slotsForScheme(scheme: FormationSchemeId): string[] {
  return Object.keys(FORMATION_BASES[scheme]);
}

/** Rótulos curtos no campo (mesmo slot pode repetir, ex.: dois ZAG). */
export const SLOT_UI_LABELS: Record<string, string> = {
  gol: 'GOL',
  zag1: 'ZAG',
  zag2: 'ZAG',
  le: 'LE',
  ld: 'LD',
  vol: 'VOL',
  mc1: 'MC',
  mc2: 'MC',
  pe: 'PE',
  pd: 'PD',
  ata: 'ATA',
};

/**
 * Posições no mini-campo da UI: nx/nz normalizados → % top/left.
 * Ataque para o topo da tela; nz da esquerda (0) à direita (1).
 */
export function pitchUiSlots(scheme: FormationSchemeId): Array<{
  id: string;
  label: string;
  top: string;
  left: string;
}> {
  const bases = FORMATION_BASES[scheme];
  const order = slotsForScheme(scheme);
  return order.map((id) => {
    const b = bases[id]!;
    const topPct = (1 - b.nx) * 100;
    const leftPct = b.nz * 100;
    const clamp = (v: number) => Math.min(95, Math.max(5, v));
    return {
      id,
      label: SLOT_UI_LABELS[id] ?? id.toUpperCase(),
      top: `${Math.round(clamp(topPct))}%`,
      left: `${Math.round(clamp(leftPct))}%`,
    };
  });
}

/** Todas as formações disponíveis no jogo (ordem estável do catálogo). */
export const FORMATION_SCHEME_LIST: FormationSchemeId[] = Object.keys(
  FORMATION_BASES,
) as FormationSchemeId[];

/* ── Formation-aware role mapping ────────────────────────────────── */

import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';

type CoarseRole = 'gk' | 'def' | 'mid' | 'attack';

/**
 * Derive the coarse tactical role for a slot in a specific formation.
 * Uses SCHEME_LINE_GROUPS as the single source of truth —
 * a `vol` is `att` in 4-4-2 but `def` in 5-3-2.
 */
export function roleForSlotInFormation(
  slotId: string,
  formation: FormationSchemeId,
): CoarseRole {
  if (slotId === 'gol') return 'gk';
  const groups = SCHEME_LINE_GROUPS[formation];
  if (groups.def.includes(slotId)) return 'def';
  if (groups.att.includes(slotId)) return 'attack';
  return 'mid';
}

/**
 * Convert a normalized slot position (nx, nz ∈ [0,1]) to world meters.
 * Home attacks +X; away mirrors.
 * Replaces the legacy `layout433.slotToWorld` with a formation-agnostic version.
 */
export function slotToWorld(
  side: 'home' | 'away',
  slot: { nx: number; nz: number },
): { x: number; z: number } {
  const nx = side === 'home' ? slot.nx : 1 - slot.nx;
  return {
    x: nx * FIELD_LENGTH,
    z: slot.nz * FIELD_WIDTH,
  };
}
