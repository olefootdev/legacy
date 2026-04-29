import type { PlayerEntity } from '@/entities/types';
import { emptyHealth, recomputeAtRisk } from './reducer';
import type { PlayerHealth } from './types';

/**
 * Shim de leitura: durante a migração, alguns lugares ainda só têm PlayerEntity.
 * Esses helpers devolvem PlayerHealth lendo do mapa novo OU caindo no legado.
 *
 * Após a Fase 1, todos os call-sites lerão diretamente o mapa playerHealth,
 * e este shim pode ser removido (ou ficar só pra import/export legado).
 */

export function getPlayerHealth(
  health: Record<string, PlayerHealth> | undefined,
  player: PlayerEntity,
): PlayerHealth {
  const fromState = health?.[player.id];
  if (fromState) return fromState;
  return recomputeAtRisk({
    ...emptyHealth(player.id),
    fatigue: player.fatigue ?? 0,
    injuryRisk: player.injuryRisk ?? 0,
    outForMatches: player.outForMatches ?? 0,
  });
}

export function isAvailableForMatch(
  health: Record<string, PlayerHealth> | undefined,
  player: PlayerEntity,
): boolean {
  const h = getPlayerHealth(health, player);
  return h.outForMatches <= 0 && h.suspendedMatches <= 0;
}

export function selectAtRisk(
  health: Record<string, PlayerHealth> | undefined,
  players: PlayerEntity[],
): PlayerEntity[] {
  return players.filter((p) => getPlayerHealth(health, p).atRisk);
}

export function selectUnavailable(
  health: Record<string, PlayerHealth> | undefined,
  players: PlayerEntity[],
): PlayerEntity[] {
  return players.filter((p) => !isAvailableForMatch(health, p));
}

export function fatigueOf(
  health: Record<string, PlayerHealth> | undefined,
  player: PlayerEntity,
): number {
  return getPlayerHealth(health, player).fatigue;
}

export function injuryRiskOf(
  health: Record<string, PlayerHealth> | undefined,
  player: PlayerEntity,
): number {
  return getPlayerHealth(health, player).injuryRisk;
}

export function outForMatchesOf(
  health: Record<string, PlayerHealth> | undefined,
  player: PlayerEntity,
): number {
  return getPlayerHealth(health, player).outForMatches;
}
