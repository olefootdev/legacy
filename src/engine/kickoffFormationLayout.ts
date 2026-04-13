/**
 * Posições iniciais (saída de bola): cada equipa fica no seu meio-campo,
 * mantendo a hierarquia tática do catálogo (def mais recuado → ataque mais próximo da linha média).
 */
import { FORMATION_BASES } from '@/match-engine/formations/catalog';
import type { FormationSchemeId } from '@/match-engine/types';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';

/** Metros “dentro” do meio-campo próprio em relação à linha média (IFAB). */
const KICKOFF_HALF_MARGIN_M = 1.5;

export const KICKOFF_UX_MARGIN = (KICKOFF_HALF_MARGIN_M / FIELD_LENGTH) * 100;

export function outfieldCatalogNxBounds(scheme: FormationSchemeId): { nxMin: number; nxMax: number } {
  const bases = FORMATION_BASES[scheme] ?? FORMATION_BASES['4-3-3'];
  let nxMin = 1;
  let nxMax = 0;
  for (const [sid, b] of Object.entries(bases)) {
    if (sid === 'gol') continue;
    nxMin = Math.min(nxMin, b.nx);
    nxMax = Math.max(nxMax, b.nx);
  }
  if (nxMax < nxMin) return { nxMin: 0.35, nxMax: 0.55 };
  return { nxMin, nxMax };
}

/**
 * Profundidade em % do campo (0 = baliza casa, 100 = baliza visitante).
 * `catalogNx` vem sempre do referencial do catálogo (como na formação “casa”).
 */
export function kickoffEngineXPercent(
  side: 'home' | 'away',
  catalogNx: number,
  nxMin: number,
  nxMax: number,
  isGoalkeeper: boolean,
): number {
  if (isGoalkeeper) {
    return side === 'home' ? catalogNx * 100 : (1 - catalogNx) * 100;
  }
  const span = Math.max(1e-6, nxMax - nxMin);
  if (side === 'home') {
    const t = (catalogNx - nxMin) / span;
    const hi = 50 - KICKOFF_UX_MARGIN;
    const lo = 9;
    return lo + t * (hi - lo);
  }
  const inv = (nxMax - catalogNx) / span;
  const lo = 50 + KICKOFF_UX_MARGIN;
  const hi = 94;
  return lo + inv * (hi - lo);
}

export function kickoffWorldXZ(
  side: 'home' | 'away',
  scheme: FormationSchemeId,
  slotId: string,
): { x: number; z: number } {
  const bases = FORMATION_BASES[scheme] ?? FORMATION_BASES['4-3-3'];
  const slot = bases[slotId] ?? bases.mc1!;
  const { nxMin, nxMax } = outfieldCatalogNxBounds(scheme);
  const ux = kickoffEngineXPercent(side, slot.nx, nxMin, nxMax, slotId === 'gol');
  return {
    x: (ux / 100) * FIELD_LENGTH,
    z: slot.nz * FIELD_WIDTH,
  };
}

export function kickoffHalfMarginMeters(): number {
  return KICKOFF_HALF_MARGIN_M;
}
