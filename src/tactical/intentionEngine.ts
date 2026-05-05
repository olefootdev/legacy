/**
 * /src/tactical/intentionEngine.ts
 *
 * Pipeline: ARQUÉTIPO → CONTEXTO → SCORING → AÇÃO
 *
 * getPlayerIntention(player, context) é a entrada pública.
 * Retorna a melhor ArchetypeIntention dado o arquétipo do jogador e o contexto atual.
 */

import { ARCHETYPE_BY_ID } from './archetypesCatalog';
import type { PlayerArchetype, ArchetypeIntention, ArchetypeTrigger } from './archetypesCatalog';
import type { FieldZoneId } from './zones12';

// ── Contexto de intenção ──────────────────────────────────────────────────────

export interface IntentionContext {
  /** Zona atual do jogador */
  currentZone: FieldZoneId;
  /** Time tem posse? */
  teamHasPossession: boolean;
  /** Jogador é o portador da bola? */
  isCarrier: boolean;
  /** Triggers ativos no momento */
  activeTriggers: ArchetypeTrigger[];
  /** Pressão recebida (0–100) */
  pressureLevel: number;
  /** Minuto da partida */
  minute: number;
  /** Diferença de gols (positivo = ganhando) */
  scoreDiff: number;
  /** Fase de jogo */
  phase: 'buildup' | 'transition' | 'attack' | 'defense' | 'set_piece';
}

// ── Resultado da intenção ─────────────────────────────────────────────────────

export interface IntentionResult {
  intention: ArchetypeIntention;
  score: number;
  /** Zona alvo sugerida */
  targetZone: FieldZoneId | null;
  /** Razão legível (debug) */
  reason: string;
}

// ── Entrada pública ───────────────────────────────────────────────────────────

export interface PlayerIntentionInput {
  tacticalArchetypeId: string;
  currentZone: FieldZoneId;
}

// ── Pipeline principal ────────────────────────────────────────────────────────

/**
 * Retorna a melhor intenção para o jogador dado seu arquétipo e contexto.
 * Fallback seguro: se arquétipo não encontrado, retorna 'hold_position'.
 */
export function getPlayerIntention(
  player: PlayerIntentionInput,
  context: IntentionContext,
): IntentionResult {
  const archetype = ARCHETYPE_BY_ID[player.tacticalArchetypeId as keyof typeof ARCHETYPE_BY_ID];

  if (!archetype) {
    return {
      intention: 'hold_position',
      score: 0,
      targetZone: null,
      reason: `archetype '${player.tacticalArchetypeId}' not found — fallback`,
    };
  }

  // Passo 1: ARQUÉTIPO → candidatos
  const candidates = getCandidateIntentions(archetype, context);

  // Passo 2: CONTEXTO → filtra por triggers ativos
  const filtered = filterByTriggers(candidates, archetype, context);

  // Passo 3: SCORING → pontua cada candidato
  const scored = scoreIntentions(filtered, archetype, context);

  // Passo 4: melhor escolha
  const best = scored[0];

  if (!best) {
    return {
      intention: 'hold_position',
      score: 0,
      targetZone: null,
      reason: 'no candidates after scoring — fallback',
    };
  }

  const targetZone = resolveTargetZone(best.intention, archetype, context);

  return {
    intention: best.intention,
    score: best.score,
    targetZone,
    reason: best.reason,
  };
}

// ── Passo 1: candidatos do arquétipo ─────────────────────────────────────────

function getCandidateIntentions(
  archetype: PlayerArchetype,
  context: IntentionContext,
): ArchetypeIntention[] {
  // Zona proibida → só hold_position
  if (archetype.forbiddenZones.includes(context.currentZone)) {
    return ['hold_position'];
  }

  // Seleciona intentions de ataque ou defesa conforme posse
  if (context.teamHasPossession) {
    return archetype.intentions;
  }

  // Sem posse: prioriza intentions defensivas do arquétipo
  const defensiveIntentions: ArchetypeIntention[] = [
    'hold_position', 'cover_space', 'man_mark', 'press_high',
    'anchor_midfield', 'screen_defense', 'close_spaces',
    'recovery_run', 'sweep_behind', 'break_up_play',
    'step_out_press', 'trigger_press', 'organize_defense',
  ];

  const defensiveCandidates = archetype.intentions.filter(i =>
    defensiveIntentions.includes(i),
  );

  return defensiveCandidates.length > 0 ? defensiveCandidates : archetype.intentions;
}

// ── Passo 2: filtro por triggers ──────────────────────────────────────────────

function filterByTriggers(
  candidates: ArchetypeIntention[],
  archetype: PlayerArchetype,
  context: IntentionContext,
): ArchetypeIntention[] {
  const activeTriggerSet = new Set(context.activeTriggers);
  const archetypeTriggerSet = new Set(archetype.triggers);

  // Quantos triggers do arquétipo estão ativos?
  const matchCount = [...archetypeTriggerSet].filter(t => activeTriggerSet.has(t)).length;

  // Se nenhum trigger do arquétipo está ativo, retorna todos os candidatos sem filtro
  if (matchCount === 0) return candidates;

  // Com triggers ativos, todos os candidatos são válidos (triggers amplificam score, não filtram)
  return candidates;
}

// ── Passo 3: scoring ──────────────────────────────────────────────────────────

interface ScoredIntention {
  intention: ArchetypeIntention;
  score: number;
  reason: string;
}

function scoreIntentions(
  candidates: ArchetypeIntention[],
  archetype: PlayerArchetype,
  context: IntentionContext,
): ScoredIntention[] {
  const activeTriggerSet = new Set(context.activeTriggers);
  const archetypeTriggers = new Set(archetype.triggers);

  const triggerMatchBonus = [...archetypeTriggers].filter(t => activeTriggerSet.has(t)).length * 0.15;

  const scored: ScoredIntention[] = candidates.map(intention => {
    let score = 0.5; // base
    const reasons: string[] = [];

    // Bonus por trigger match
    score += triggerMatchBonus;
    if (triggerMatchBonus > 0) reasons.push(`+${triggerMatchBonus.toFixed(2)} triggers`);

    // Bonus por zona correta (ataque vs defesa)
    const inAttackZone = archetype.attackZones.includes(context.currentZone);
    const inDefenseZone = archetype.defenseZones.includes(context.currentZone);

    if (context.teamHasPossession && inAttackZone) {
      score += 0.2;
      reasons.push('+0.20 attack zone');
    } else if (!context.teamHasPossession && inDefenseZone) {
      score += 0.2;
      reasons.push('+0.20 defense zone');
    }

    // Bonus por profile
    score += scoreByProfile(intention, archetype, context);

    // Penalidade por pressão alta em intentions ofensivas
    const offensiveIntentions: ArchetypeIntention[] = [
      'run_in_behind', 'ghost_run', 'channel_run', 'exploit_space',
      'finish_chances', 'create_chances', 'cut_inside',
    ];
    if (offensiveIntentions.includes(intention) && context.pressureLevel > 70) {
      score -= 0.15;
      reasons.push('-0.15 high pressure');
    }

    // Bonus por fase de jogo
    if (context.phase === 'attack' && context.teamHasPossession) {
      const attackIntentions: ArchetypeIntention[] = [
        'finish_chances', 'create_chances', 'run_in_behind', 'ghost_run',
        'channel_run', 'cut_inside', 'deliver_cross', 'overlap_attack',
      ];
      if (attackIntentions.includes(intention)) {
        score += 0.1;
        reasons.push('+0.10 attack phase');
      }
    }

    if (context.phase === 'defense' && !context.teamHasPossession) {
      const defenseIntentions: ArchetypeIntention[] = [
        'hold_position', 'cover_space', 'man_mark', 'press_high',
        'anchor_midfield', 'screen_defense', 'close_spaces', 'recovery_run',
      ];
      if (defenseIntentions.includes(intention)) {
        score += 0.1;
        reasons.push('+0.10 defense phase');
      }
    }

    // Urgência: perdendo nos últimos 15 minutos
    if (context.scoreDiff < 0 && context.minute > 75) {
      const urgentIntentions: ArchetypeIntention[] = [
        'run_in_behind', 'ghost_run', 'finish_chances', 'create_chances',
        'exploit_space', 'channel_run',
      ];
      if (urgentIntentions.includes(intention)) {
        score += 0.2;
        reasons.push('+0.20 urgency');
      }
    }

    return {
      intention,
      score: Math.min(1, Math.max(0, score)),
      reason: reasons.join(', ') || 'base score',
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

function scoreByProfile(
  intention: ArchetypeIntention,
  archetype: PlayerArchetype,
  _context: IntentionContext,
): number {
  const { discipline, aggression, creativity, risk } = archetype.profile;
  let delta = 0;

  // Intentions disciplinadas beneficiam de discipline alto
  const disciplinedIntentions: ArchetypeIntention[] = [
    'hold_position', 'anchor_midfield', 'screen_defense', 'close_spaces',
    'cover_space', 'organize_defense', 'hold_width_defense',
  ];
  if (disciplinedIntentions.includes(intention)) delta += (discipline - 50) * 0.002;

  // Intentions agressivas beneficiam de aggression alto
  const aggressiveIntentions: ArchetypeIntention[] = [
    'press_high', 'man_mark', 'break_up_play', 'step_out_press',
    'trigger_press', 'press_defenders',
  ];
  if (aggressiveIntentions.includes(intention)) delta += (aggression - 50) * 0.002;

  // Intentions criativas beneficiam de creativity alto
  const creativeIntentions: ArchetypeIntention[] = [
    'create_chances', 'dictate_tempo', 'free_roam', 'drift_zones',
    'ghost_run', 'orchestrate_buildup', 'connect_wide_attack',
  ];
  if (creativeIntentions.includes(intention)) delta += (creativity - 50) * 0.002;

  // Intentions de risco beneficiam de risk alto
  const riskyIntentions: ArchetypeIntention[] = [
    'run_in_behind', 'channel_run', 'exploit_space', 'carry_ball_forward',
    'cut_inside', 'ghost_run', 'switch_flanks',
  ];
  if (riskyIntentions.includes(intention)) delta += (risk - 50) * 0.002;

  return delta;
}

// ── Passo 4: zona alvo ────────────────────────────────────────────────────────

function resolveTargetZone(
  intention: ArchetypeIntention,
  archetype: PlayerArchetype,
  context: IntentionContext,
): FieldZoneId | null {
  if (context.teamHasPossession && archetype.attackZones.length > 0) {
    // Zona de ataque mais avançada (última no array por convenção)
    return archetype.attackZones[archetype.attackZones.length - 1] ?? null;
  }

  if (!context.teamHasPossession && archetype.defenseZones.length > 0) {
    return archetype.defenseZones[0] ?? null;
  }

  return null;
}

// ── Utilitário: batch para time inteiro ──────────────────────────────────────

export function getTeamIntentions(
  players: PlayerIntentionInput[],
  context: IntentionContext,
): Map<string, IntentionResult> {
  const results = new Map<string, IntentionResult>();
  for (const player of players) {
    results.set(player.tacticalArchetypeId, getPlayerIntention(player, context));
  }
  return results;
}
