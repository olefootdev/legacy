import { FIELD_LENGTH } from '@/simulation/field';
import type { PitchZone } from './types';
import type { PossessionSide } from '@/engine/types';

/** Zona da bola no referencial do campo absoluto (metros X). */
export function pitchZoneFromBallX(ballX: number): PitchZone {
  const nx = ballX / FIELD_LENGTH;
  if (nx < 0.22) return 'def_low';
  if (nx < 0.38) return 'def_mid';
  if (nx < 0.55) return 'mid';
  if (nx < 0.78) return 'att';
  return 'final_third';
}

/**
 * Terço ofensivo do time com posse (casa ataca +X).
 * Ex.: casa com bola em X alto → ataque; visitante com bola em X baixo → ataque visitante.
 */
export function attackingThirdForSide(side: PossessionSide, ballX: number): boolean {
  if (side === 'home') return ballX > FIELD_LENGTH * 0.58;
  return ballX < FIELD_LENGTH * 0.42;
}

export function buildZoneForSide(side: PossessionSide, ballX: number): boolean {
  if (side === 'home') return ballX < FIELD_LENGTH * 0.38;
  return ballX > FIELD_LENGTH * 0.62;
}
