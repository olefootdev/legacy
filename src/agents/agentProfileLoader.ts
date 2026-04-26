/**
 * Carregamento automático de AgentProfiles ao carregar jogadores do Supabase
 */

import type { PlayerEntity } from '@/entities/types';
import { createAgentProfile, validateAgentProfile } from './AgentProfileFactory';

/**
 * Gera ou atualiza AgentProfile para um jogador
 */
export function ensureAgentProfile(player: PlayerEntity): PlayerEntity {
  // Se já tem profile válido, retorna
  if (player.agentProfile) {
    const validation = validateAgentProfile(player.agentProfile);
    if (validation.valid) {
      return player;
    }
  }

  // Gera novo profile
  try {
    const profile = createAgentProfile(player);
    return {
      ...player,
      agentProfile: profile,
    };
  } catch (err) {
    console.error(`[AgentProfile] Erro ao gerar profile para ${player.name}:`, err);
    return player;
  }
}

/**
 * Gera profiles para todos os jogadores de um plantel
 */
export function ensureAgentProfilesForRoster(
  players: Record<string, PlayerEntity>,
): Record<string, PlayerEntity> {
  const result: Record<string, PlayerEntity> = {};

  for (const [id, player] of Object.entries(players)) {
    result[id] = ensureAgentProfile(player);
  }

  return result;
}

/**
 * Gera profiles apenas para jogadores sem profile
 */
export function generateMissingAgentProfiles(
  players: Record<string, PlayerEntity>,
): Record<string, PlayerEntity> {
  const result: Record<string, PlayerEntity> = {};

  for (const [id, player] of Object.entries(players)) {
    if (!player.agentProfile) {
      result[id] = ensureAgentProfile(player);
    } else {
      result[id] = player;
    }
  }

  return result;
}

/**
 * Estatísticas de profiles no plantel
 */
export function getAgentProfileStats(players: Record<string, PlayerEntity>): {
  total: number;
  withProfile: number;
  withoutProfile: number;
  validProfiles: number;
  invalidProfiles: number;
} {
  const playersList = Object.values(players);
  const total = playersList.length;
  const withProfile = playersList.filter((p) => p.agentProfile).length;
  const withoutProfile = total - withProfile;

  let validProfiles = 0;
  let invalidProfiles = 0;

  for (const player of playersList) {
    if (player.agentProfile) {
      const validation = validateAgentProfile(player.agentProfile);
      if (validation.valid) {
        validProfiles++;
      } else {
        invalidProfiles++;
      }
    }
  }

  return {
    total,
    withProfile,
    withoutProfile,
    validProfiles,
    invalidProfiles,
  };
}
