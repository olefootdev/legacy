/**
 * ultralive2d — tipos só de viewer / fase local (sem payload de snapshot).
 * `Ultralive2dStagedPlay` vive em `engine/types.ts` para evitar ciclos de import.
 */

/** Fase local do viewer entre dois TICK_MATCH_MINUTE (não persiste). */
export type UltraliveViewerPhase = 'idle' | 'staging' | 'resolving' | 'cooldown';

export interface UltraliveViewerState {
  phase: UltraliveViewerPhase;
  stagedSeq: number | null;
  choreoProgress01: number;
}
