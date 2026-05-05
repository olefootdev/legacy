/**
 * /src/tactical/fieldGeometry.ts
 *
 * Geometria do campo — camada neutra reutilizável.
 * Consumida pelo Field Lab, pelo Legacy Mode e pelo motor real.
 * NÃO importa nada de UI, páginas ou componentes.
 *
 * Sistema de coordenadas normalizadas (0–100):
 *   x: 0=esquerda → 100=direita  (largura, eixo Z do motor)
 *   y: 0=home/baixo → 100=away/cima  (profundidade, eixo X do motor)
 *
 * Sistema de coordenadas em metros (IFAB):
 *   xMeters: 0=esquerda → 68m=direita  (largura, eixo Z do motor)
 *   yMeters: 0=gol home → 105m=gol away  (profundidade, eixo X do motor)
 */

// ── Dimensões reais IFAB ──────────────────────────────────────────────────────
export const FIELD_WIDTH_M  = 68;   // largura (eixo Z no motor)
export const FIELD_LENGTH_M = 105;  // comprimento (eixo X no motor)

// ── Posições normalizadas ─────────────────────────────────────────────────────
export interface NormalizedPos {
  x: number; // largura 0–100
  y: number; // profundidade 0–100 (home=0, away=100)
}

// ── Posições em metros ────────────────────────────────────────────────────────
export interface MetersPos {
  xMeters: number; // largura 0–68m
  yMeters: number; // profundidade 0–105m (gol home=0, gol away=105)
}

// ── Bridge: normalizado ↔ metros ──────────────────────────────────────────────

/**
 * Converte coordenadas normalizadas (0–100) para metros reais IFAB.
 * x=largura: (x/100) * 68m
 * y=profundidade: (y/100) * 105m
 */
export function normalizedToMeters(pos: NormalizedPos): MetersPos {
  return {
    xMeters: (pos.x / 100) * FIELD_WIDTH_M,
    yMeters: (pos.y / 100) * FIELD_LENGTH_M,
  };
}

/**
 * Converte metros reais IFAB para coordenadas normalizadas (0–100).
 * xMeters=largura: (xMeters/68) * 100
 * yMeters=profundidade: (yMeters/105) * 100
 */
export function metersToNormalized(pos: MetersPos): NormalizedPos {
  return {
    x: (pos.xMeters / FIELD_WIDTH_M)  * 100,
    y: (pos.yMeters / FIELD_LENGTH_M) * 100,
  };
}

// ── SVG First View (Legacy Mode) ──────────────────────────────────────────────
// Constantes do trapézio — idênticas ao FieldView.tsx original
export const FV_SVG_W         = 720;
export const FV_SVG_H         = 1100;
export const FV_CX            = FV_SVG_W / 2;  // 360
export const FV_TOP_Y         = 110;            // y SVG do gol Away (cima/longe)
export const FV_BOTTOM_Y      = 990;            // y SVG do gol Home (baixo/perto)
export const FV_TOP_HALF_W    = 290;            // meia-largura no topo
export const FV_BOTTOM_HALF_W = 430;            // meia-largura na base

/**
 * 4 cantos do trapézio em pixels SVG.
 * Derivados das constantes acima — fonte única de verdade.
 */
export const FIELD_POLYGON = {
  BL: { sx: FV_CX - FV_BOTTOM_HALF_W, sy: FV_BOTTOM_Y }, // x=0,   y=0   (home-esquerda)
  BR: { sx: FV_CX + FV_BOTTOM_HALF_W, sy: FV_BOTTOM_Y }, // x=100, y=0   (home-direita)
  TR: { sx: FV_CX + FV_TOP_HALF_W,    sy: FV_TOP_Y    }, // x=100, y=100 (away-direita)
  TL: { sx: FV_CX - FV_TOP_HALF_W,    sy: FV_TOP_Y    }, // x=0,   y=100 (away-esquerda)
} as const;

/**
 * Interpolação linear entre dois valores.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

/**
 * Projeta coordenadas normalizadas (0–100) para pixels SVG do Legacy First View.
 *
 * Usa easing não-linear no eixo Y (profundidade) — Math.pow(t, 0.78) —
 * idêntico ao FieldView.tsx original para simular foreshortening real.
 * Interpolação linear no eixo X (largura).
 *
 * x: 0=esquerda → 100=direita
 * y: 0=home(baixo) → 100=away(cima)
 */
export function normalizedToFirstViewSvg(pos: NormalizedPos): { sx: number; sy: number } {
  const nx = pos.x / 100;
  const ny = Math.pow(Math.max(0, Math.min(1, pos.y / 100)), 0.78);
  const halfW = lerp(FV_BOTTOM_HALF_W, FV_TOP_HALF_W, ny);
  return {
    sx: FV_CX + (nx - 0.5) * 2 * halfW,
    sy: lerp(FV_BOTTOM_Y, FV_TOP_Y, ny),
  };
}

/**
 * Projeta 4 cantos de uma zona normalizada em string de polygon points SVG.
 * Ordem: BL → BR → TR → TL (sentido horário).
 */
export function zoneBoundsToPolygonPoints(
  xMin: number, xMax: number,
  yMin: number, yMax: number,
): string {
  const bl = normalizedToFirstViewSvg({ x: xMin, y: yMin });
  const br = normalizedToFirstViewSvg({ x: xMax, y: yMin });
  const tr = normalizedToFirstViewSvg({ x: xMax, y: yMax });
  const tl = normalizedToFirstViewSvg({ x: xMin, y: yMax });
  return `${bl.sx},${bl.sy} ${br.sx},${br.sy} ${tr.sx},${tr.sy} ${tl.sx},${tl.sy}`;
}
