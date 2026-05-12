export { simulateMatch, simulateBatch, type SimulatedMatch, type SimulationConfig } from './ClassicAutoSimulator';
export { analyzeMatches, type MatchAnalysis, type RoleGroup } from './ClassicMatchAnalyzer';
export { validateAnalysis, validateMatchEvents, type QAAlert, type ValidationResult } from './ClassicBehaviorValidator';
export { computeAdjustments, applyAdjustments, type TuningAdjustment, type TuningResult } from './ClassicTuningEngine';
export { checkRegression, type RegressionResult, type RegressionCheck } from './ClassicRegressionGuard';
export { runFullQACycle, type QAReport } from './runClassicQA';
export { getTuning, setTuning, resetTuning, DEFAULT_TUNING, type ClassicTuningConfig } from './classicTuningConfig';
