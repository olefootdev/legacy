/**
 * playerLevel — fórmula determinística de nível do jogador a partir de evolutionXp.
 *
 * Antes: `evolutionXp` era um contador puro sem leitura.
 * Agora: vira nível visível em UI (card / scout / transfer) + thresholds.
 *
 * Curva sqrt: level cresce devagar — XP necessário aumenta a cada nível.
 *   Lv 1 = 0 XP, Lv 2 = 100 XP, Lv 5 = 1600 XP, Lv 10 = 8100 XP, Lv 20 = 36100 XP.
 *   Cap em Lv 99 — alinhado com OVR cap.
 */

const XP_PER_LEVEL_BASE = 100;
const MAX_LEVEL = 99;

export function getPlayerLevel(evolutionXp: number | undefined): number {
  const xp = Number.isFinite(evolutionXp) ? Math.max(0, evolutionXp as number) : 0;
  const lv = Math.floor(Math.sqrt(xp / XP_PER_LEVEL_BASE)) + 1;
  return Math.min(MAX_LEVEL, Math.max(1, lv));
}

export function xpForLevel(level: number): number {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.round(level)));
  return Math.pow(lv - 1, 2) * XP_PER_LEVEL_BASE;
}

export function xpForNextLevel(currentXp: number | undefined): number {
  const lv = getPlayerLevel(currentXp);
  return xpForLevel(lv + 1);
}

/** Progresso 0..1 dentro do nível atual — útil pra UI de barra. */
export function levelProgress01(currentXp: number | undefined): number {
  const xp = Number.isFinite(currentXp) ? Math.max(0, currentXp as number) : 0;
  const lv = getPlayerLevel(xp);
  if (lv >= MAX_LEVEL) return 1;
  const cur = xpForLevel(lv);
  const next = xpForLevel(lv + 1);
  const span = next - cur;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (xp - cur) / span));
}

export interface PlayerLevelInfo {
  level: number;
  xp: number;
  xpForCurrent: number;
  xpForNext: number;
  progress01: number;
  isMaxLevel: boolean;
}

export function getPlayerLevelInfo(currentXp: number | undefined): PlayerLevelInfo {
  const xp = Number.isFinite(currentXp) ? Math.max(0, currentXp as number) : 0;
  const level = getPlayerLevel(xp);
  return {
    level,
    xp,
    xpForCurrent: xpForLevel(level),
    xpForNext: xpForLevel(level + 1),
    progress01: levelProgress01(xp),
    isMaxLevel: level >= MAX_LEVEL,
  };
}
