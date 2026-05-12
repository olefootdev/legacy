/**
 * Central tuning configuration for Classic mode.
 * Adjust weights here — not by rewriting engine logic.
 */

export interface ClassicTuningConfig {
  strikerShotBias: number;
  wingerShotBias: number;
  camShotBias: number;
  fullbackShotPenalty: number;
  centerBackShotPenalty: number;
  dmShotPenalty: number;

  wingerCrossBias: number;
  camCreativePassBias: number;
  midfielderProgressivePassBias: number;

  validShotMinXRel: number;
  highChanceZoneMinXRel: number;
  smallBoxMinXRel: number;

  highChanceZoneBonus: number;
  smallBoxFinishBias: number;
  strikerBoxShotFloor: number;

  chanceCreatedRequiredForGoal: boolean;
  longShotGoalBlock: boolean;
  defenderOpenPlayGoalPenalty: number;
  fullbackOpenPlayGoalPenalty: number;

  minBuildUpEventsForGoal: number;
  maxDirectGoalDistance: number;
}

export const DEFAULT_TUNING: ClassicTuningConfig = {
  strikerShotBias: 1.4,
  wingerShotBias: 1.1,
  camShotBias: 1.0,
  fullbackShotPenalty: 0.02,
  centerBackShotPenalty: 0.0,
  dmShotPenalty: 0.15,

  wingerCrossBias: 1.6,
  camCreativePassBias: 1.5,
  midfielderProgressivePassBias: 1.3,

  validShotMinXRel: 0.70,
  highChanceZoneMinXRel: 0.78,
  smallBoxMinXRel: 0.88,

  highChanceZoneBonus: 0.25,
  smallBoxFinishBias: 0.92,
  strikerBoxShotFloor: 0.80,

  chanceCreatedRequiredForGoal: false,
  longShotGoalBlock: true,
  defenderOpenPlayGoalPenalty: 0.98,
  fullbackOpenPlayGoalPenalty: 0.95,

  minBuildUpEventsForGoal: 2,
  maxDirectGoalDistance: 220,
};

let _activeTuning: ClassicTuningConfig = { ...DEFAULT_TUNING };

export function getTuning(): ClassicTuningConfig {
  return _activeTuning;
}

export function setTuning(partial: Partial<ClassicTuningConfig>): void {
  _activeTuning = { ..._activeTuning, ...partial };
}

export function resetTuning(): void {
  _activeTuning = { ...DEFAULT_TUNING };
}
