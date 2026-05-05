/**
 * /src/tactical/fieldGeometry.ts
 *
 * FONTE ÚNICA DE VERDADE para geometria do campo Olefoot.
 * Consumida pelo Field Lab, pelo Legacy Mode e pelo motor real.
 * NÃO importa nada de UI, páginas ou componentes.
 *
 * ── Sistemas de coordenadas ───────────────────────────────────────────────────
 *
 * [CANÔNICO] Normalizado (0–100) — Field Lab / Legacy Mode:
 *   x: 0=esquerda → 100=direita        (largura)
 *   y: 0=home/baixo → 100=away/cima    (profundidade)
 *
 * [MOTOR] Metros IFAB:
 *   xMeters: 0=esquerda → 68m=direita  (largura)
 *   yMeters: 0=gol home → 105m=gol away (profundidade)
 *
 * [MOTOR LEGADO] World coords — @/simulation/field (compatibilidade):
 *   x: 0 → 105m  (comprimento, home→away)   ← eixo invertido vs canônico
 *   z: 0 → 68m   (largura)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DIMENSÕES REAIS IFAB
// ═══════════════════════════════════════════════════════════════════════════════
export const FIELD_WIDTH_M  = 68;
export const FIELD_LENGTH_M = 105;

// Aliases de compatibilidade com @/simulation/field
export const FIELD_LENGTH = FIELD_LENGTH_M;
export const FIELD_WIDTH  = FIELD_WIDTH_M;

// ── Gol ───────────────────────────────────────────────────────────────────────
export const GOAL_INNER_WIDTH_M      = 10;
export const GOAL_INNER_WIDTH_IFAB_M = 7.32;
export const GOAL_CROSSBAR_HEIGHT_M  = 3;
export const GOAL_MOUTH_HALF_WIDTH_M = GOAL_INNER_WIDTH_M / 2;
export const GOAL_DEPTH_M            = 2.5; // profundidade física do gol (gameplay)

// ── Marcações em metros ───────────────────────────────────────────────────────
export const CENTER_CIRCLE_RADIUS_M  = 9.15;
export const PENALTY_SPOT_M          = 11;
export const PENALTY_AREA_DEPTH_M    = 16.5;
export const PENALTY_AREA_HALF_W_M   = 20.16;
export const GOAL_AREA_DEPTH_M       = 5.5;
export const GOAL_AREA_HALF_W_M      = 9.16;
export const GOAL_WIDTH_M            = 7.32;
export const GOAL_HALF_W_M           = GOAL_WIDTH_M / 2;

// ── Marcações normalizadas (0–100) ────────────────────────────────────────────
export const N_PENALTY_SPOT_HOME = (PENALTY_SPOT_M       / FIELD_LENGTH_M) * 100; // ≈ 10.48
export const N_PENALTY_SPOT_AWAY = 100 - N_PENALTY_SPOT_HOME;                     // ≈ 89.52
export const N_BOX_DEPTH         = (PENALTY_AREA_DEPTH_M / FIELD_LENGTH_M) * 100; // ≈ 15.71
export const N_SIX_DEPTH         = (GOAL_AREA_DEPTH_M    / FIELD_LENGTH_M) * 100; // ≈ 5.24
export const N_MIDFIELD          = 50;
export const N_BOX_HALF_W        = (PENALTY_AREA_HALF_W_M / FIELD_WIDTH_M) * 50;  // ≈ 14.82
export const N_SIX_HALF_W        = (GOAL_AREA_HALF_W_M    / FIELD_WIDTH_M) * 50;  // ≈ 6.74
export const N_GOAL_HALF_W       = (GOAL_HALF_W_M          / FIELD_WIDTH_M) * 50;  // ≈ 5.38
export const N_GOAL_MOUTH_HALF_W = (GOAL_MOUTH_HALF_WIDTH_M / FIELD_WIDTH_M) * 50; // ≈ 7.35 (largura gameplay)
export const N_GOAL_DEPTH        = (GOAL_DEPTH_M            / FIELD_LENGTH_M) * 100; // ≈ 2.38

// ── Bounds normalizados das áreas ─────────────────────────────────────────────
export const BOX_HOME = { xMin: 50 - N_BOX_HALF_W, xMax: 50 + N_BOX_HALF_W, yMin: 0,                  yMax: N_BOX_DEPTH         } as const;
export const BOX_AWAY = { xMin: 50 - N_BOX_HALF_W, xMax: 50 + N_BOX_HALF_W, yMin: 100 - N_BOX_DEPTH,  yMax: 100                 } as const;
export const SIX_HOME = { xMin: 50 - N_SIX_HALF_W, xMax: 50 + N_SIX_HALF_W, yMin: 0,                  yMax: N_SIX_DEPTH         } as const;
export const SIX_AWAY = { xMin: 50 - N_SIX_HALF_W, xMax: 50 + N_SIX_HALF_W, yMin: 100 - N_SIX_DEPTH,  yMax: 100                 } as const;
export const GOAL_HOME = { xMin: 50 - N_GOAL_MOUTH_HALF_W, xMax: 50 + N_GOAL_MOUTH_HALF_W, yMin: 0,                   yMax: N_GOAL_DEPTH         } as const;
export const GOAL_AWAY = { xMin: 50 - N_GOAL_MOUTH_HALF_W, xMax: 50 + N_GOAL_MOUTH_HALF_W, yMin: 100 - N_GOAL_DEPTH,  yMax: 100                  } as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS DE POSIÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

/** Coordenadas canônicas normalizadas (0–100). Sistema do Field Lab / Legacy Mode. */
export interface NormalizedPos {
  x: number; // largura 0–100
  y: number; // profundidade 0–100 (home=0, away=100)
}

/** Coordenadas em metros IFAB. */
export interface MetersPos {
  xMeters: number; // largura 0–68m
  yMeters: number; // profundidade 0–105m
}

/** Coordenadas world do motor legado (@/simulation/field). */
export interface WorldPos {
  x: number; // comprimento 0–105m (home→away)
  z: number; // largura 0–68m
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSÕES
// ═══════════════════════════════════════════════════════════════════════════════

/** Normalizado → metros. */
export function normalizedToMeters(pos: NormalizedPos): MetersPos {
  return {
    xMeters: (pos.x / 100) * FIELD_WIDTH_M,
    yMeters: (pos.y / 100) * FIELD_LENGTH_M,
  };
}

/** Metros → normalizado. */
export function metersToNormalized(pos: MetersPos): NormalizedPos {
  return {
    x: (pos.xMeters / FIELD_WIDTH_M)  * 100,
    y: (pos.yMeters / FIELD_LENGTH_M) * 100,
  };
}

/**
 * World coords do motor legado (x=comprimento, z=largura) → normalizado.
 * ATENÇÃO: no motor legado x=profundidade, z=largura — invertido vs canônico.
 */
export function worldToNormalized(pos: WorldPos): NormalizedPos {
  return {
    x: (pos.z / FIELD_WIDTH_M)  * 100,
    y: (pos.x / FIELD_LENGTH_M) * 100,
  };
}

/** Normalizado → world coords do motor legado. */
export function normalizedToWorld(pos: NormalizedPos): WorldPos {
  return {
    x: (pos.y / 100) * FIELD_LENGTH_M,
    z: (pos.x / 100) * FIELD_WIDTH_M,
  };
}

/** UI percent do motor legado → world. Compatibilidade com @/simulation/field. */
export function uiPercentToWorld(ux: number, uy: number): WorldPos {
  return {
    x: (ux / 100) * FIELD_LENGTH_M,
    z: (uy / 100) * FIELD_WIDTH_M,
  };
}

/** World → UI percent do motor legado. */
export function worldToUiPercent(x: number, z: number): { ux: number; uy: number } {
  return {
    ux: (x / FIELD_LENGTH_M) * 100,
    uy: (z / FIELD_WIDTH_M)  * 100,
  };
}

/** Limita posição world aos limites do campo com margem. */
export function clampToPitch(x: number, z: number, margin = 1): WorldPos {
  return {
    x: Math.min(FIELD_LENGTH_M - margin, Math.max(margin, x)),
    z: Math.min(FIELD_WIDTH_M  - margin, Math.max(margin, z)),
  };
}

/** Fase de ataque baseada na posição da bola (world coords). */
export function computeAttackPhase(
  ballX: number,
  ballZ: number,
  attackDir: 1 | -1,
): 'build_up' | 'progression' | 'final_third' | 'box_entry' {
  const along = attackDir === 1 ? ballX : FIELD_LENGTH_M - ballX;
  const t = along / FIELD_LENGTH_M;
  if (t > 0.84) {
    const widthFromCenter = Math.abs(ballZ - FIELD_WIDTH_M / 2);
    if (widthFromCenter < PENALTY_AREA_HALF_W_M) return 'box_entry';
    return 'final_third';
  }
  if (t > 0.66) return 'final_third';
  if (t > 0.38) return 'progression';
  return 'build_up';
}

// ── Predicados ────────────────────────────────────────────────────────────────

/** Verifica se posição normalizada está dentro da grande área de um lado. */
export function isInsideBox(pos: NormalizedPos, side: 'home' | 'away'): boolean {
  const box = side === 'home' ? BOX_HOME : BOX_AWAY;
  return pos.x >= box.xMin && pos.x <= box.xMax &&
         pos.y >= box.yMin && pos.y <= box.yMax;
}

/** Verifica se posição normalizada está no terço ofensivo. */
export function isInFinalThird(pos: NormalizedPos, attackingSide: 'home' | 'away'): boolean {
  return attackingSide === 'home' ? pos.y > 66.6 : pos.y < 33.3;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG FIRST VIEW — Legacy Mode
// ═══════════════════════════════════════════════════════════════════════════════
export const FV_SVG_W         = 720;
export const FV_SVG_H         = 1100;
export const FV_CX            = FV_SVG_W / 2;
export const FV_TOP_Y         = 110;
export const FV_BOTTOM_Y      = 990;
export const FV_TOP_HALF_W    = 290;
export const FV_BOTTOM_HALF_W = 430;

export const FIELD_POLYGON = {
  BL: { sx: FV_CX - FV_BOTTOM_HALF_W, sy: FV_BOTTOM_Y },
  BR: { sx: FV_CX + FV_BOTTOM_HALF_W, sy: FV_BOTTOM_Y },
  TR: { sx: FV_CX + FV_TOP_HALF_W,    sy: FV_TOP_Y    },
  TL: { sx: FV_CX - FV_TOP_HALF_W,    sy: FV_TOP_Y    },
} as const;

export function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

/**
 * Projeta coordenadas normalizadas → pixels SVG Legacy First View.
 * Easing Math.pow(t, 0.78) no eixo Y para foreshortening real.
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

/** 4 cantos de uma zona normalizada → polygon points SVG. */
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
