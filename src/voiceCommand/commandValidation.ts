/**
 * OLEFOOT — Command Validation
 *
 * Valida comandos de voz ANTES de dispatch, bloqueando comandos taticamente
 * inválidos ou impossíveis de executar no contexto atual.
 *
 * Validações:
 *   1. Skill match — jogador tem atributos pra executar?
 *   2. Context check — posição/situação permite?
 *   3. Tactical sense — comando faz sentido tático?
 */

import type { VoiceIntent } from './types';
import type { PitchPlayerState } from '@/engine/types';
import { computeSkillMatch } from './obedienceRoll';
import type { MatchPlayerAttributes } from '@/match/playerInMatch';

export interface CommandValidationResult {
  valid: boolean;
  /** Razão da rejeição (se valid=false). */
  reason?: string;
  /** Sugestão alternativa (opcional). */
  suggestion?: string;
  /** Severidade: 'error' bloqueia, 'warning' permite mas avisa. */
  severity?: 'error' | 'warning';
}

export interface ValidationContext {
  player: {
    playerId: string;
    name: string;
    x: number; // engine coords 0-100
    y: number;
    role?: 'gk' | 'def' | 'mid' | 'attack';
    slotId?: string;
    attributes?: MatchPlayerAttributes;
    hasBall?: boolean;
  };
  match: {
    side: 'home' | 'away';
    ballCarrierPlayerId?: string;
    minute: number;
  };
}

// ─── Skill Threshold ────────────────────────────────────────────────────────

const SKILL_THRESHOLD_ERROR = 25;   // <25 → bloqueia
const SKILL_THRESHOLD_WARNING = 40; // 25-40 → avisa

/**
 * Valida se jogador tem skill mínimo pra executar o comando.
 */
function validateSkillMatch(
  intent: VoiceIntent,
  ctx: ValidationContext,
): CommandValidationResult {
  const skillMatch = computeSkillMatch(intent, {
    attributes: ctx.player.attributes,
    role: ctx.player.role,
    slotId: ctx.player.slotId,
  });

  if (skillMatch < SKILL_THRESHOLD_ERROR) {
    return {
      valid: false,
      reason: `${ctx.player.name} não tem skill pra isso (compatibilidade ${Math.round(skillMatch)}%)`,
      suggestion: getSkillSuggestion(intent, ctx),
      severity: 'error',
    };
  }

  if (skillMatch < SKILL_THRESHOLD_WARNING) {
    return {
      valid: true,
      reason: `${ctx.player.name} tem skill baixo pra isso (${Math.round(skillMatch)}%)`,
      severity: 'warning',
    };
  }

  return { valid: true };
}

function getSkillSuggestion(intent: VoiceIntent, ctx: ValidationContext): string | undefined {
  const role = ctx.player.role;

  // Sugestões por intent + role
  const suggestions: Partial<Record<VoiceIntent, Partial<Record<string, string>>>> = {
    dribble_attempt: {
      def: 'Zagueiros não driblam — tenta "passa rápido" ou "segura a bola"',
      gk: 'Goleiro não dribla — tenta "lança pro ataque"',
    },
    take_shot: {
      def: 'Zagueiro longe do gol — tenta "passa pro ataque"',
      gk: 'Goleiro não finaliza',
    },
    invade_box: {
      def: 'Zagueiro não invade — tenta "sobe o time" (coletivo)',
      mid: 'Meia raramente invade — tenta "atacantes invadem"',
      gk: 'Goleiro não invade',
    },
    mark_player: {
      attack: 'Atacante não marca — tenta "pressiona alto" (coletivo)',
    },
    aggressive_tackle: {
      attack: 'Atacante não entra duro — tenta "pressiona o portador"',
    },
  };

  return suggestions[intent]?.[role ?? 'mid'];
}

// ─── Context Validation ─────────────────────────────────────────────────────

/**
 * Valida se o contexto atual permite executar o comando.
 */
function validateContext(
  intent: VoiceIntent,
  ctx: ValidationContext,
): CommandValidationResult {
  const p = ctx.player;
  const m = ctx.match;
  const isHome = m.side === 'home';
  const attackingX = isHome ? p.x : 100 - p.x; // normaliza: >50 = campo ofensivo

  // ─── Comandos que exigem bola ───────────────────────────────────────────

  const requiresBall: VoiceIntent[] = [
    'take_shot',
    'dribble_attempt',
    'cross_ball',
    'pass_to_player',
    'hold_ball',
    'quick_pass',
    'switch_play',
  ];

  if (requiresBall.includes(intent) && !p.hasBall) {
    return {
      valid: false,
      reason: `${p.name} não está com a bola`,
      suggestion: m.ballCarrierPlayerId
        ? 'Comando só funciona com bola no pé'
        : 'Ninguém do seu time está com a bola',
      severity: 'error',
    };
  }

  // ─── Comandos ofensivos longe do gol ────────────────────────────────────

  if (intent === 'take_shot' && attackingX < 65) {
    return {
      valid: false,
      reason: `${p.name} está longe do gol (campo ${attackingX < 50 ? 'defensivo' : 'meio-campo'})`,
      suggestion: 'Tenta "invade a área" primeiro, depois "chuta"',
      severity: 'error',
    };
  }

  if (intent === 'cross_ball' && attackingX < 60) {
    return {
      valid: false,
      reason: `${p.name} está longe da linha de fundo pra cruzar`,
      suggestion: 'Cruza funciona melhor perto da área adversária',
      severity: 'warning',
    };
  }

  // ─── Comandos defensivos longe da defesa ────────────────────────────────

  if ((intent === 'mark_player' || intent === 'block_advance') && attackingX > 60) {
    return {
      valid: false,
      reason: `${p.name} está no ataque, longe de marcar`,
      suggestion: 'Marcação funciona no meio-campo ou defesa',
      severity: 'warning',
    };
  }

  // ─── GK não sai da área (exceto em desespero) ───────────────────────────

  if (p.role === 'gk' && (intent === 'invade_box' || intent === 'dribble_attempt')) {
    return {
      valid: false,
      reason: 'Goleiro não deve sair da área',
      severity: 'error',
    };
  }

  // ─── Comandos criativos exigem espaço ────────────────────────────────────

  if ((intent === 'break_line' || intent === 'run_behind') && attackingX < 50) {
    return {
      valid: false,
      reason: `${p.name} está no campo defensivo — "quebrar linha" funciona no ataque`,
      suggestion: 'Tenta "sobe o time" primeiro',
      severity: 'warning',
    };
  }

  return { valid: true };
}

// ─── Tactical Sense ─────────────────────────────────────────────────────────

/**
 * Valida se o comando faz sentido tático no momento da partida.
 */
function validateTacticalSense(
  intent: VoiceIntent,
  ctx: ValidationContext,
): CommandValidationResult {
  const m = ctx.match;

  // ─── Comandos ofensivos em momento defensivo ────────────────────────────

  // (Futuro: adicionar lógica baseada em placar, posse, fase da partida)
  // Por ora, apenas validações básicas

  // ─── Substituição/formação em momento crítico ────────────────────────────

  if (intent === 'player_substitution' && m.minute > 85) {
    return {
      valid: true,
      reason: 'Substituição nos acréscimos — certeza?',
      severity: 'warning',
    };
  }

  return { valid: true };
}

// ─── Validator Principal ────────────────────────────────────────────────────

/**
 * Valida comando antes de dispatch. Retorna resultado agregado de todas as
 * validações (skill + context + tactical).
 *
 * Se qualquer validação retornar `valid: false` com `severity: 'error'`,
 * o comando é bloqueado. Warnings são permitidos mas mostrados na UI.
 */
export function validateCommand(
  intent: VoiceIntent,
  ctx: ValidationContext,
): CommandValidationResult {
  // Comandos administrativos (substituição, formação) não validam skill/context
  if (intent === 'player_substitution' || intent === 'formation_change') {
    return validateTacticalSense(intent, ctx);
  }

  // Comandos coletivos (team_*) não validam jogador individual
  if (intent.startsWith('team_') || intent === 'calm_team' || intent === 'spare_player') {
    return { valid: true };
  }

  // Validações em ordem: skill → context → tactical
  const skillResult = validateSkillMatch(intent, ctx);
  if (!skillResult.valid) return skillResult;

  const contextResult = validateContext(intent, ctx);
  if (!contextResult.valid) return contextResult;

  const tacticalResult = validateTacticalSense(intent, ctx);
  if (!tacticalResult.valid) return tacticalResult;

  // Se passou tudo mas teve warning, retorna o warning
  if (skillResult.severity === 'warning') return skillResult;
  if (contextResult.severity === 'warning') return contextResult;
  if (tacticalResult.severity === 'warning') return tacticalResult;

  return { valid: true };
}
