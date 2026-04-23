/**
 * Smoke tests for structural reorganisation (run: npx tsx src/simulation/runStructuralSelfTest.ts).
 */
import { enforceMinDistFromBall, buildSetPieceTeamMaps, applyFormationPreset } from '@/formation/presets';
import {
  MIN_DIST_CORNER_THROW_M,
  MIN_DIST_GOAL_KICK_M,
  MIN_DIST_NUMERIC_EPS_M,
} from '@/simulation/StructuralEvent';
import { applyTransitionCompactionToSlots } from '@/simulation/transitionCompaction';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function minRadialDistFromBall(
  map: Map<string, { x: number; z: number }>,
  ballX: number,
  ballZ: number,
): number {
  let m = Infinity;
  for (const p of map.values()) {
    m = Math.min(m, Math.hypot(p.x - ballX, p.z - ballZ));
  }
  return m;
}

function main() {
  const ballX = 4;
  const ballZ = 34;
  const preset = applyFormationPreset('goal_kick', ballX, ballZ);
  const away = preset.get('pe');
  assert(!!away, 'preset has pe');
  const pushed = enforceMinDistFromBall(preset, ballX, ballZ, MIN_DIST_GOAL_KICK_M);
  const pe2 = pushed.get('pe')!;
  assert(
    Math.hypot(pe2.x - ballX, pe2.z - ballZ) >= MIN_DIST_GOAL_KICK_M - MIN_DIST_NUMERIC_EPS_M,
    'min dist goal kick',
  );

  const { home, away: awayMap } = buildSetPieceTeamMaps('goal_kick', ballX, ballZ, 'home', preset);
  assert(home.size > 0 && awayMap.size > 0, 'team maps');

  const bx = 8;
  const bz = 40;
  const throwPreset = applyFormationPreset('throw_in', bx, bz);
  const throwMaps = buildSetPieceTeamMaps('throw_in', bx, bz, 'home', throwPreset);
  assert(
    minRadialDistFromBall(throwMaps.away, bx, bz) >= MIN_DIST_CORNER_THROW_M - MIN_DIST_NUMERIC_EPS_M,
    'min dist throw-in opponents',
  );

  const cornerPreset = applyFormationPreset('corner_kick', 100, 2);
  const cornerMaps = buildSetPieceTeamMaps('corner_kick', 100, 2, 'home', cornerPreset);
  assert(
    minRadialDistFromBall(cornerMaps.away, 100, 2) >= MIN_DIST_CORNER_THROW_M - MIN_DIST_NUMERIC_EPS_M,
    'min dist corner opponents',
  );

  const slots = new Map<string, { x: number; z: number }>([['mc1', { x: 55, z: 34 }]]);
  applyTransitionCompactionToSlots(slots, 'home', 1);
  assert(slots.get('mc1')!.x < 55, 'compaction pulls toward own goal for home');

  console.log('structural self-test: ok');
}

main();
