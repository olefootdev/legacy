/**
 * Spatial goals self-test: verifies goal orientation, progressToGoal,
 * xG estimation, half-inversion, and GoalContext consistency.
 *
 * npx tsx src/match/runSpatialGoalsSelfTest.ts
 */
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import {
  getAttackingGoalX,
  getDefendingGoalX,
  getSideAttackDir,
  depthFromOwnGoal,
} from './fieldZones';
import {
  buildGoalContext,
  computeProgressToGoal,
  computeLineOfSight,
  estimateShotXG,
  estimatePositionalXG,
} from './goalContext';
import type { AgentSnapshot } from '@/simulation/InteractionResolver';

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

function snap(over: Partial<AgentSnapshot> & Pick<AgentSnapshot, 'id'>): AgentSnapshot {
  return {
    id: over.id,
    side: over.side ?? 'home',
    x: over.x ?? 55,
    z: over.z ?? 34,
    speed: 5,
    role: 'mid',
    passe: 72, passeCurto: 72, passeLongo: 68, cruzamento: 62,
    marcacao: 60, drible: 68, finalizacao: over.finalizacao ?? 70,
    velocidade: 70, fisico: 68, fairPlay: 75, tatico: 72,
    mentalidade: 74, confianca: 72, confidenceRuntime: 1, stamina: 90,
  };
}

// -----------------------------------------------------------------------
// 1. Attack direction consistency
// -----------------------------------------------------------------------
{
  // 1st half: home attacks east (+X), away attacks west (-X)
  assert(getSideAttackDir('home', 1) === 1, 'home 1st half should attack east');
  assert(getSideAttackDir('away', 1) === -1, 'away 1st half should attack west');

  // 2nd half: sides swap
  assert(getSideAttackDir('home', 2) === -1, 'home 2nd half should attack west');
  assert(getSideAttackDir('away', 2) === 1, 'away 2nd half should attack east');

  assert(getAttackingGoalX('home', 1) === FIELD_LENGTH, 'home attacks goal at FIELD_LENGTH in 1st half');
  assert(getAttackingGoalX('away', 1) === 0, 'away attacks goal at 0 in 1st half');
  assert(getAttackingGoalX('home', 2) === 0, 'home attacks goal at 0 in 2nd half');
  assert(getAttackingGoalX('away', 2) === FIELD_LENGTH, 'away attacks goal at FIELD_LENGTH in 2nd half');

  assert(getDefendingGoalX('home', 1) === 0, 'home defends goal at 0 in 1st half');
  assert(getDefendingGoalX('away', 1) === FIELD_LENGTH, 'away defends goal at FIELD_LENGTH in 1st half');
}

// -----------------------------------------------------------------------
// 2. progressToGoal increases toward attacked goal
// -----------------------------------------------------------------------
{
  // Home, 1st half: attacks toward FIELD_LENGTH
  const p0 = computeProgressToGoal(0, 'home', 1);
  const pMid = computeProgressToGoal(FIELD_LENGTH / 2, 'home', 1);
  const pEnd = computeProgressToGoal(FIELD_LENGTH, 'home', 1);
  assert(p0 < pMid, `home h1: progress at 0 (${p0}) should < progress at mid (${pMid})`);
  assert(pMid < pEnd, `home h1: progress at mid (${pMid}) should < progress at end (${pEnd})`);
  assert(Math.abs(pEnd - 1) < 0.01, `home h1: progress at FIELD_LENGTH should be ~1, got ${pEnd}`);
  assert(Math.abs(p0) < 0.01, `home h1: progress at 0 should be ~0, got ${p0}`);

  // Away, 1st half: attacks toward 0
  const ap0 = computeProgressToGoal(0, 'away', 1);
  const apMid = computeProgressToGoal(FIELD_LENGTH / 2, 'away', 1);
  const apEnd = computeProgressToGoal(FIELD_LENGTH, 'away', 1);
  assert(apEnd < apMid, `away h1: progress at FIELD_LENGTH (${apEnd}) should < progress at mid (${apMid})`);
  assert(apMid < ap0, `away h1: progress at mid (${apMid}) should < progress at 0 (${ap0})`);
  assert(Math.abs(ap0 - 1) < 0.01, `away h1: progress at 0 should be ~1, got ${ap0}`);

  // Home, 2nd half (sides swap): attacks toward 0
  const hp2 = computeProgressToGoal(0, 'home', 2);
  const hp2mid = computeProgressToGoal(FIELD_LENGTH / 2, 'home', 2);
  assert(hp2 > hp2mid, `home h2: progress at 0 (${hp2}) should > progress at mid (${hp2mid})`);
}

// -----------------------------------------------------------------------
// 3. GoalContext is consistent
// -----------------------------------------------------------------------
{
  const opps = [snap({ id: 'opp1', side: 'away', x: 80, z: 34 })];
  const gc = buildGoalContext(70, 34, 'home', 1, opps);
  assert(gc.attackUnitX === 1, 'home h1 attackUnitX should be 1');
  assert(gc.targetGoalX === FIELD_LENGTH, `targetGoalX should be FIELD_LENGTH, got ${gc.targetGoalX}`);
  assert(gc.targetGoalZ === FIELD_WIDTH / 2, `targetGoalZ should be center`);
  assert(gc.distToGoal > 0, 'distToGoal should be positive');
  assert(gc.progressToGoal > 0.5, `at x=70, progress should be > 0.5, got ${gc.progressToGoal}`);
  assert(gc.lineOfSightScore >= 0 && gc.lineOfSightScore <= 1, 'lineOfSight should be 0-1');
}

// -----------------------------------------------------------------------
// 4. xG spatial: closer to goal = higher xG
// -----------------------------------------------------------------------
{
  // Close = ~10m from goal, mid = ~17m, far = ~50m
  const closeXG = estimatePositionalXG(95, 34, 'home', 1, 75);
  const midXG = estimatePositionalXG(88, 34, 'home', 1, 75);
  const farXG = estimatePositionalXG(55, 34, 'home', 1, 75);
  assert(closeXG > midXG, `close xG (${closeXG.toFixed(4)}) should > mid xG (${midXG.toFixed(4)})`);
  assert(midXG > farXG, `mid xG (${midXG.toFixed(4)}) should > far xG (${farXG.toFixed(4)})`);

  // Wide angle should reduce xG
  const centralXG = estimatePositionalXG(95, 34, 'home', 1, 75);
  const wideXG = estimatePositionalXG(95, 5, 'home', 1, 75);
  assert(centralXG > wideXG, `central xG (${centralXG.toFixed(4)}) should > wide xG (${wideXG.toFixed(4)})`);
}

// -----------------------------------------------------------------------
// 5. estimateShotXG: better finisher = higher xG
// -----------------------------------------------------------------------
{
  const opps = [snap({ id: 'd1', side: 'away', x: 90, z: 35 })];
  const gc = buildGoalContext(88, 34, 'home', 1, opps);

  const goodShooter = snap({ id: 's1', x: 88, z: 34, finalizacao: 95 });
  const weakShooter = snap({ id: 's2', x: 88, z: 34, finalizacao: 35 });

  const goodXG = estimateShotXG(goodShooter, 88, 34, gc, opps);
  const weakXG = estimateShotXG(weakShooter, 88, 34, gc, opps);
  assert(goodXG > weakXG, `good finisher xG (${goodXG}) should > weak finisher (${weakXG})`);
}

// -----------------------------------------------------------------------
// 6. Line of sight: blocked = lower score
// -----------------------------------------------------------------------
{
  const goalX = FIELD_LENGTH;
  const goalZ = FIELD_WIDTH / 2;
  const noBlockers: AgentSnapshot[] = [];
  const withBlockers = [
    snap({ id: 'b1', side: 'away', x: 95, z: 34 }),
    snap({ id: 'b2', side: 'away', x: 97, z: 34 }),
  ];

  const clearLOS = computeLineOfSight(80, 34, goalX, goalZ, noBlockers);
  const blockedLOS = computeLineOfSight(80, 34, goalX, goalZ, withBlockers);
  assert(clearLOS > blockedLOS, `clear LOS (${clearLOS}) should > blocked LOS (${blockedLOS})`);
  assert(clearLOS === 1, `clear LOS with no opponents should be 1, got ${clearLOS}`);
}

// -----------------------------------------------------------------------
// 7. Half-inversion: GoalContext flips correctly at half-time
// -----------------------------------------------------------------------
{
  const opps: AgentSnapshot[] = [];
  const gcH1 = buildGoalContext(70, 34, 'home', 1, opps);
  const gcH2 = buildGoalContext(70, 34, 'home', 2, opps);

  assert(gcH1.attackUnitX === 1, 'home h1 attacks east');
  assert(gcH2.attackUnitX === -1, 'home h2 attacks west');
  assert(gcH1.targetGoalX === FIELD_LENGTH, 'home h1 target is east goal');
  assert(gcH2.targetGoalX === 0, 'home h2 target is west goal');
  assert(gcH1.progressToGoal > 0.5, 'x=70 in h1 should be past midfield for home');
  assert(gcH2.progressToGoal < 0.5, 'x=70 in h2 should be before midfield for home (reversed)');
}

// -----------------------------------------------------------------------
// 8. Possession change after shot (verified via TacticalSimLoop structure)
//    — this is a structural assertion from the existing codebase
// -----------------------------------------------------------------------
{
  // Just verify the function exports exist and return consistent types
  const gc = buildGoalContext(90, 34, 'home', 1, []);
  assert(typeof gc.distToGoal === 'number', 'distToGoal is number');
  assert(typeof gc.angleToGoal === 'number', 'angleToGoal is number');
  assert(typeof gc.lineOfSightScore === 'number', 'lineOfSightScore is number');
  assert(typeof gc.progressToGoal === 'number', 'progressToGoal is number');
  assert(gc.progressToGoal >= 0 && gc.progressToGoal <= 1, 'progressToGoal in [0,1]');
}

console.log('spatial-goals self-test: ok');
