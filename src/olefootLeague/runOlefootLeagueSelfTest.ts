/**
 * Autochecagem da Liga OLEFOOT (ELO + moral). `npm run test:olefoot-league`
 */
import assert from 'node:assert/strict';
import { updateElo, scoreFromGoals } from './elo';
import { findOpponent, canMatchmake } from './matchmaking';
import { createDefaultEloRating, OLEFOOT_LEAGUE_CONSTANTS } from './types';
import {
  applyMatchResultToMoral,
  createDefaultMoral,
  decayMomentum,
} from '../systems/playerMoral/types';

// --- ELO score helper -----------------------------------------------------
assert.equal(scoreFromGoals(2, 1), 1, 'home win → 1');
assert.equal(scoreFromGoals(1, 2), 0, 'home loss → 0');
assert.equal(scoreFromGoals(1, 1), 0.5, 'draw → 0.5');

// --- ELO update simétrico em ratings iguais -------------------------------
const symmetric = updateElo(1200, 1200, 1);
assert.equal(symmetric.deltaHome, OLEFOOT_LEAGUE_CONSTANTS.ELO_K_FACTOR / 2, 'home gains K/2 vs equal');
assert.equal(symmetric.deltaAway, -OLEFOOT_LEAGUE_CONSTANTS.ELO_K_FACTOR / 2, 'away loses K/2');
assert.equal(symmetric.newHome - 1200, symmetric.deltaHome, 'newHome consistent');

// Empate em ratings iguais → delta zero
const draw = updateElo(1200, 1200, 0.5);
assert.equal(draw.deltaHome, 0, 'equal ratings draw delta = 0');
assert.equal(draw.deltaAway, 0, 'equal ratings draw delta = 0');

// Underdog vence top-rating → ganha mais que K/2
const upset = updateElo(1100, 1500, 1);
assert.ok(upset.deltaHome > OLEFOOT_LEAGUE_CONSTANTS.ELO_K_FACTOR / 2, 'upset home wins more than K/2');
assert.ok(upset.deltaAway < -OLEFOOT_LEAGUE_CONSTANTS.ELO_K_FACTOR / 2, 'upset away loses more than K/2');

// --- Matchmaking -----------------------------------------------------------
const candidates = [
  createDefaultEloRating('a'),  // 1200
  { ...createDefaultEloRating('b'), rating: 1250 },
  { ...createDefaultEloRating('c'), rating: 1500 },  // fora da banda 150
];
const found = findOpponent('me', 1200, candidates);
assert.ok(found, 'should find someone');
assert.equal(found!.managerId, 'a', 'closest rating wins');

const noneInBand = findOpponent('me', 1000, [{ ...createDefaultEloRating('z'), rating: 1500 }]);
assert.equal(noneInBand, null, 'returns null when no one in band');

assert.equal(canMatchmake(false), true, 'can match when LEGACY unlocked');
assert.equal(canMatchmake(true), false, 'cannot match when LEGACY locked');

// --- Moral helpers ---------------------------------------------------------
const fresh = createDefaultMoral('p1', 0);
assert.equal(fresh.moral, 50, 'initial moral 50');
assert.equal(fresh.momentum, 0, 'initial momentum 0');
assert.equal(fresh.streak, 0, 'initial streak 0');

const won = applyMatchResultToMoral(fresh, 'win', 1);
assert.ok(won.moral > fresh.moral, 'moral up after win');
assert.ok(won.momentum > 0, 'momentum positive after win');
assert.ok(won.streak >= 1, 'streak counted');

const lost = applyMatchResultToMoral(fresh, 'loss', 1);
assert.ok(lost.moral < fresh.moral, 'moral down after loss');
assert.ok(lost.momentum < 0, 'momentum negative after loss');

// Decay traz momentum em direção a 0
const decayed = decayMomentum({ ...fresh, momentum: 8 });
assert.ok(Math.abs(decayed.momentum) < 8, 'momentum decays toward 0');

const decayedNeg = decayMomentum({ ...fresh, momentum: -8 });
assert.ok(decayedNeg.momentum > -8, 'negative momentum decays toward 0');

// Moral é sempre clampado em [0, 100]
const overflow = applyMatchResultToMoral({ ...fresh, moral: 99 }, 'win', 5);
assert.ok(overflow.moral <= 100, 'moral clamped at 100');

const underflow = applyMatchResultToMoral({ ...fresh, moral: 1 }, 'loss', 5);
assert.ok(underflow.moral >= 0, 'moral clamped at 0');

console.log('✓ olefoot-league self-test ok');
