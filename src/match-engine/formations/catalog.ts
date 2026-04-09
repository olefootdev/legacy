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
    gol: { nx: 0.08, nz: 0.5, line: 'def' },
    zag1: { nx: 0.24, nz: 0.36, line: 'def' },
    zag2: { nx: 0.24, nz: 0.64, line: 'def' },
    le: { nx: 0.3, nz: 0.1, line: 'def' },
    ld: { nx: 0.3, nz: 0.9, line: 'def' },
    mc1: { nx: 0.46, nz: 0.22, line: 'mid' },
    mc2: { nx: 0.46, nz: 0.5, line: 'mid' },
    pe: { nx: 0.46, nz: 0.78, line: 'mid' },
    pd: { nx: 0.58, nz: 0.18, line: 'mid' },
    vol: { nx: 0.74, nz: 0.58, line: 'att' },
    ata: { nx: 0.76, nz: 0.38, line: 'att' },
  },
  '4-2-3-1': {
    gol: { nx: 0.08, nz: 0.5, line: 'def' },
    zag1: { nx: 0.25, nz: 0.38, line: 'def' },
    zag2: { nx: 0.25, nz: 0.62, line: 'def' },
    le: { nx: 0.3, nz: 0.12, line: 'def' },
    ld: { nx: 0.3, nz: 0.88, line: 'def' },
    vol: { nx: 0.4, nz: 0.4, line: 'mid' },
    mc2: { nx: 0.4, nz: 0.6, line: 'mid' },
    mc1: { nx: 0.58, nz: 0.5, line: 'mid' },
    pe: { nx: 0.62, nz: 0.22, line: 'mid' },
    pd: { nx: 0.62, nz: 0.78, line: 'mid' },
    ata: { nx: 0.8, nz: 0.5, line: 'att' },
  },
  '3-5-2': {
    gol: { nx: 0.08, nz: 0.5, line: 'def' },
    zag1: { nx: 0.22, nz: 0.32, line: 'def' },
    zag2: { nx: 0.22, nz: 0.5, line: 'def' },
    ld: { nx: 0.22, nz: 0.68, line: 'def' },
    le: { nx: 0.38, nz: 0.08, line: 'mid' },
    vol: { nx: 0.42, nz: 0.5, line: 'mid' },
    mc1: { nx: 0.52, nz: 0.28, line: 'mid' },
    mc2: { nx: 0.52, nz: 0.72, line: 'mid' },
    pe: { nx: 0.58, nz: 0.5, line: 'mid' },
    ata: { nx: 0.76, nz: 0.4, line: 'att' },
    pd: { nx: 0.76, nz: 0.6, line: 'att' },
  },
  '4-5-1': {
    gol: { nx: 0.08, nz: 0.5, line: 'def' },
    zag1: { nx: 0.22, nz: 0.36, line: 'def' },
    zag2: { nx: 0.22, nz: 0.64, line: 'def' },
    le: { nx: 0.28, nz: 0.1, line: 'def' },
    ld: { nx: 0.28, nz: 0.9, line: 'def' },
    vol: { nx: 0.4, nz: 0.5, line: 'mid' },
    mc1: { nx: 0.48, nz: 0.25, line: 'mid' },
    mc2: { nx: 0.48, nz: 0.75, line: 'mid' },
    pe: { nx: 0.55, nz: 0.12, line: 'mid' },
    pd: { nx: 0.55, nz: 0.88, line: 'mid' },
    ata: { nx: 0.72, nz: 0.5, line: 'att' },
  },
  '5-3-2': {
    gol: { nx: 0.06, nz: 0.5, line: 'def' },
    zag1: { nx: 0.18, nz: 0.3, line: 'def' },
    zag2: { nx: 0.18, nz: 0.5, line: 'def' },
    le: { nx: 0.18, nz: 0.7, line: 'def' },
    ld: { nx: 0.26, nz: 0.12, line: 'def' },
    vol: { nx: 0.26, nz: 0.88, line: 'def' },
    mc1: { nx: 0.44, nz: 0.35, line: 'mid' },
    mc2: { nx: 0.44, nz: 0.65, line: 'mid' },
    pe: { nx: 0.52, nz: 0.5, line: 'mid' },
    ata: { nx: 0.7, nz: 0.4, line: 'att' },
    pd: { nx: 0.7, nz: 0.6, line: 'att' },
  },
  '3-4-3': {
    gol: { nx: 0.08, nz: 0.5, line: 'def' },
    zag1: { nx: 0.22, nz: 0.35, line: 'def' },
    zag2: { nx: 0.22, nz: 0.65, line: 'def' },
    le: { nx: 0.28, nz: 0.1, line: 'def' },
    ld: { nx: 0.42, nz: 0.12, line: 'mid' },
    vol: { nx: 0.45, nz: 0.5, line: 'mid' },
    mc1: { nx: 0.52, nz: 0.32, line: 'mid' },
    mc2: { nx: 0.52, nz: 0.68, line: 'mid' },
    pe: { nx: 0.74, nz: 0.18, line: 'att' },
    ata: { nx: 0.8, nz: 0.5, line: 'att' },
    pd: { nx: 0.74, nz: 0.82, line: 'att' },
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
