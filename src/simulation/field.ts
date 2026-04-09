/** Metros virtuais — eixo X comprimento (0 = gol casa), Z largura. Y altura (solo = 0). */
export const FIELD_LENGTH = 105;
export const FIELD_WIDTH = 68;

export function clampToPitch(x: number, z: number, margin = 1): { x: number; z: number } {
  return {
    x: Math.min(FIELD_LENGTH - margin, Math.max(margin, x)),
    z: Math.min(FIELD_WIDTH - margin, Math.max(margin, z)),
  };
}

/** UI 0–100 (x profundidade ataque casa →, y largura) → metros. */
export function uiPercentToWorld(ux: number, uy: number): { x: number; z: number } {
  return {
    x: (ux / 100) * FIELD_LENGTH,
    z: (uy / 100) * FIELD_WIDTH,
  };
}

export function worldToUiPercent(x: number, z: number): { ux: number; uy: number } {
  return {
    ux: (x / FIELD_LENGTH) * 100,
    uy: (z / FIELD_WIDTH) * 100,
  };
}
