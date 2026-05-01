export type { CurveKind, AxisDef, CandidateAction, UtilityResult } from './types';
export { evaluateCurve, linear, sigmoid, quadratic_up, quadratic_down, logit } from './curves';
export {
  scoreAction,
  selectBestAction,
  sampleWeightedAction,
  applyInertiaBonus,
  shouldHesitate,
} from './engine';
