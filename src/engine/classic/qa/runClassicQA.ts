/**
 * runClassicQA — orchestrates the full QA simulation cycle.
 *
 * Flow:
 * 1. Run batch of matches (baseline)
 * 2. Analyze behavior
 * 3. Validate against rules
 * 4. Compute tuning adjustments
 * 5. Apply adjustments
 * 6. Run batch again (post-tuning)
 * 7. Check for regressions
 * 8. Report before/after
 *
 * Usage: npx tsx src/engine/classic/qa/runClassicQA.ts
 */

import { simulateBatch } from './ClassicAutoSimulator';
import { analyzeMatches, type MatchAnalysis } from './ClassicMatchAnalyzer';
import { validateAnalysis, validateMatchEvents, type ValidationResult } from './ClassicBehaviorValidator';
import { computeAdjustments, applyAdjustments, type TuningAdjustment } from './ClassicTuningEngine';
import { checkRegression, type RegressionResult } from './ClassicRegressionGuard';
import { resetTuning } from './classicTuningConfig';

export interface QAReport {
  baseline: MatchAnalysis;
  baselineValidation: ValidationResult;
  adjustments: TuningAdjustment[];
  postTuning: MatchAnalysis;
  postTuningValidation: ValidationResult;
  regression: RegressionResult;
  perMatchAlerts: number;
}

export function runFullQACycle(matchCount = 100): QAReport {
  // Reset tuning to defaults
  resetTuning();

  // Phase 1: Baseline simulation
  const baselineMatches = simulateBatch({ matchCount });
  const baseline = analyzeMatches(baselineMatches);
  const baselineValidation = validateAnalysis(baseline);

  // Per-match event validation
  let perMatchAlerts = 0;
  for (const m of baselineMatches) {
    perMatchAlerts += validateMatchEvents(m).length;
  }

  // Phase 2: Compute and apply adjustments
  const adjustments = baselineValidation.status === 'PASS'
    ? []
    : computeAdjustments(baseline, baselineValidation);
  applyAdjustments(adjustments);

  if (adjustments.length === 0) {
    return {
      baseline,
      baselineValidation,
      adjustments,
      postTuning: baseline,
      postTuningValidation: baselineValidation,
      regression: checkRegression(baseline, baseline),
      perMatchAlerts,
    };
  }

  // Phase 3: Post-tuning simulation
  const postMatches = simulateBatch({ matchCount });
  const postTuning = analyzeMatches(postMatches);
  const postTuningValidation = validateAnalysis(postTuning);

  // Phase 4: Regression check
  const regression = checkRegression(baseline, postTuning);

  // If regression detected, revert
  if (!regression.passed) {
    resetTuning();
  }

  return {
    baseline,
    baselineValidation,
    adjustments,
    postTuning,
    postTuningValidation,
    regression,
    perMatchAlerts,
  };
}

function formatReport(report: QAReport): string {
  const { baseline, baselineValidation, adjustments, postTuning, postTuningValidation, regression } = report;

  const lines: string[] = [];
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('         CLASSIC MATCH QA REPORT');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('── BASELINE ────────────────────────────────────────────');
  lines.push(`  Matches simulated:    ${baseline.totalMatches}`);
  lines.push(`  Total goals:          ${baseline.totalGoals}`);
  lines.push(`  Avg goals/match:      ${baseline.avgGoalsPerMatch.toFixed(2)}`);
  lines.push(`  Total shots:          ${baseline.totalShots}`);
  lines.push(`  Avg shots/match:      ${baseline.avgShotsPerMatch.toFixed(1)}`);
  lines.push('');
  lines.push('  Goals by position:');
  const gp = baseline.goalsByPosition;
  const tg = Math.max(1, baseline.totalGoals);
  lines.push(`    ST/CF:   ${gp.ST} (${(gp.ST / tg * 100).toFixed(0)}%)`);
  lines.push(`    LW:      ${gp.LW} (${(gp.LW / tg * 100).toFixed(0)}%)`);
  lines.push(`    RW:      ${gp.RW} (${(gp.RW / tg * 100).toFixed(0)}%)`);
  lines.push(`    CAM:     ${gp.CAM} (${(gp.CAM / tg * 100).toFixed(0)}%)`);
  lines.push(`    CM:      ${gp.CM} (${(gp.CM / tg * 100).toFixed(0)}%)`);
  lines.push(`    DM:      ${gp.DM} (${(gp.DM / tg * 100).toFixed(0)}%)`);
  lines.push(`    CB:      ${gp.CB} (${(gp.CB / tg * 100).toFixed(0)}%)`);
  lines.push(`    LB:      ${gp.LB} (${(gp.LB / tg * 100).toFixed(0)}%)`);
  lines.push(`    RB:      ${gp.RB} (${(gp.RB / tg * 100).toFixed(0)}%)`);
  lines.push('');
  lines.push('  Shots by position:');
  const sp = baseline.shotsByPosition;
  const ts = Math.max(1, baseline.totalShots);
  lines.push(`    ST/CF:   ${sp.ST} (${(sp.ST / ts * 100).toFixed(0)}%)`);
  lines.push(`    LW:      ${sp.LW} (${(sp.LW / ts * 100).toFixed(0)}%)`);
  lines.push(`    RW:      ${sp.RW} (${(sp.RW / ts * 100).toFixed(0)}%)`);
  lines.push(`    CAM:     ${sp.CAM} (${(sp.CAM / ts * 100).toFixed(0)}%)`);
  lines.push(`    CM:      ${sp.CM} (${(sp.CM / ts * 100).toFixed(0)}%)`);
  lines.push(`    DM:      ${sp.DM} (${(sp.DM / ts * 100).toFixed(0)}%)`);
  lines.push(`    CB:      ${sp.CB} (${(sp.CB / ts * 100).toFixed(0)}%)`);
  lines.push(`    LB+RB:   ${sp.LB + sp.RB} (${((sp.LB + sp.RB) / ts * 100).toFixed(0)}%)`);
  lines.push('');
  lines.push('  Quality metrics:');
  lines.push(`    Invalid shots:                ${baseline.invalidShots}`);
  lines.push(`    Invalid goals:                ${baseline.invalidGoals}`);
  lines.push(`    Defender open play goals:     ${baseline.defenderOpenPlayGoals}`);
  lines.push(`    Fullback shots:               ${baseline.fullbackShots}`);
  lines.push(`    Fullback goals:               ${baseline.fullbackGoals}`);
  lines.push(`    ST valid shot-zone rate:       ${(baseline.strikerShotZoneRate * 100).toFixed(0)}%`);
  lines.push(`    ST receive-then-shot rate:     ${(baseline.strikerReceiveThenShotRate * 100).toFixed(0)}%`);
  lines.push(`    ST receive-then-shot count:    ${baseline.strikerReceivedInBoxAndShot}/${baseline.strikerReceivedInBoxTotal}`);
  lines.push(`    Chance created before goal:    ${(baseline.chanceCreatedBeforeGoalPct * 100).toFixed(0)}%`);
  lines.push(`    Build-up chain avg:            ${baseline.buildUpChainAvg.toFixed(1)} events`);
  lines.push(`    Duels per match:               ${baseline.duelsPerMatch.toFixed(1)}`);
  lines.push(`    Timeline events per match:     ${baseline.timelineEligibleEventsPerMatch.toFixed(1)}`);
  lines.push(`    Skill events per match:        ${(baseline.skillEvents / Math.max(1, baseline.totalMatches)).toFixed(1)}`);
  lines.push(`    Per-match event alerts:        ${report.perMatchAlerts}`);
  lines.push('');
  lines.push(`  Status: ${baselineValidation.status}`);
  if (baselineValidation.alerts.length > 0) {
    lines.push('  Alerts:');
    for (const a of baselineValidation.alerts) {
      lines.push(`    ${a.message}`);
    }
  }
  lines.push('');

  lines.push('  Command style metrics:');
  for (const [style, m] of Object.entries(baseline.commandStyleMetrics)) {
    lines.push(`    ${style}: matches=${m.matches}, shots=${m.shots}, crosses=${m.crosses}, quick=${m.quickPasses}, planned=${m.plannedPasses}, mids=${m.midfielderTouches}`);
  }
  lines.push('');

  if (adjustments.length > 0) {
    lines.push('── TUNING ADJUSTMENTS ──────────────────────────────────');
    for (const adj of adjustments) {
      lines.push(`  ${adj.param}: ${adj.oldValue} → ${adj.newValue}`);
      lines.push(`    Reason: ${adj.reason}`);
    }
    lines.push('');
  }

  lines.push('── POST-TUNING ─────────────────────────────────────────');
  lines.push(`  Avg goals/match:      ${postTuning.avgGoalsPerMatch.toFixed(2)}`);
  const gp2 = postTuning.goalsByPosition;
  const tg2 = Math.max(1, postTuning.totalGoals);
  lines.push(`  ST goals:             ${gp2.ST} (${(gp2.ST / tg2 * 100).toFixed(0)}%)`);
  lines.push(`  Defender OPG:         ${postTuning.defenderOpenPlayGoals}`);
  lines.push(`  Fullback shots:       ${postTuning.fullbackShots}`);
  lines.push(`  Invalid goals:        ${postTuning.invalidGoals}`);
  lines.push(`  ST valid shot-zone:   ${(postTuning.strikerShotZoneRate * 100).toFixed(0)}%`);
  lines.push(`  ST receive->shot:     ${(postTuning.strikerReceiveThenShotRate * 100).toFixed(0)}%`);
  lines.push(`  Status: ${postTuningValidation.status}`);
  lines.push('');

  lines.push('── REGRESSION CHECK ────────────────────────────────────');
  lines.push(`  Result: ${regression.passed ? 'PASSED' : 'FAILED — tuning reverted'}`);
  for (const c of regression.checks) {
    const arrow = c.regressed ? '✗' : '✓';
    lines.push(`  ${arrow} ${c.metric}: ${c.before.toFixed(3)} → ${c.after.toFixed(3)} (${c.reason})`);
  }
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');

  return lines.join('\n');
}

// CLI entry point
if (typeof process !== 'undefined' && process.argv[1]?.includes('runClassicQA')) {
  const count = parseInt(process.argv[2] ?? '100', 10);
  console.log(`Running Classic QA with ${count} matches...`);
  const report = runFullQACycle(count);
  console.log(formatReport(report));
}
