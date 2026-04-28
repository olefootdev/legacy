import type { SlotIndex } from './types';

// Geometria do gol e da câmera (calibrado e aprovado em 2026-04-28)
export const VIEW_W = 800;
export const VIEW_H = 560;

export const GOAL = {
  x: 50,
  y: 60,
  w: 700,
  h: 280,
  cornerRadius: 22,
  frameWidth: 10,
} as const;

export const SLOT_COLS = 3;
export const SLOT_ROWS = 3;
export const SLOT_W = GOAL.w / SLOT_COLS;
export const SLOT_H = GOAL.h / SLOT_ROWS;

// Bola — tamanhos calibrados (foreground próximo + perspectiva)
export const BALL_SIZE_MARCA = 127;
export const BALL_SIZE_FLY_END = 69;
export const BALL_SIZE_RESULT = 69;

// Penalty spot bem na frente da câmera (sensação de proximidade)
export const SPOT = { x: VIEW_W / 2, y: 510 };

// Tempo & força
export const PICK_TIME_SECONDS = 7;
export const POWER_RAMP_MS = 950;
export const POWER_SWEET_LOW = 0.32;
export const POWER_SWEET_HIGH = 0.88;

// Disputa
export const SHOOTOUT_ROUNDS = 5;

// Tolerância pra detecção de trave
export const POST_TOLERANCE = GOAL.frameWidth + 6; // ~16px

export const SLOT_LABELS: Record<SlotIndex, string> = {
  0: 'ALTA ESQ',
  1: 'ALTA MEIO',
  2: 'ALTA DIR',
  3: 'MEIO ESQ',
  4: 'MEIO',
  5: 'MEIO DIR',
  6: 'BAIXA ESQ',
  7: 'BAIXA MEIO',
  8: 'BAIXA DIR',
};

export function slotRect(idx: SlotIndex) {
  const col = idx % SLOT_COLS;
  const row = Math.floor(idx / SLOT_COLS);
  return {
    x: GOAL.x + col * SLOT_W,
    y: GOAL.y + row * SLOT_H,
    cx: GOAL.x + col * SLOT_W + SLOT_W / 2,
    cy: GOAL.y + row * SLOT_H + SLOT_H / 2,
  };
}

export function slotCol(idx: SlotIndex): 0 | 1 | 2 {
  return (idx % SLOT_COLS) as 0 | 1 | 2;
}
