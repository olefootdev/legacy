/**
 * Autochecagem do ledger de impacto (sem Vitest). `npm run test:impact-ledger`
 */
import assert from 'node:assert/strict';
import type { PitchPlayerState } from '@/engine/types';
import type { ImpactLedgerEntry } from '@/match/impactTypes';
import {
  appendCardHome,
  appendTeamGoalConcededHome,
  appendTeamGoalScoredHome,
  productFactorForPlayer,
} from '@/match/impactLedger';
import { captainAmplifyIndividualFactor, INDIV } from '@/match/impactRules';

const mkPitch = (ids: string[], gkId: string): PitchPlayerState[] =>
  ids.map((id, i) => ({
    playerId: id,
    slotId: `s${i}`,
    name: id,
    num: i + 1,
    pos: id === gkId ? 'GOL' : 'MC',
    x: 50,
    y: 50,
    fatigue: 0,
    role: id === gkId ? 'gk' : 'mid',
  }));

// Golo equipa: todos em campo ×1.10
{
  const L: ImpactLedgerEntry[] = [];
  appendTeamGoalScoredHome(L, 12, ['a', 'b', 'c']);
  assert.equal(productFactorForPlayer(L, 'a'), 1.1);
  assert.equal(productFactorForPlayer(L, 'b'), 1.1);
}

// Banco: sem linhas → produto 1
{
  const L: ImpactLedgerEntry[] = [];
  appendTeamGoalScoredHome(L, 5, ['on1', 'on2']);
  assert.equal(productFactorForPlayer(L, 'bench'), 1);
}

// Política B: GR ×0,85; campo ×0,90 (sem acumular nos dois no GR)
{
  const L: ImpactLedgerEntry[] = [];
  const pitch = mkPitch(['gk', 'z1', 'z2'], 'gk');
  appendTeamGoalConcededHome(L, 20, pitch);
  assert.ok(Math.abs(productFactorForPlayer(L, 'gk') - 0.85) < 1e-9);
  assert.ok(Math.abs(productFactorForPlayer(L, 'z1') - 0.9) < 1e-9);
}

// Capitão + amarelo: fator individual amplificado
{
  const expected = captainAmplifyIndividualFactor(INDIV.yellow);
  const L: ImpactLedgerEntry[] = [];
  appendCardHome(L, 30, 'cap', true, 'cap');
  assert.ok(Math.abs(productFactorForPlayer(L, 'cap') - expected) < 1e-9);
}

console.log('impact ledger self-test OK');
