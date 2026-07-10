/**
 * Sistema de comandos táticos do treinador durante partida ao vivo.
 *
 * Sintaxe:
 * - @ <nome>           → fala com jogador específico
 * - @@ <setor>         → fala com setor (defesa/meio/ataque)
 * - @@@ <mensagem>     → fala com todo o time
 * - /<skill>           → ativa skill (autocomplete disponível)
 * - @<nome> /<skill>   → ativa skill em jogador específico
 *
 * Exemplos:
 * - @adriano /invadirarea
 * - @@ defesa segura a linha
 * - @@@ pressão alta agora
 * - /sobreposicao
 */

import type { PitchPlayerState } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import { getPlayerSkills, FULL_SKILL_CATALOG } from '@/skills/index';
import type { CoachSkill } from '@/skills/playbookV1';

export type CommandScope = 'player' | 'sector' | 'team';
export type SectorType = 'defesa' | 'meio' | 'ataque';

export interface ParsedCommand {
  scope: CommandScope;
  target?: string; // player name or sector
  message: string;
  skill?: string; // skill ID if /skill syntax
  raw: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  targetPlayers?: string[]; // player IDs affected
  skillActivated?: string; // skill ID if activated
}

/**
 * Parse do comando do treinador.
 *
 * Sintaxe:
 * - @nome mensagem → player
 * - @@setor mensagem → sector
 * - @@@mensagem → team
 * - /skill → skill activation (team-wide)
 * - @nome /skill → skill activation (player-specific)
 */
export function parseCoachCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // @@@ → team
  if (trimmed.startsWith('@@@')) {
    const message = trimmed.slice(3).trim();
    return {
      scope: 'team',
      message,
      raw: trimmed,
    };
  }

  // @@ → sector
  if (trimmed.startsWith('@@')) {
    const rest = trimmed.slice(2).trim();
    const parts = rest.split(/\s+/);
    const sector = parts[0]?.toLowerCase();
    const message = parts.slice(1).join(' ');
    return {
      scope: 'sector',
      target: sector,
      message,
      raw: trimmed,
    };
  }

  // @ → player (pode ter /skill)
  if (trimmed.startsWith('@')) {
    const rest = trimmed.slice(1).trim();
    const skillMatch = rest.match(/^(\S+)\s+\/(\S+)(.*)$/);

    if (skillMatch) {
      // @nome /skill mensagem
      return {
        scope: 'player',
        target: skillMatch[1],
        skill: skillMatch[2],
        message: skillMatch[3]?.trim() || '',
        raw: trimmed,
      };
    }

    // @nome mensagem
    const parts = rest.split(/\s+/);
    const playerName = parts[0];
    const message = parts.slice(1).join(' ');
    return {
      scope: 'player',
      target: playerName,
      message,
      raw: trimmed,
    };
  }

  // / → skill activation (team-wide)
  if (trimmed.startsWith('/')) {
    const skillId = trimmed.slice(1).trim().split(/\s+/)[0];
    return {
      scope: 'team',
      skill: skillId,
      message: '',
      raw: trimmed,
    };
  }

  // Mensagem genérica → team
  return {
    scope: 'team',
    message: trimmed,
    raw: trimmed,
  };
}

/**
 * Encontra jogador por nome (fuzzy match).
 */
export function findPlayerByName(
  name: string,
  players: PitchPlayerState[],
): PitchPlayerState | null {
  const lower = name.toLowerCase();

  // Exact match
  const exact = players.find((p) => p.name.toLowerCase() === lower);
  if (exact) return exact;

  // Partial match (começa com)
  const partial = players.find((p) => p.name.toLowerCase().startsWith(lower));
  if (partial) return partial;

  // Contains
  const contains = players.find((p) => p.name.toLowerCase().includes(lower));
  return contains ?? null;
}

/**
 * Encontra jogadores por setor.
 */
export function findPlayersBySector(
  sector: string,
  players: PitchPlayerState[],
): PitchPlayerState[] {
  const lower = sector.toLowerCase();

  if (lower.includes('def') || lower.includes('zag')) {
    return players.filter((p) => p.role === 'def');
  }

  if (lower.includes('mei') || lower.includes('vol') || lower.includes('mc')) {
    return players.filter((p) => p.role === 'mid');
  }

  if (lower.includes('ata') || lower.includes('pont')) {
    return players.filter((p) => p.role === 'attack');
  }

  if (lower.includes('gol')) {
    return players.filter((p) => p.role === 'gk');
  }

  return [];
}

/**
 * Verifica se jogador pode ativar skill.
 */
export function canActivateSkill(
  player: PitchPlayerState,
  skillId: string,
  playersById: Record<string, PlayerEntity>,
): { ok: boolean; reason?: string } {
  const entity = playersById[player.playerId];
  if (!entity) return { ok: false, reason: 'Jogador não encontrado' };

  const equippedSkills = entity.skills ?? [];
  if (!equippedSkills.includes(skillId)) {
    return { ok: false, reason: 'Skill não equipada' };
  }

  // TODO: verificar cooldown, fatigue, etc.
  return { ok: true };
}

/**
 * Autocomplete de skills disponíveis.
 */
export function getSkillSuggestions(
  input: string,
  players: PitchPlayerState[],
  playersById: Record<string, PlayerEntity>,
): CoachSkill[] {
  // Se input começa com @nome /, sugere skills do jogador
  const playerSkillMatch = input.match(/^@(\S+)\s+\/(\S*)$/);
  if (playerSkillMatch) {
    const playerName = playerSkillMatch[1];
    const skillPrefix = playerSkillMatch[2].toLowerCase();
    const player = findPlayerByName(playerName, players);

    if (player) {
      const entity = playersById[player.playerId];
      if (entity?.skills) {
        const playerSkills = getPlayerSkills(entity.skills);
        return playerSkills.filter((s) =>
          s.id.toLowerCase().includes(skillPrefix) ||
          s.name.toLowerCase().includes(skillPrefix)
        );
      }
    }
    return [];
  }

  // Se input começa com /, sugere todas as skills do catálogo
  const skillMatch = input.match(/^\/(\S*)$/);
  if (skillMatch) {
    const skillPrefix = skillMatch[1].toLowerCase();
    return FULL_SKILL_CATALOG.filter((s) =>
      s.id.toLowerCase().includes(skillPrefix) ||
      s.name.toLowerCase().includes(skillPrefix)
    ).slice(0, 10); // Max 10 sugestões
  }

  return [];
}
