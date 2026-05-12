/**
 * ClassicTuningEngine — applies small, safe corrections based on QA analysis.
 * Never rewrites logic. Only adjusts weights in classicTuningConfig.
 */

import type { MatchAnalysis } from './ClassicMatchAnalyzer';
import type { ValidationResult } from './ClassicBehaviorValidator';
import { getTuning, setTuning, type ClassicTuningConfig } from './classicTuningConfig';

export interface TuningAdjustment {
  param: keyof ClassicTuningConfig;
  oldValue: number | boolean;
  newValue: number | boolean;
  reason: string;
}

export interface TuningResult {
  adjustments: TuningAdjustment[];
  applied: boolean;
}

export function computeAdjustments(
  analysis: MatchAnalysis,
  validation: ValidationResult,
): TuningAdjustment[] {
  const adjustments: TuningAdjustment[] = [];
  const tuning = getTuning();

  // Fix: Defender goals too high → increase penalty
  const defGoalPct = analysis.defenderOpenPlayGoals / Math.max(1, analysis.totalGoals);
  if (defGoalPct > 0.05) {
    const newPenalty = Math.min(0.99, tuning.defenderOpenPlayGoalPenalty + 0.005 * Math.ceil(defGoalPct * 100));
    if (newPenalty !== tuning.defenderOpenPlayGoalPenalty) {
      adjustments.push({
        param: 'defenderOpenPlayGoalPenalty',
        oldValue: tuning.defenderOpenPlayGoalPenalty,
        newValue: newPenalty,
        reason: `Defender open play goals at ${(defGoalPct * 100).toFixed(1)}% — increasing penalty`,
      });
    }
  }

  // Fix: Fullback shots too high → decrease penalty (lower = less shots)
  const fbShotPct = analysis.fullbackShots / Math.max(1, analysis.totalShots);
  if (fbShotPct > 0.04) {
    const newPenalty = Math.max(0.0, tuning.fullbackShotPenalty - 0.005);
    if (newPenalty !== tuning.fullbackShotPenalty) {
      adjustments.push({
        param: 'fullbackShotPenalty',
        oldValue: tuning.fullbackShotPenalty,
        newValue: newPenalty,
        reason: `Fullback shot rate at ${(fbShotPct * 100).toFixed(1)}% — reducing shot allowance`,
      });
    }
  }

  // Fix: Fullback goals → increase fullback goal penalty
  const fbGoalRate = analysis.fullbackGoals / Math.max(1, analysis.totalMatches);
  if (fbGoalRate > 0.02) {
    const newPenalty = Math.min(0.99, tuning.fullbackOpenPlayGoalPenalty + 0.01);
    adjustments.push({
      param: 'fullbackOpenPlayGoalPenalty',
      oldValue: tuning.fullbackOpenPlayGoalPenalty,
      newValue: newPenalty,
      reason: `Fullback goal rate ${fbGoalRate.toFixed(3)}/match — increasing penalty`,
    });
  }

  // Fix: Striker not shooting in box → increase box shot floor
  const strikerReceiveRate = analysis.strikerReceiveThenShotRate;
  if (strikerReceiveRate < 0.12 && analysis.strikerReceivedInBoxTotal > 5) {
    const newFloor = Math.min(0.95, tuning.strikerBoxShotFloor + 0.03);
    if (newFloor !== tuning.strikerBoxShotFloor) {
      adjustments.push({
        param: 'strikerBoxShotFloor',
        oldValue: tuning.strikerBoxShotFloor,
        newValue: newFloor,
        reason: `Striker receive-then-shot rate ${(strikerReceiveRate * 100).toFixed(0)}% — raising floor`,
      });
    }
  }

  // Fix: ST goals too low → increase striker shot bias
  const stGoalPct = analysis.goalsByPosition.ST / Math.max(1, analysis.totalGoals);
  if (stGoalPct < 0.40 && analysis.totalGoals > 20) {
    const newBias = Math.min(2.0, tuning.strikerShotBias + 0.1);
    adjustments.push({
      param: 'strikerShotBias',
      oldValue: tuning.strikerShotBias,
      newValue: newBias,
      reason: `ST goal share only ${(stGoalPct * 100).toFixed(0)}% — boosting striker shot bias`,
    });
  }

  // Fix: Low chance created before goal → enable requirement
  if (analysis.chanceCreatedBeforeGoalPct < 0.60 && analysis.totalGoals > 30) {
    const newMin = Math.min(4, tuning.minBuildUpEventsForGoal + 1);
    if (newMin !== tuning.minBuildUpEventsForGoal) {
      adjustments.push({
        param: 'minBuildUpEventsForGoal',
        oldValue: tuning.minBuildUpEventsForGoal,
        newValue: newMin,
        reason: `Only ${(analysis.chanceCreatedBeforeGoalPct * 100).toFixed(0)}% goals have chance_created — raising build-up requirement`,
      });
    }
  }

  // Fix: Winger not crossing enough → increase cross bias
  const wingerCrosses = analysis.crossesByPosition.LW + analysis.crossesByPosition.RW;
  const wingerShots = analysis.shotsByPosition.LW + analysis.shotsByPosition.RW;
  if (wingerShots > wingerCrosses * 1.5 && wingerShots > 10) {
    const newBias = Math.min(2.5, tuning.wingerCrossBias + 0.1);
    adjustments.push({
      param: 'wingerCrossBias',
      oldValue: tuning.wingerCrossBias,
      newValue: newBias,
      reason: `Wingers shooting more than crossing — boosting cross bias`,
    });
  }

  // Fix: CM/DM goals too high → increase DM shot penalty
  const cmDmGoals = analysis.goalsByPosition.CM + analysis.goalsByPosition.DM;
  const cmDmGoalPct = cmDmGoals / Math.max(1, analysis.totalGoals);
  if (cmDmGoalPct > 0.20) {
    const newPenalty = Math.max(0.05, tuning.dmShotPenalty - 0.03);
    if (newPenalty !== tuning.dmShotPenalty) {
      adjustments.push({
        param: 'dmShotPenalty',
        oldValue: tuning.dmShotPenalty,
        newValue: newPenalty,
        reason: `CM+DM goal share at ${(cmDmGoalPct * 100).toFixed(0)}% — reducing midfield shot allowance`,
      });
    }
  }

  return adjustments;
}

export function applyAdjustments(adjustments: TuningAdjustment[]): TuningResult {
  if (adjustments.length === 0) return { adjustments: [], applied: false };

  const partial: Partial<ClassicTuningConfig> = {};
  for (const adj of adjustments) {
    (partial as any)[adj.param] = adj.newValue;
  }
  setTuning(partial);

  return { adjustments, applied: true };
}
