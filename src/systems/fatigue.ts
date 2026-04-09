import type { PlayerEntity } from '@/entities/types';

export function applyMatchMinuteFatigue(player: PlayerEntity, intensity = 1): PlayerEntity {
  const delta = 0.35 * intensity * (1 + (100 - player.attrs.fisico) / 200);
  return { ...player, fatigue: Math.min(100, player.fatigue + delta) };
}

export function travelFatigueDelta(km: number): number {
  return Math.min(22, km / 80);
}
