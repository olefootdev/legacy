/**
 * Smoke tests for structural reorganisation (run: npx tsx src/simulation/runStructuralSelfTest.ts).
 */
import { enforceMinDistFromBall, buildSetPieceTeamMaps, applyFormationPreset } from '@/formation/presets';
import { MIN_DIST_GOAL_KICK_M } from '@/simulation/StructuralEvent';
import { applyTransitionCompactionToSlots } from '@/simulation/transitionCompaction';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  const ballX = 4;
  const ballZ = 34;
  const preset = applyFormationPreset('goal_kick', ballX, ballZ);
  const away = preset.get('pe');
  assert(!!away, 'preset has pe');
  const pushed = enforceMinDistFromBall(preset, ballX, ballZ, MIN_DIST_GOAL_KICK_M);
  const pe2 = pushed.get('pe')!;
  assert(Math.hypot(pe2.x - ballX, pe2.z - ballZ) >= MIN_DIST_GOAL_KICK_M - 0.5, 'min dist goal kick');

  const { home, away: awayMap } = buildSetPieceTeamMaps('goal_kick', ballX, ballZ, 'home', preset);
  assert(home.size > 0 && awayMap.size > 0, 'team maps');

  const slots = new Map<string, { x: number; z: number }>([['mc1', { x: 55, z: 34 }]]);
  applyTransitionCompactionToSlots(slots, 'home', 1);
  assert(slots.get('mc1')!.x < 55, 'compaction pulls toward own goal for home');

  console.log('structural self-test: ok');
}

main();
