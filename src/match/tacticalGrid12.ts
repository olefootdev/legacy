/**
 * Campograma 4×3 = 12 setores (D/MD/MO/O × corredor Esq/Cent/Dir).
 * Referência: divisão topográfica do terreno para orientação tática e limites de corredor.
 */
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import { depthFromOwnGoal, getDefendingGoalX, type MatchHalf, type TeamSide } from '@/match/fieldZones';

export type Grid12SectorCode =
  | 'DE'
  | 'DC'
  | 'DD'
  | 'MDE'
  | 'MDC'
  | 'MDD'
  | 'MOE'
  | 'MOC'
  | 'MOD'
  | 'OE'
  | 'OC'
  | 'OD';

/** [corredor Esq → Dir][profundidade Def → Of] — perspetiva da equipa (D = terço do seu golo). */
const CODES: Grid12SectorCode[][] = [
  ['DE', 'MDE', 'MOE', 'OE'],
  ['DC', 'MDC', 'MOC', 'OC'],
  ['DD', 'MDD', 'MOD', 'OD'],
];

/** Faixa em X (metros) para coluna c ∈ [0,3], na perspetiva da CASA (para desenho fixo Oeste→Leste no SVG). */
export function grid12ColumnWorldXRangeForHomeView(half: MatchHalf, col: 0 | 1 | 2 | 3): [number, number] {
  const L = FIELD_LENGTH;
  const gx = getDefendingGoalX('home', half);
  const d0 = (col * L) / 4;
  const d1 = ((col + 1) * L) / 4;
  if (gx < L / 2) return [d0, d1];
  return [L - d1, L - d0];
}

export interface Grid12OverlayCell {
  code: Grid12SectorCode;
  uxLo: number;
  uxHi: number;
  uyLo: number;
  uyHi: number;
  row: 0 | 1 | 2;
  col: 0 | 1 | 2 | 3;
}

/** Células para SVG viewBox 0–100 (x = comprimento, y = largura Z). */
export function buildGrid12OverlayCells(half: MatchHalf): Grid12OverlayCell[] {
  const uyThird = 100 / 3;
  const out: Grid12OverlayCell[] = [];
  for (let row = 0; row < 3; row++) {
    const uyLo = row * uyThird;
    const uyHi = (row + 1) * uyThird;
    for (let col = 0; col < 4; col++) {
      const [xwLo, xwHi] = grid12ColumnWorldXRangeForHomeView(half, col as 0 | 1 | 2 | 3);
      const uxLo = (Math.min(xwLo, xwHi) / FIELD_LENGTH) * 100;
      const uxHi = (Math.max(xwLo, xwHi) / FIELD_LENGTH) * 100;
      out.push({
        code: CODES[row]![col]!,
        uxLo,
        uxHi,
        uyLo,
        uyHi,
        row: row as 0 | 1 | 2,
        col: col as 0 | 1 | 2 | 3,
      });
    }
  }
  return out;
}

/** Setor 12 na perspetiva da equipa (D = defesa da própria baliza). */
export function worldPositionToGrid12CodeForTeam(
  xm: number,
  zm: number,
  team: TeamSide,
  half: MatchHalf,
): Grid12SectorCode {
  const L = FIELD_LENGTH;
  const depth = depthFromOwnGoal(xm, { team, half });
  const col = Math.min(3, Math.max(0, Math.floor((depth / L) * 4)));
  const W = FIELD_WIDTH;
  const row = zm < W / 3 ? 0 : zm < (2 * W) / 3 ? 1 : 2;
  return CODES[row]![col]!;
}

const W3 = FIELD_WIDTH / 3;

/** Laterais e pontas: corredor próprio (não atravessar o campo atrás da bola). */
export function slotFlankCorridorZBounds(slotId: string): { lo: number; hi: number } | null {
  const s = slotId.toLowerCase();
  if (s === 'le' || s === 'pe') {
    return { lo: 2, hi: W3 + 5 };
  }
  if (s === 'ld' || s === 'pd') {
    return { lo: 2 * W3 - 5, hi: FIELD_WIDTH - 2 };
  }
  return null;
}

/**
 * Puxa o alvo Z para o corredor do slot, com suavização face à âncora (forma dinâmica).
 */
export function clampWorldTargetToSlotFlankCorridor(
  slotId: string,
  z: number,
  anchorZ: number,
): number {
  const b = slotFlankCorridorZBounds(slotId);
  if (!b) return z;
  let nz = z;
  if (z < b.lo) {
    const targetZ = Math.max(b.lo, Math.min(anchorZ, b.hi));
    nz = z + (targetZ - z) * 0.74;
    if (nz < b.lo) nz = b.lo;
  } else if (z > b.hi) {
    const targetZ = Math.min(b.hi, Math.max(anchorZ, b.lo));
    nz = z + (targetZ - z) * 0.74;
    if (nz > b.hi) nz = b.hi;
  }
  return Math.min(FIELD_WIDTH - 2, Math.max(2, nz));
}
