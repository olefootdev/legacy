import type { Fixture } from '@/entities/types';
import type { PlayerEntity } from '@/entities/types';
import { travelFatigueDelta } from './fatigue';

/** Distância simulada (km) para efeito de viagem — deriva do adversário/fixture. */
export function tripKmForFixture(fixture: Fixture): number {
  const seed = fixture.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = 120 + (fixture.opponent.strength % 17) * 8 + (seed % 9) * 12;
  return fixture.isHome ? Math.min(40, base * 0.12) : Math.min(520, base);
}

export function applyTravelFatigueToSquad(players: Record<string, PlayerEntity>, km: number): Record<string, PlayerEntity> {
  const delta = travelFatigueDelta(km);
  const next: Record<string, PlayerEntity> = {};
  for (const [id, p] of Object.entries(players)) {
    next[id] = {
      ...p,
      fatigue: Math.min(100, p.fatigue + delta * 0.85),
      injuryRisk: Math.min(100, p.injuryRisk + delta * 0.08),
    };
  }
  return next;
}
