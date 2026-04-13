import type { MatchMode } from '@/engine/types';

/**
 * ultralive2d — helpers de modo.
 * Mapa causal→animação (golo, defesa, bloqueio, fora): `eventChoreography.ts` + `test2d/visualBeatFromCausal.ts`.
 */
/** Modos que partilham campo 2D tático, visitantes no snapshot e feed silencioso / coreografia. */
export const LIVE2D_PITCH_MODES: readonly MatchMode[] = ['test2d'] as const;

export function isLive2dPitchMode(mode: MatchMode): mode is 'test2d' {
  return mode === 'test2d';
}
