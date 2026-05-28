import type { PlayerEntity } from '@/entities/types';
import type { PlayerHealth } from '@/systems/playerHealth/types';

/**
 * FIX B — Fatigue efetiva (SSOT).
 *
 * Existem 2 fontes históricas: `PlayerEntity.fatigue` (legado, atualizado em runtime)
 * e `PlayerHealth.fatigue` (SSOT, atualizado off-match). Quando playerHealth tem
 * o registro, ele vence. Senão, fallback pro legado.
 *
 * Use em qualquer leitura crítica de fatigue (escalação, alerta de squad, UI).
 * O sync legacy→SSOT acontece em `FINALIZE_MATCH` (FIX C).
 */
export function getEffectiveFatigue(
  playerId: string,
  player: PlayerEntity | undefined,
  playerHealth: Record<string, PlayerHealth> | undefined,
): number {
  const fromHealth = playerHealth?.[playerId]?.fatigue;
  if (typeof fromHealth === 'number') return fromHealth;
  return player?.fatigue ?? 0;
}

/** Constrói o map { playerId → fatigue efetiva } pra alimentar buildDefaultLineup. */
export function buildFatigueByIdMap(
  players: Record<string, PlayerEntity>,
  playerHealth: Record<string, PlayerHealth> | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of Object.keys(players)) {
    out[id] = getEffectiveFatigue(id, players[id], playerHealth);
  }
  return out;
}

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
