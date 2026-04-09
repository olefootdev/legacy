import type { PlayerEntity } from '@/entities/types';
import { addOle } from './economy';
import type { FinanceState } from '@/entities/types';

/** Treino leve: reduz fadiga; custa EXP (reduz saldo e ranking). */
export function applySquadTraining(
  players: Record<string, PlayerEntity>,
  finance: FinanceState,
  oleCost = 35,
): { players: Record<string, PlayerEntity>; finance: FinanceState; ok: boolean } {
  if (finance.ole < oleCost) return { players, finance, ok: false };
  const nextPlayers: Record<string, PlayerEntity> = {};
  for (const [id, p] of Object.entries(players)) {
    nextPlayers[id] = {
      ...p,
      fatigue: Math.max(0, p.fatigue - 6 - p.attrs.fisico / 40),
      evolutionXp: p.evolutionXp + 2,
    };
  }
  return { players: nextPlayers, finance: addOle(finance, -oleCost), ok: true };
}
