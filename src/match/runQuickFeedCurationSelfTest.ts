/**
 * Autochecagem da curadoria do feed da Partida Rápida (sem Vitest).
 * `npm run test:quick-feed` — quick-match-revolution.md §12 P3.
 */
import assert from 'node:assert/strict';
import type { MatchEventEntry } from '@/engine/types';
import { curateQuickFeedPool, quickFeedImportance } from './quickMatchFeed';

function ev(kind: MatchEventEntry['kind'], text: string, i: number): MatchEventEntry {
  return { id: `e${i}`, minute: i, text, kind } as MatchEventEntry;
}

// ── Importância por tipo ─────────────────────────────────────────────────────
assert.equal(quickFeedImportance({ kind: 'goal_home', text: '' }), 3);
assert.equal(quickFeedImportance({ kind: 'red_away', text: '' }), 3);
assert.equal(quickFeedImportance({ kind: 'penalty_result', text: '' }), 3);
assert.equal(quickFeedImportance({ kind: 'yellow_home', text: '' }), 2);
assert.equal(quickFeedImportance({ kind: 'sub', text: '' }), 2);
assert.equal(quickFeedImportance({ kind: 'whistle', text: '' }), 2);
// Narrativa com lance de verdade vale 1; filler ambiente vale 0.
assert.equal(quickFeedImportance({ kind: 'narrative', text: "12' — Chute perigoso de Maestro!" }), 1);
assert.equal(quickFeedImportance({ kind: 'narrative', text: "33' — Defesaça do goleiro" }), 1);
assert.equal(quickFeedImportance({ kind: 'narrative', text: "14' — Time troca passes no meio-campo." }), 0);

// ── Pool pequeno: passa intacto ──────────────────────────────────────────────
const few = [ev('narrative', 'troca passes', 1), ev('goal_home', 'Gol!', 2)];
assert.deepEqual(curateQuickFeedPool(few, 14), few);

// ── Pool cheio: eventos-chave NUNCA caem; filler cede lugar ─────────────────
const noise = Array.from({ length: 20 }, (_, i) => ev('narrative', 'posse de bola tranquila no meio', i));
const key1 = ev('goal_away', 'Gol deles', 90);
const key2 = ev('red_home', 'Expulsão!', 91);
const key3 = ev('narrative', "70' — Na trave! Quase gol", 92);
// Mais recentes primeiro (como live.events): chave no meio do ruído.
const crowded = [...noise.slice(0, 5), key1, ...noise.slice(5, 12), key2, key3, ...noise.slice(12)];
const curated = curateQuickFeedPool(crowded, 8);

assert.equal(curated.length, 8, 'pool respeita o máximo');
assert.ok(curated.includes(key1), 'gol visitante mantido');
assert.ok(curated.includes(key2), 'vermelho mantido');
assert.ok(curated.includes(key3), 'narrativa com lance mantida');
const fillerCount = curated.filter((e) => quickFeedImportance(e) === 0).length;
assert.ok(fillerCount <= 5, `filler limitado às vagas que sobram (${fillerCount})`);

// ── Só filler: feed nunca fica vazio ─────────────────────────────────────────
const onlyNoise = curateQuickFeedPool(noise, 6);
assert.equal(onlyNoise.length, 6, 'feed cheio mesmo só com filler');

// ── Ordem cronológica preservada (mais recente primeiro) ────────────────────
const idx = (e: MatchEventEntry) => crowded.indexOf(e);
for (let i = 1; i < curated.length; i++) {
  assert.ok(idx(curated[i]!) > idx(curated[i - 1]!), 'ordem do feed preservada');
}

// ── Anti-reciclagem: lance-chave velho sai do pool quando nowMinute avança ──
const oldGoal = ev('goal_home', 'Gol antigo', 10);            // minuto 10
const freshNoise = Array.from({ length: 20 }, (_, i) => ev('narrative', 'posse tranquila no meio', 40 + i));
const midGame = [...freshNoise.slice(0, 10), oldGoal, ...freshNoise.slice(10)];
const at64 = curateQuickFeedPool(midGame, 8, 64);
assert.ok(!at64.includes(oldGoal), 'gol do 1º tempo NÃO recicla aos 64\'');
const at25 = curateQuickFeedPool(midGame, 8, 25);
assert.ok(at25.includes(oldGoal), 'gol recente (15 min atrás) ainda aparece');

console.log('quick feed curation self-test OK');
