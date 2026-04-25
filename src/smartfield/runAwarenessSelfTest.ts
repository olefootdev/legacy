/**
 * Autochecagem do SmartField (`npm run test:awareness`).
 *
 * Valida que `getBestAction` + `getAwarenessContext` produzem decisões
 * coerentes com a hierarquia de zonas:
 *
 *   1. Goleiro do gol (goalmouth) com bola → SHOOT confidence ≥ 0.95
 *   2. Recovery zone sem bola → RECOVER_POSITION
 *   3. Halfspace ataque, pressure < 0.3, com bola → SHOOT shootBias > 0
 *   4. Wing ataque com colega na box → CROSS pra ele
 */

import assert from 'node:assert/strict';
import type { PitchPlayerState } from '@/engine/types';
import { getAwarenessContext, type AwarePlayer } from '@/smartfield/awareness';
import { getBestAction } from '@/smartfield/decision';
import { isBox } from '@/match/spatialZones';

function makePlayer(
  overrides: Partial<PitchPlayerState> & { team: 'home' | 'away' },
): AwarePlayer {
  return {
    playerId: overrides.playerId ?? `p_${Math.random().toString(36).slice(2, 8)}`,
    slotId: overrides.slotId ?? 'mc1',
    name: overrides.name ?? 'Test Player',
    num: overrides.num ?? 10,
    pos: overrides.pos ?? 'MC',
    x: overrides.x ?? 50,
    y: overrides.y ?? 50,
    heading: overrides.heading ?? 0,
    fatigue: overrides.fatigue ?? 30,
    role: overrides.role ?? 'mid',
    team: overrides.team,
  };
}

let passed = 0;
const total = 4;

// ── 1. Boca do gol → SHOOT 0.95 ───────────────────────────────────
{
  // goalmouth_center fica em x≈98, y≈50 em UI (linha de fundo do adversário)
  const carrier = makePlayer({ team: 'home', x: 98.5, y: 50, role: 'attack', pos: 'ATA' });
  const decision = getBestAction(carrier, [carrier], 'home', { hasBall: true, isFreeKick: false });
  assert.equal(decision.action, 'SHOOT', `goalmouth → expected SHOOT, got ${decision.action}`);
  assert.ok(
    decision.confidence >= 0.95,
    `goalmouth → expected confidence ≥ 0.95, got ${decision.confidence}`,
  );
  console.log('✓ T1 goalmouth_center → SHOOT', decision.confidence);
  passed++;
}

// ── 2. Recovery zone sem bola → RECOVER_POSITION ──────────────────
{
  // recovery_center está nos arredores do meio defensivo, x ~25–35, y ~40–60
  const player = makePlayer({ team: 'home', x: 28, y: 50, role: 'def', pos: 'ZAG' });
  const decision = getBestAction(player, [player], 'home', { hasBall: false, isFreeKick: false });
  // Tolerância: alguns pontos podem cair em build_up; o critério mais robusto
  // é não ter posse → é PRESS ou RECOVER_POSITION; aqui pedimos recovery.
  assert.equal(
    decision.action,
    'RECOVER_POSITION',
    `recovery → expected RECOVER_POSITION, got ${decision.action} (zone=${decision.reason})`,
  );
  console.log('✓ T2 recovery_center sem bola → RECOVER_POSITION');
  passed++;
}

// ── 3. Halfspace ataque + pressure baixo + posse → SHOOT bias > 0 ─
{
  // attacking_left_halfspace: x ~85–95, y ~22–40
  const carrier = makePlayer({
    team: 'home',
    x: 88,
    y: 32,
    role: 'attack',
    pos: 'PE',
    fatigue: 30,
  });
  // sem adversários no cone focal → pressureLevel = 0
  const decision = getBestAction(carrier, [carrier], 'home', { hasBall: true, isFreeKick: false });
  assert.equal(
    decision.action,
    'SHOOT',
    `halfspace ataque → expected SHOOT, got ${decision.action}`,
  );
  // confidence base 0.6 + bias.halfspace 0.3 = 0.9
  assert.ok(
    decision.confidence > 0.6,
    `halfspace → confidence > 0.6, got ${decision.confidence}`,
  );
  console.log('✓ T3 attacking_halfspace livre → SHOOT', decision.confidence);
  passed++;
}

// ── 4. Wing ataque + colega na box → CROSS ────────────────────────
{
  // Carrier no corredor lateral esquerdo do terço atacante; striker em box_left
  // perto o bastante (peripheral 30u UI) pra ser visto. heading=0 (face +x → gol).
  const carrier = makePlayer({
    team: 'home',
    playerId: 'wing',
    x: 90,
    y: 10,
    role: 'attack',
    pos: 'PE',
    heading: 0,
  });
  const teammate = makePlayer({
    team: 'home',
    playerId: 'striker',
    x: 95,
    y: 35,
    role: 'attack',
    pos: 'ATA',
  });
  const aw = getAwarenessContext(carrier, [carrier, teammate], 'home');
  const teammateInBox = aw.availableTeammates.find((t) => isBox(t.zone));
  assert.ok(
    teammateInBox,
    `awareness deveria ver teammate na box; got ${aw.availableTeammates.length} teammates`,
  );
  const decision = getBestAction(carrier, [carrier, teammate], 'home', {
    hasBall: true,
    isFreeKick: false,
  });
  assert.equal(
    decision.action,
    'CROSS',
    `wing+target_in_box → expected CROSS, got ${decision.action}`,
  );
  assert.equal(decision.target?.playerId, 'striker', 'wing CROSS target deveria ser striker');
  console.log('✓ T4 attacking_wing + teammate_in_box → CROSS');
  passed++;
}

console.log(`\nSmartField awareness self-test: ${passed}/${total} passed`);
if (passed !== total) {
  process.exit(1);
}
