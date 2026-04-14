/**
 * Zonas IFAB + inversão de tempo.
 * npx tsx src/match/runFieldZonesSelfTest.ts
 */
import {
  defendingTeamAtGoalEnd,
  getAttackingGoalX,
  getDefendingGoalX,
  getSideAttackDir,
  getThird,
  goalAreaEndContainingBall,
  isInsideGoalAreaAtEnd,
  penaltyAreaEndContainingBall,
  isInsideOwnPenaltyArea,
  depthFromOwnGoal,
  type PitchPosition,
} from './fieldZones';

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

function main() {
  assert(getDefendingGoalX('home', 1) === 0, 'home h1 defends 0');
  assert(getAttackingGoalX('home', 1) === 105, 'home h1 attacks 105');
  assert(getSideAttackDir('home', 1) === 1, 'home h1 attackDir +1');

  assert(getDefendingGoalX('home', 2) === 105, 'home h2 defends 105');
  assert(getSideAttackDir('home', 2) === -1, 'home h2 attackDir -1');

  assert(getDefendingGoalX('away', 1) === 105, 'away h1 defends east');
  assert(getSideAttackDir('away', 1) === -1, 'away h1 attacks west');

  const nearHomeGoalH1: PitchPosition = { x: 4, z: 34 };
  assert(isInsideOwnPenaltyArea(nearHomeGoalH1, { team: 'home', half: 1 }), 'home own PA h1');
  assert(!isInsideOwnPenaltyArea(nearHomeGoalH1, { team: 'home', half: 2 }), 'same coords not home PA in h2');

  const nearHomeGoalH2: PitchPosition = { x: 101, z: 34 };
  assert(isInsideOwnPenaltyArea(nearHomeGoalH2, { team: 'home', half: 2 }), 'home own PA h2');

  const mid: PitchPosition = { x: 52, z: 34 };
  assert(getThird(mid, { team: 'home', half: 1 }) === 'middle', 'midfield third h1');
  assert(depthFromOwnGoal(mid.x, 'home', 1) > 30, 'depth from own goal h1');

  const inWestGa: PitchPosition = { x: 3, z: 34 };
  assert(isInsideGoalAreaAtEnd(inWestGa, 'west'), 'west goal area');
  assert(!isInsideGoalAreaAtEnd(inWestGa, 'east'), 'not east ga');
  assert(goalAreaEndContainingBall(3, 34) === 'west', 'ball end west ga');
  assert(defendingTeamAtGoalEnd('west', 1) === 'home', 'home defends west h1');

  assert(penaltyAreaEndContainingBall(10, 34) === 'west', 'ball in west PA');
  assert(penaltyAreaEndContainingBall(99, 34) === 'east', 'ball in east PA');

  console.log('fieldZones self-test: ok');
}

main();
