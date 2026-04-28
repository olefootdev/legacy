/** Metros virtuais — eixo X comprimento (0 = gol casa), Z largura. Y altura (solo = 0). */
export const FIELD_LENGTH = 105;
export const FIELD_WIDTH = 68;

/** Raio do círculo central (IFAB). */
export const CENTER_CIRCLE_RADIUS_M = 9.15;

/**
 * Boca do golo (planta: largura ao longo de Z). Valores acima do IFAB (7,32 × 2,44 m) para subir taxa de golo.
 * @see https://www.theifab.com/laws/1/field-of-play/ (referência regulamentar)
 */
export const GOAL_INNER_WIDTH_M = 10;
/** Largura interior IFAB (m) — referência para amortecer conversão de remate quando a boca em jogo é maior. */
export const GOAL_INNER_WIDTH_IFAB_M = 7.32;
/** Altura interior do travessão ao solo (referência 3D / UI; remates no plano XZ usam `GOAL_INNER_WIDTH_M` em Z). */
export const GOAL_CROSSBAR_HEIGHT_M = 3;
/** Metade da distância entre postes (metros), a partir do centro da linha de golo. */
export const GOAL_MOUTH_HALF_WIDTH_M = GOAL_INNER_WIDTH_M / 2;

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

/**
 * Bloco B — Fase ofensiva da equipa em posse, em função da posição da bola.
 * Reflete intenção: build_up (defesa+meio-campo defensivo), progression (meio-campo ofensivo),
 * final_third (ante-câmara), box_entry (entrada na área adversária).
 *
 * `attackDir` = +1 quando a equipa ataca para +X, -1 quando ataca para -X.
 */
export function computeAttackPhase(
  ballX: number,
  ballZ: number,
  attackDir: 1 | -1,
): 'build_up' | 'progression' | 'final_third' | 'box_entry' {
  const along = attackDir === 1 ? ballX : FIELD_LENGTH - ballX;
  const t = along / FIELD_LENGTH;
  if (t > 0.84) {
    const widthFromCenter = Math.abs(ballZ - FIELD_WIDTH / 2);
    if (widthFromCenter < 20.16) return 'box_entry';
    return 'final_third';
  }
  if (t > 0.66) return 'final_third';
  if (t > 0.38) return 'progression';
  return 'build_up';
}
