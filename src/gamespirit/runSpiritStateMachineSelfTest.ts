/**
 * Autochecagem da máquina de estado GameSpirit. `npm run test:spirit-machine`
 */
import assert from 'node:assert/strict';
import {
  advancePenaltyStage,
  createGoalOverlay,
  patchAfterHomeShot,
  rollPenaltyOutcome,
} from '@/gamespirit/spiritStateMachine';
import { gameSpiritTick, buildSpiritContext } from '@/gamespirit/GameSpirit';
import { crowdSpiritFromSupport } from '@/systems/crowdSpirit';

// Remate para fora: posse visitante, buildup desde GR
{
  const p = patchAfterHomeShot('wide', 0.4);
  assert.equal(p.possession, 'away');
  assert.ok(p.ball.x > 80);
  assert.equal(p.spiritPhase, 'buildup_gk');
  assert.ok(p.spiritBuildupGkTicksRemaining >= 1);
}

// Golo: overlay 3s + barra no extremo do marcador durante flash
{
  const { overlay, spiritMomentumClamp01 } = createGoalOverlay({
    nowMs: 1_700_000,
    narrativeLine: "GOL!",
    scorerSide: 'home',
  });
  assert.equal(overlay.autoDismissMs, 6000);
  assert.equal(overlay.kind, 'goal');
  assert.equal(spiritMomentumClamp01, 0.98);
}

// Penálti: estágios avançam banner → walk → kick; kick não avança sem resolve
{
  let s = advancePenaltyStage({ stage: 'banner', side: 'home', takerName: 'X' });
  assert.equal(s.stage, 'walk');
  s = advancePenaltyStage(s);
  assert.equal(s.stage, 'kick');
  const same = advancePenaltyStage(s);
  assert.equal(same.stage, 'kick');
}

// Desfecho de penálti reprodutível com rng
{
  assert.equal(rollPenaltyOutcome(0.01), 'goal');
  assert.equal(rollPenaltyOutcome(0.55), 'save');
}

// gameSpiritTick: golo sempre devolve goalBuildUp + threatBar01
{
  const mkPlayers = () => [
    { playerId: 'tst-1', name: 'Striker', x: 84, y: 50, num: 9, pos: 'ATA', slotId: 'cf', role: 'attack' as const, fatigue: 30 },
    { playerId: 'tst-2', name: 'Wing',    x: 78, y: 38, num: 7, pos: 'PE',  slotId: 'lw', role: 'attack' as const, fatigue: 30 },
    { playerId: 'tst-3', name: 'Mid',     x: 72, y: 52, num: 8, pos: 'MC',  slotId: 'cm', role: 'mid'    as const, fatigue: 30 },
  ];
  let foundGoal = false;
  for (let attempt = 0; attempt < 3000 && !foundGoal; attempt++) {
    const players = mkPlayers();
    const ctx = buildSpiritContext({
      minute: 55,
      homeScore: 0,
      awayScore: 0,
      possession: 'home',
      ball: { x: 84, y: 50 },
      onBall: players[0],
      crowdSupport: 0.7,
      tacticalMentality: 70,
      opponentStrength: 60,
      homeRoster: [],
      homePlayers: players,
      homeShort: 'TST',
    });
    const out = gameSpiritTick(ctx, 'OPP', 1, Date.now());
    if (out.goalFor === 'home') {
      foundGoal = true;
      assert.ok(out.goalBuildUp === 'positional' || out.goalBuildUp === 'counter',
        `goalBuildUp should be defined on goal, got: ${out.goalBuildUp}`);
      assert.ok(typeof out.threatBar01 === 'number', 'threatBar01 must be a number on goal');
      assert.equal(out.threatBar01, 0.98, 'home goal threatBar01 at extreme');
      assert.ok(/GOL/i.test(out.narrative), 'narrative should mention GOL');
    }
    if (out.goalFor === 'away') {
      foundGoal = true;
      assert.ok(out.goalBuildUp === 'positional' || out.goalBuildUp === 'counter');
      assert.ok(typeof out.threatBar01 === 'number');
      assert.equal(out.threatBar01, 0.02, 'away goal threatBar01 at extreme');
    }
  }
  assert.ok(foundGoal, 'should have seen at least one goal in 3000 attempts');
}

// gameSpiritTick: sem golo → goalBuildUp/threatBar01 devem ser undefined
{
  let foundNonGoal = false;
  for (let attempt = 0; attempt < 50 && !foundNonGoal; attempt++) {
    const ctx = buildSpiritContext({
      minute: 30,
      homeScore: 0,
      awayScore: 0,
      possession: 'home',
      ball: { x: 50, y: 50 },
      onBall: {
        playerId: 'tst-2',
        name: 'Mid',
        x: 50,
        y: 50,
        num: 8,
        pos: 'MC',
        slotId: 'cm',
        role: 'mid',
        fatigue: 30,
      },
      crowdSupport: 0.5,
      tacticalMentality: 55,
      opponentStrength: 80,
      homeRoster: [],
      homePlayers: [
        {
          playerId: 'tst-2',
          name: 'Mid',
          x: 50,
          y: 50,
          num: 8,
          pos: 'MC',
          slotId: 'cm',
          role: 'mid',
          fatigue: 30,
        },
      ],
      homeShort: 'TST',
    });
    const out = gameSpiritTick(ctx, 'OPP', 1, Date.now());
    if (!out.goalFor) {
      foundNonGoal = true;
      assert.equal(out.goalBuildUp, undefined, 'no goal → no goalBuildUp');
      assert.equal(out.threatBar01, undefined, 'no goal → no threatBar01');
    }
  }
  assert.ok(foundNonGoal, 'should see at least one non-goal tick in 50 attempts');
}

console.log('spirit state machine self-test OK');
