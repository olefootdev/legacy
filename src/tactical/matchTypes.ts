/**
 * /src/tactical/matchTypes.ts
 *
 * Tipos base de partida — camada neutra reutilizável.
 * Consumidos pelo motor, pelo Field Lab e pelo Legacy Mode.
 * NÃO importa nada de UI, páginas ou componentes.
 */

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
