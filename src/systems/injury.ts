import type { PlayerEntity } from '@/entities/types';

/** Risco extra após minuto extenuante; pode gerar lesão curta. */
export function rollMatchInjury(player: PlayerEntity, minuteIntensity: number): PlayerEntity {
  if (player.outForMatches > 0) return player;
  const stress = player.fatigue * 0.45 + player.injuryRisk * 0.35 + minuteIntensity * 8;
  if (Math.random() < stress / 420) {
    const matchesOut = 1 + (Math.random() > 0.82 ? 2 : 0);
    return {
      ...player,
      outForMatches: matchesOut,
      injuryRisk: Math.max(0, player.injuryRisk - 15),
      fatigue: Math.min(100, player.fatigue + 8),
    };
  }
  return {
    ...player,
    injuryRisk: Math.min(100, player.injuryRisk + minuteIntensity * 0.35),
  };
}

export function tickRecoveryMatches(players: Record<string, PlayerEntity>): Record<string, PlayerEntity> {
  const next: Record<string, PlayerEntity> = {};
  for (const [id, p] of Object.entries(players)) {
    next[id] =
      p.outForMatches > 0 ? { ...p, outForMatches: Math.max(0, p.outForMatches - 1) } : p;
  }
  return next;
}
