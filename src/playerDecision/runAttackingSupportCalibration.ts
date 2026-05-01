/**
 * Synthetic calibration test for attacking support Utility AI.
 *
 * Run: npx tsx src/playerDecision/runAttackingSupportCalibration.ts
 *
 * Substitui a calibração observacional (impossível autonomamente porque o
 * engine não atinge att_third em idle). Roda 25+ cenários parametrizados
 * que cobrem o espaço de decisão, valida que cada action canônica dispara
 * no contexto esperado, e detecta low-margin (ambiguidade) quando 2+
 * candidates estão muito próximos.
 */

import {
  buildAttackingInputs,
  selectAttackingAction,
  ATTACKING_FIRE_THRESHOLD,
  type AttackingActionId,
} from './utilityAttackingSupport';

interface Scenario {
  id: string;
  desc: string;
  role: string;
  slot: string;
  attackPhase: string | undefined;
  inBoxCount: number;
  shouldAnchor: boolean;
  distToBall: number;
  sq: null | { usefulness: number; suggestion: string };
  expect: AttackingActionId | 'FALLTHROUGH';
}

const SCENARIOS: Scenario[] = [
  // === BOX INVASION (Phase 2) ===
  {
    id: 'A1', desc: 'Striker, box_entry, box not full → infiltrate',
    role: 'attack', slot: 'ata1', attackPhase: 'box_entry', inBoxCount: 2,
    shouldAnchor: false, distToBall: 18, sq: null,
    expect: 'striker_infiltrate_box',
  },
  {
    id: 'A2', desc: 'Striker, final_third, box not full → infiltrate',
    role: 'attack', slot: 'ata1', attackPhase: 'final_third', inBoxCount: 1,
    shouldAnchor: false, distToBall: 22, sq: null,
    expect: 'striker_infiltrate_box',
  },
  {
    id: 'A3', desc: 'Striker, box_entry, BOX FULL → fallthrough',
    role: 'attack', slot: 'ata1', attackPhase: 'box_entry', inBoxCount: 4,
    shouldAnchor: false, distToBall: 18, sq: null,
    expect: 'FALLTHROUGH',
  },
  {
    id: 'A4', desc: 'Winger PE, box_entry, box not full → attack_depth',
    role: 'mid', slot: 'pe1', attackPhase: 'box_entry', inBoxCount: 2,
    shouldAnchor: false, distToBall: 20, sq: null,
    expect: 'winger_attack_depth',
  },
  {
    id: 'A5', desc: 'Winger PD, final_third → attack_depth',
    role: 'mid', slot: 'pd1', attackPhase: 'final_third', inBoxCount: 0,
    shouldAnchor: false, distToBall: 25, sq: null,
    expect: 'winger_attack_depth',
  },
  {
    id: 'A6', desc: 'Fullback LE, box_entry → fb overlap',
    role: 'def', slot: 'le', attackPhase: 'box_entry', inBoxCount: 2,
    shouldAnchor: false, distToBall: 26, sq: null,
    expect: 'fullback_overlap_box_entry',
  },
  {
    id: 'A7', desc: 'Fullback LE, final_third (NOT box_entry) → falls through',
    role: 'def', slot: 'le', attackPhase: 'final_third', inBoxCount: 2,
    shouldAnchor: false, distToBall: 26, sq: null,
    expect: 'FALLTHROUGH',
  },
  {
    id: 'A8', desc: 'Mid AM, final_third → mid_attack_depth',
    role: 'mid', slot: 'am', attackPhase: 'final_third', inBoxCount: 1,
    shouldAnchor: false, distToBall: 28, sq: null,
    expect: 'mid_attack_depth',
  },
  // === ANCHOR (Phase 3) ===
  {
    id: 'B1', desc: 'Defender, no box invasion, shouldAnchor → anchor_to_slot',
    role: 'def', slot: 'zag1', attackPhase: 'progression', inBoxCount: 0,
    shouldAnchor: true, distToBall: 25, sq: null,
    expect: 'anchor_to_slot',
  },
  {
    id: 'B2', desc: 'Mid, mid-third, shouldAnchor → anchor',
    role: 'mid', slot: 'vol', attackPhase: 'progression', inBoxCount: 0,
    shouldAnchor: true, distToBall: 20, sq: null,
    expect: 'anchor_to_slot',
  },
  // === STRUCTURAL HOLD (Phase 3) ===
  {
    id: 'C1', desc: 'Mid, far from ball (35m), no anchor → structural_hold',
    role: 'mid', slot: 'mei1', attackPhase: 'progression', inBoxCount: 0,
    shouldAnchor: false, distToBall: 35, sq: null,
    expect: 'structural_hold',
  },
  {
    id: 'C2', desc: 'Defender, very far (45m), no anchor → structural_hold',
    role: 'def', slot: 'zag2', attackPhase: 'progression', inBoxCount: 0,
    shouldAnchor: false, distToBall: 45, sq: null,
    expect: 'structural_hold',
  },
  // === COLLECTIVE SQ (Phase 4) ===
  {
    id: 'D1', desc: 'sq usefulness low + create_width → sq_create_width',
    role: 'mid', slot: 'mei2', attackPhase: 'progression', inBoxCount: 0,
    shouldAnchor: false, distToBall: 18, sq: { usefulness: 0.2, suggestion: 'create_width' },
    expect: 'sq_create_width',
  },
  {
    id: 'D2', desc: 'sq usefulness low + attack_space → sq_attack_space',
    role: 'mid', slot: 'mei1', attackPhase: 'progression', inBoxCount: 0,
    shouldAnchor: false, distToBall: 22, sq: { usefulness: 0.25, suggestion: 'attack_space' },
    expect: 'sq_attack_space',
  },
  {
    id: 'D3', desc: 'sq usefulness low + recycle → sq_recycle',
    role: 'mid', slot: 'mei2', attackPhase: 'progression', inBoxCount: 0,
    shouldAnchor: false, distToBall: 25, sq: { usefulness: 0.18, suggestion: 'recycle' },
    expect: 'sq_recycle',
  },
  {
    id: 'D4', desc: 'sq usefulness low + offer_line → sq_offer_line',
    role: 'mid', slot: 'mei1', attackPhase: 'progression', inBoxCount: 0,
    shouldAnchor: false, distToBall: 12, sq: { usefulness: 0.3, suggestion: 'offer_line' },
    expect: 'sq_offer_line',
  },
  {
    id: 'D5', desc: 'sq usefulness OK (>0.35) → fallthrough (no sq trigger)',
    role: 'mid', slot: 'mei1', attackPhase: 'progression', inBoxCount: 0,
    shouldAnchor: false, distToBall: 18, sq: { usefulness: 0.7, suggestion: 'offer_line' },
    expect: 'FALLTHROUGH',
  },
  {
    id: 'D6', desc: 'sq suggestion=stay → fallthrough',
    role: 'mid', slot: 'mei1', attackPhase: 'progression', inBoxCount: 0,
    shouldAnchor: false, distToBall: 18, sq: { usefulness: 0.2, suggestion: 'stay' },
    expect: 'FALLTHROUGH',
  },
  // === FALLTHROUGH (no candidate fits) ===
  {
    id: 'E1', desc: 'Mid, mid-distance, no anchor, no SQ → fallthrough (role dispatch)',
    role: 'mid', slot: 'mei1', attackPhase: 'progression', inBoxCount: 0,
    shouldAnchor: false, distToBall: 18, sq: null,
    expect: 'FALLTHROUGH',
  },
  {
    id: 'E2', desc: 'Defender mid-distance no anchor → fallthrough',
    role: 'def', slot: 'zag1', attackPhase: 'progression', inBoxCount: 0,
    shouldAnchor: false, distToBall: 18, sq: null,
    expect: 'FALLTHROUGH',
  },
  // === EDGE CASES ===
  {
    id: 'F1', desc: 'Striker box_entry + sq_attack_space (competition)',
    role: 'attack', slot: 'ata1', attackPhase: 'box_entry', inBoxCount: 2,
    shouldAnchor: false, distToBall: 18,
    sq: { usefulness: 0.2, suggestion: 'attack_space' },
    expect: 'striker_infiltrate_box',
  },
  {
    id: 'F2', desc: 'Mid no box + far from ball + shouldAnchor (anchor wins)',
    role: 'mid', slot: 'vol', attackPhase: 'progression', inBoxCount: 0,
    shouldAnchor: true, distToBall: 35, sq: null,
    expect: 'anchor_to_slot',
  },
];

interface ScenarioResult {
  scenario: Scenario;
  actionId: AttackingActionId | null;
  fire: boolean;
  score: number;
  margin: number;
  expected: AttackingActionId | 'FALLTHROUGH';
  passed: boolean;
}

function fmt(n: number): string {
  return n.toFixed(2).padStart(5);
}

function runScenario(s: Scenario, previousActionId?: string | null): ScenarioResult {
  const inputs = buildAttackingInputs({
    role: s.role,
    slot: s.slot,
    attackPhase: s.attackPhase,
    inBoxCount: s.inBoxCount,
    shouldAnchor: s.shouldAnchor,
    distToBall: s.distToBall,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supportQuality: s.sq as any,
    // PR1: defaults neutros para calibração — cenários explícitos podem extender.
    selfX: 50,
    attackDir: 1,
    finalizacao: 60,
    velocidade: 60,
  });
  const verdict = selectAttackingAction({} as never, inputs, undefined, previousActionId);
  const expected = s.expect;
  const actualLabel = verdict.fire && verdict.actionId ? verdict.actionId : 'FALLTHROUGH';
  const passed = actualLabel === expected;
  return {
    scenario: s,
    actionId: verdict.actionId,
    fire: verdict.fire,
    score: verdict.score,
    margin: verdict.marginOverRunnerUp,
    expected,
    passed,
  };
}

function main(): void {
  const results = SCENARIOS.map((s) => runScenario(s));

  // === INERTIA BONUS REGRESSION TESTS ===
  // F1 era empate (1.00 vs 1.00) entre striker_infiltrate_box e sq_attack_space.
  // Com inertia bonus 0.05, o vencedor anterior deve manter dominância na
  // segunda passagem (anti-flickering).
  const f1 = SCENARIOS.find((s) => s.id === 'F1')!;
  const f1Tick2_strikerWasPrev = runScenario(f1, 'striker_infiltrate_box');
  const f1Tick2_sqWasPrev = runScenario(f1, 'sq_attack_space');
  console.log('\n=== INERTIA BONUS — F1 (tied 1.00/1.00) STRESS TEST ===');
  console.log(`Tick2 com previousAction=striker_infiltrate_box  → ${f1Tick2_strikerWasPrev.actionId} (margin=${f1Tick2_strikerWasPrev.margin.toFixed(3)})`);
  console.log(`Tick2 com previousAction=sq_attack_space         → ${f1Tick2_sqWasPrev.actionId} (margin=${f1Tick2_sqWasPrev.margin.toFixed(3)})`);
  const inertiaWorks =
    f1Tick2_strikerWasPrev.actionId === 'striker_infiltrate_box'
    && f1Tick2_sqWasPrev.actionId === 'sq_attack_space';
  console.log(`Inertia preserva ação anterior em empates: ${inertiaWorks ? '✓' : '✗'}`);


  console.log('\n=== ATTACKING SUPPORT — UTILITY AI CALIBRATION ===');
  console.log(`Threshold: ${ATTACKING_FIRE_THRESHOLD}  |  Cenários: ${SCENARIOS.length}\n`);

  console.log('ID  | Description                                              | Score | Margin | Expected                  | Got                       | OK');
  console.log('----|----------------------------------------------------------|-------|--------|---------------------------|---------------------------|----');
  for (const r of results) {
    const got = r.fire && r.actionId ? r.actionId : 'FALLTHROUGH';
    const ok = r.passed ? '✓' : '✗';
    console.log(
      `${r.scenario.id.padEnd(3)} | ${r.scenario.desc.padEnd(56)} | ${fmt(r.score)} | ${fmt(r.margin)} | ${r.expected.padEnd(25)} | ${got.padEnd(25)} | ${ok}`,
    );
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);
  const lowMargin = results.filter((r) => r.fire && r.margin < 0.05);

  console.log('\n=== STATS ===');
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Low-margin (< 0.05) entre top-1/top-2: ${lowMargin.length}`);

  if (failed.length > 0) {
    console.log('\n=== FAILURES ===');
    for (const r of failed) {
      console.log(`✗ ${r.scenario.id} — ${r.scenario.desc}`);
      console.log(`     Expected: ${r.expected}`);
      console.log(`     Got:      ${r.fire && r.actionId ? r.actionId : 'FALLTHROUGH'} (score=${r.score.toFixed(3)}, margin=${r.margin.toFixed(3)})`);
    }
  }

  if (lowMargin.length > 0) {
    console.log('\n=== LOW-MARGIN WARNINGS (ambiguidade — risco de flickering) ===');
    for (const r of lowMargin) {
      console.log(`⚠ ${r.scenario.id} — margin=${r.margin.toFixed(3)} between top-2`);
    }
  }

  console.log('\n=== ACTION DISTRIBUTION ===');
  const byAction: Record<string, number> = {};
  for (const r of results) {
    const k = r.fire && r.actionId ? r.actionId : 'FALLTHROUGH';
    byAction[k] = (byAction[k] ?? 0) + 1;
  }
  for (const [k, v] of Object.entries(byAction).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(30)} ${v}`);
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main();
