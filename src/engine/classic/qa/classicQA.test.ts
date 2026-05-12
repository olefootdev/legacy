/**
 * Classic QA Self-Tests — validates engine behavior rules.
 * Run: npx tsx src/engine/classic/qa/classicQA.test.ts
 */

import { simulateBatch } from './ClassicAutoSimulator';
import { analyzeMatches } from './ClassicMatchAnalyzer';
import { validateAnalysis, validateMatchEvents } from './ClassicBehaviorValidator';
import { resetTuning } from './classicTuningConfig';

const MATCH_COUNT = 50;

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`  ✗ FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✓ ${msg}`);
  }
}

function run() {
  console.log('Classic QA Self-Tests');
  console.log('─────────────────────────────────────────');
  console.log(`Simulating ${MATCH_COUNT} matches...`);

  resetTuning();
  const matches = simulateBatch({ matchCount: MATCH_COUNT });
  const analysis = analyzeMatches(matches);
  const validation = validateAnalysis(analysis);

  console.log(`  Total goals: ${analysis.totalGoals}, Total shots: ${analysis.totalShots}`);
  console.log('');

  // test_no_midfield_goals
  console.log('[test_no_midfield_goals]');
  assert(
    analysis.invalidGoals === 0,
    `No goals from midfield (found: ${analysis.invalidGoals})`,
  );

  // test_strikers_shoot_in_box
  console.log('[test_strikers_shoot_in_box]');
  assert(
    analysis.strikerShotZoneRate >= 0.50 || analysis.shotsByPosition.ST < 5,
    `ST valid shot-zone rate >= 50% (actual: ${(analysis.strikerShotZoneRate * 100).toFixed(0)}%)`,
  );

  // test_fullbacks_do_not_shoot_randomly
  console.log('[test_fullbacks_do_not_shoot_randomly]');
  const fbShotPct = analysis.fullbackShots / Math.max(1, analysis.totalShots);
  assert(
    fbShotPct < 0.08,
    `Fullback shot rate < 8% (actual: ${(fbShotPct * 100).toFixed(1)}%)`,
  );

  // test_centerbacks_do_not_score_open_play
  console.log('[test_centerbacks_do_not_score_open_play]');
  const cbGoalPct = analysis.defenderOpenPlayGoals / Math.max(1, analysis.totalGoals);
  assert(
    cbGoalPct < 0.10,
    `Defender open play goal rate < 10% (actual: ${(cbGoalPct * 100).toFixed(1)}%)`,
  );

  // test_goals_require_valid_shot_zone
  console.log('[test_goals_require_valid_shot_zone]');
  assert(
    analysis.invalidGoals === 0,
    `All goals from valid shot zone (invalid: ${analysis.invalidGoals})`,
  );

  // test_goals_have_shot_sequence
  console.log('[test_goals_have_shot_sequence]');
  const noBuildUpPct = analysis.goalsWithoutBuildUp / Math.max(1, analysis.totalGoals);
  assert(
    noBuildUpPct < 0.20,
    `Goals without build-up < 20% (actual: ${(noBuildUpPct * 100).toFixed(0)}%)`,
  );

  // test_chance_created_before_goal
  console.log('[test_chance_created_before_goal]');
  assert(
    analysis.chanceCreatedBeforeGoalPct >= 0.50 || analysis.totalGoals < 10,
    `Chance created before goal >= 50% (actual: ${(analysis.chanceCreatedBeforeGoalPct * 100).toFixed(0)}%)`,
  );

  // test_attackers_lead_shots
  console.log('[test_attackers_lead_shots]');
  const attackerShots = analysis.shotsByPosition.ST + analysis.shotsByPosition.LW + analysis.shotsByPosition.RW;
  const attackerShotPct = attackerShots / Math.max(1, analysis.totalShots);
  assert(
    attackerShotPct >= 0.40,
    `Attackers lead shots >= 40% (actual: ${(attackerShotPct * 100).toFixed(0)}%)`,
  );

  // test_timeline_receives_key_events
  console.log('[test_timeline_receives_key_events]');
  const allEvents = matches.flatMap(m => m.events);
  const hasGoals = allEvents.some(e => e.type === 'goal');
  const hasShots = allEvents.some(e => e.type === 'shot' || e.type === 'save' || e.type === 'wide');
  const hasPasses = allEvents.some(e => e.type === 'pass');
  const hasTackles = allEvents.some(e => e.type === 'tackle');
  assert(
    hasGoals && hasShots && hasPasses && hasTackles,
    `Timeline has goals, shots, passes, tackles`,
  );

  console.log('[test_commands_change_behavior]');
  const styleMetrics = analysis.commandStyleMetrics;
  assert(
    Object.keys(styleMetrics).length >= 2,
    `QA captured multiple command styles (${Object.keys(styleMetrics).join(', ')})`,
  );
  const lateral = styleMetrics.LATERAL;
  const tiktak = styleMetrics.TIKTAK;
  if (lateral && tiktak) {
    const lateralCrossRate = lateral.crosses / Math.max(1, lateral.passes);
    const tiktakQuickRate = tiktak.quickPasses / Math.max(1, tiktak.passes);
    assert(
      lateralCrossRate > 0 || tiktakQuickRate > 0,
      `Commands create measurable pass signatures (lateral crosses ${(lateralCrossRate * 100).toFixed(1)}%, tiktak quick ${(tiktakQuickRate * 100).toFixed(1)}%)`,
    );
  }

  // Per-match event validation
  console.log('[per_match_event_validation]');
  let totalAlerts = 0;
  let cbOpenPlayGoalAlerts = 0;
  for (const m of matches) {
    const alerts = validateMatchEvents(m);
    totalAlerts += alerts.length;
    cbOpenPlayGoalAlerts += alerts.filter(a => a.code === 'CB_OPEN_PLAY_GOAL').length;
  }
  assert(
    cbOpenPlayGoalAlerts <= Math.ceil(MATCH_COUNT * 0.05),
    `CB open play goal alerts <= 5% of matches (found: ${cbOpenPlayGoalAlerts})`,
  );

  console.log('');
  console.log('─────────────────────────────────────────');
  console.log(`Overall validation: ${validation.status}`);
  console.log(`Total per-match alerts: ${totalAlerts}`);
  if (validation.alerts.length > 0) {
    for (const a of validation.alerts) {
      console.log(`  ${a.message}`);
    }
  }
  console.log('─────────────────────────────────────────');
}

run();
