/**
 * Barrel export para shared/gamespirit
 * Facilita importações no frontend e backend
 */

export { gameSpiritTick, buildSpiritContext } from './GameSpirit';
export type {
  SpiritContext,
  SpiritOutcome,
  ProposedAction,
  SpiritSnapshotMeta,
  BallZone
} from './types';
export {
  adjustHomeShotWeights,
  DEFAULT_HOME_SHOT_WEIGHTS,
  rollHomeShotLogicalOutcome
} from './spiritStateMachine';
export { updateMomentum } from './momentum';
export { enrichNarrative } from './contextualNarrative';
export { pickLine } from './narrationSeed';
export * as narrativeTemplates from './narrativeTemplates';
