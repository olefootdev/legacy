/**
 * Autochecagem do log causal (sem Vitest). `npm run test:causal`
 */
import assert from 'node:assert/strict';
import { scoreDeltaFromEvents, validateGoalChain, createCausalBatch } from './matchCausalTypes';

const B = createCausalBatch(12, 1);
B.push({
  type: 'shot_attempt',
  payload: {
    side: 'home',
    shooterId: 'p1',
    zone: 'att',
    minute: 12,
    target: { x: 98, y: 50 },
  },
});
B.push({
  type: 'shot_result',
  payload: { side: 'home', shooterId: 'p1', outcome: 'goal' },
});
const validGoal = B.events;
assert.equal(validateGoalChain(validGoal), true);
assert.deepEqual(scoreDeltaFromEvents(validGoal), { home: 1, away: 0 });

const bad: typeof validGoal = [
  {
    seq: 1,
    simTime: 12,
    type: 'shot_result',
    payload: { side: 'home', shooterId: 'p1', outcome: 'goal' },
  },
];
assert.equal(validateGoalChain(bad), false);

console.log('match causal self-test OK');
