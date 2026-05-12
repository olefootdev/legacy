/**
 * ClassicRegressionGuard — compares before/after metrics to ensure
 * tuning adjustments don't break what's already working.
 */

import type { MatchAnalysis } from './ClassicMatchAnalyzer';
import type { ValidationResult } from './ClassicBehaviorValidator';

export interface RegressionCheck {
  metric: string;
  before: number;
  after: number;
  delta: number;
  deltaPct: number;
  regressed: boolean;
  reason: string;
}

export interface RegressionResult {
  passed: boolean;
  checks: RegressionCheck[];
  summary: string;
}

interface Threshold {
  metric: string;
  extract: (a: MatchAnalysis) => number;
  maxRegression: number;
  direction: 'higher_better' | 'lower_better';
}

const THRESHOLDS: Threshold[] = [
  {
    metric: 'ST goal share',
    extract: a => a.goalsByPosition.ST / Math.max(1, a.totalGoals),
    maxRegression: 0.05,
    direction: 'higher_better',
  },
  {
    metric: 'Attacker shot share',
    extract: a => (a.shotsByPosition.ST + a.shotsByPosition.LW + a.shotsByPosition.RW) / Math.max(1, a.totalShots),
    maxRegression: 0.05,
    direction: 'higher_better',
  },
  {
    metric: 'ST valid shot-zone rate',
    extract: a => a.strikerShotZoneRate,
    maxRegression: 0.05,
    direction: 'higher_better',
  },
  {
    metric: 'ST receive-then-shot rate',
    extract: a => a.strikerReceiveThenShotRate,
    maxRegression: 0.05,
    direction: 'higher_better',
  },
  {
    metric: 'Chance created before goal %',
    extract: a => a.chanceCreatedBeforeGoalPct,
    maxRegression: 0.05,
    direction: 'higher_better',
  },
  {
    metric: 'Build-up chain avg',
    extract: a => a.buildUpChainAvg,
    maxRegression: 0.3,
    direction: 'higher_better',
  },
  {
    metric: 'Defender open play goals',
    extract: a => a.defenderOpenPlayGoals / Math.max(1, a.totalGoals),
    maxRegression: 0.02,
    direction: 'lower_better',
  },
  {
    metric: 'Fullback shots',
    extract: a => a.fullbackShots / Math.max(1, a.totalShots),
    maxRegression: 0.02,
    direction: 'lower_better',
  },
  {
    metric: 'Invalid shots',
    extract: a => a.invalidShots / Math.max(1, a.totalShots),
    maxRegression: 0.01,
    direction: 'lower_better',
  },
  {
    metric: 'Invalid goals',
    extract: a => a.invalidGoals,
    maxRegression: 1,
    direction: 'lower_better',
  },
  {
    metric: 'Avg goals per match',
    extract: a => a.avgGoalsPerMatch,
    maxRegression: 0.4,
    direction: 'higher_better',
  },
];

export function checkRegression(before: MatchAnalysis, after: MatchAnalysis): RegressionResult {
  const checks: RegressionCheck[] = [];
  let anyRegressed = false;

  for (const t of THRESHOLDS) {
    const bVal = t.extract(before);
    const aVal = t.extract(after);
    const delta = aVal - bVal;
    const deltaPct = bVal !== 0 ? delta / Math.abs(bVal) : 0;

    let regressed = false;
    let reason = 'OK';

    if (t.direction === 'higher_better') {
      if (delta < -t.maxRegression) {
        regressed = true;
        reason = `Dropped by ${Math.abs(delta).toFixed(3)} (max allowed: ${t.maxRegression})`;
      }
    } else {
      if (delta > t.maxRegression) {
        regressed = true;
        reason = `Increased by ${delta.toFixed(3)} (max allowed: ${t.maxRegression})`;
      }
    }

    if (regressed) anyRegressed = true;

    checks.push({
      metric: t.metric,
      before: bVal,
      after: aVal,
      delta,
      deltaPct,
      regressed,
      reason,
    });
  }

  const regressionCount = checks.filter(c => c.regressed).length;
  const summary = anyRegressed
    ? `REGRESSION DETECTED: ${regressionCount} metric(s) regressed. Tuning should be reverted.`
    : `No regressions. All ${checks.length} metrics within tolerance.`;

  return { passed: !anyRegressed, checks, summary };
}
