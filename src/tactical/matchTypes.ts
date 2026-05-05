/**
 * /src/tactical/matchTypes.ts
 *
 * Tipos base de partida e lógica de perspectiva de equipa.
 * Consumidos pelo motor, pelo Field Lab e pelo Legacy Mode.
 * NÃO importa nada de UI, páginas ou componentes.
 */

import type { NormalizedPos } from './fieldGeometry';

/** Tempo da partida. */
export type MatchHalf = 1 | 2;

/** Lado da equipa. */
export type TeamSide = 'home' | 'away';

/** Extremidade física do campo (eixo X do motor legado). */
export type PitchEnd = 'west' | 'east';

/** Posição no campo em metros (sistema world do motor legado). */
export interface PitchPosition {
  x: number; // comprimento 0–105m (home→away no 1º tempo)
  z: number; // largura 0–68m
}

/** Contexto de equipa + tempo para cálculos de perspectiva. */
export interface TeamPitchContext {
  team: TeamSide;
  half: MatchHalf;
}

// ── Lógica de perspectiva de equipa ───────────────────────────────────────────
//
// No Legacy Mode cinematográfico o campo TROCA de lado no 2º tempo.
//
// Convenção canônica (sistema normalizado 0–100):
//   1º tempo: Home ataca y=100 (cima/away), defende y=0 (baixo/home)
//   2º tempo: Home ataca y=0  (baixo),      defende y=100 (cima)
//             → campo visual inverte: Home passa para cima
//
// A função normalizeForSide espelha y quando necessário para que
// a posição sempre reflita a perspectiva visual correta do campo.

/**
 * Retorna true se o campo visual deve ser espelhado (y invertido).
 * Acontece no 2º tempo — os times trocam de lado.
 */
export function isFieldMirrored(half: MatchHalf): boolean {
  return half === 2;
}

/**
 * Espelha coordenada y normalizada (0–100) para o 2º tempo.
 * No 2º tempo y=0 passa a ser o lado Away e y=100 o lado Home.
 */
export function mirrorY(y: number): number {
  return 100 - y;
}

/**
 * Converte posição normalizada para a perspectiva visual correta
 * considerando o tempo da partida.
 *
 * Use esta função para posicionar jogadores e bola no campo visual.
 * NÃO use para lógica de decisão do motor — use as funções de @/match/fieldZones.
 */
export function normalizeForVisual(pos: NormalizedPos, half: MatchHalf): NormalizedPos {
  if (half === 1) return pos;
  return { x: pos.x, y: mirrorY(pos.y) };
}

/**
 * Retorna o lado visual onde um time defende (y=0 ou y=100)
 * considerando o tempo da partida.
 *
 * 1º tempo: home defende y=0, away defende y=100
 * 2º tempo: home defende y=100, away defende y=0
 */
export function defendingY(team: TeamSide, half: MatchHalf): 0 | 100 {
  if (half === 1) return team === 'home' ? 0 : 100;
  return team === 'home' ? 100 : 0;
}

/**
 * Retorna o lado visual onde um time ataca (y=0 ou y=100).
 */
export function attackingY(team: TeamSide, half: MatchHalf): 0 | 100 {
  return defendingY(team, half) === 0 ? 100 : 0;
}
