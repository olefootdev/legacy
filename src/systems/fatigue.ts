import type { PlayerEntity } from '@/entities/types';

export function applyMatchMinuteFatigue(player: PlayerEntity, intensity = 1, gainMul = 1): PlayerEntity {
  // V5 (2026-05-27): delta 0.35 → 0.55. Atletas chegam a 70-80% no 70-80 minuto
  // (era ~60% até 90'). Combinado com `attrMultiplier` em getFatigueState, isso
  // faz as decisões caírem progressivamente — manager sente necessidade de
  // substituir conforme o jogo avança.
  const delta = 0.55 * intensity * (1 + (100 - player.attrs.fisico) / 200) * gainMul;
  return { ...player, fatigue: Math.min(100, player.fatigue + delta) };
}

export function travelFatigueDelta(km: number): number {
  return Math.min(22, km / 80);
}
