/**
 * Fórmulas de obediência do sistema de voz.
 *
 * 3 camadas multiplicam umas às outras:
 *   1. OBEDIÊNCIA DO TIME  (30..100 — cresce com uso, decai em partidas mudas)
 *   2. EFICÁCIA DO ASSISTENTE (0..100 — atributos do staff que recebe o relay)
 *   3. OBEDIÊNCIA INDIVIDUAL (0..100 — jogador avalia se aceita o comando)
 *
 * Saída: `effectiveObedience ∈ [0, 100]` → mapeada pra `ObedienceTier`.
 */

import type { MatchPlayerAttributes } from '@/match/playerInMatch';
import type {
  ObedienceTier,
  VoiceIntent,
} from './types';
import { INTENT_DIFFICULTY } from './types';

// ─── Skill match ────────────────────────────────────────────────────────────

/**
 * Score 0-100 de compatibilidade entre intent e atributos do jogador.
 * Casamento alto: skill relevante >80 + role apropriado.
 * Casamento baixo: comando pede algo que ele não faz (ex.: zagueiro driblar).
 */
export function computeSkillMatch(
  intent: VoiceIntent,
  player: {
    attributes?: MatchPlayerAttributes;
    role?: 'gk' | 'def' | 'mid' | 'attack';
    slotId?: string;
  },
): number {
  const attrs = player.attributes;
  if (!attrs) return 55;

  const v = {
    finalizacao: attrs.finalizacao ?? 50,
    drible: attrs.drible ?? 50,
    cruzamento: attrs.cruzamento ?? 50,
    passeCurto: attrs.passeCurto ?? 50,
    passeLongo: attrs.passeLongo ?? 50,
    marcacao: attrs.marcacao ?? 50,
    velocidade: attrs.velocidade ?? 50,
    fisico: attrs.fisico ?? 50,
    fairPlay: attrs.fairPlay ?? 70,
    tatico: attrs.tatico ?? 50,
    mentalidade: attrs.mentalidade ?? 50,
  };
  const role = player.role ?? 'mid';
  const slot = player.slotId ?? '';

  // Role fit scores (0-40 range)
  const roleFit: Partial<Record<VoiceIntent, Record<string, number>>> = {
    invade_box: { attack: 40, mid: 22, def: 8, gk: 0 },
    dribble_attempt: { attack: 35, mid: 25, def: 10, gk: 0 },
    take_shot: { attack: 40, mid: 22, def: 10, gk: 0 },
    cross_ball: { def: slot === 'le' || slot === 'ld' ? 40 : 18, mid: 25, attack: 20, gk: 0 },
    pass_to_player: { mid: 35, def: 25, attack: 28, gk: 18 },
    hold_ball: { mid: 30, attack: 25, def: 18, gk: 10 },
    quick_pass: { mid: 35, attack: 25, def: 20, gk: 10 },
    switch_play: { mid: 35, def: 28, attack: 20, gk: 8 },
    mark_player: { def: 38, mid: 28, attack: 12, gk: 0 },
    block_advance: { def: 38, mid: 25, attack: 10, gk: 0 },
    aggressive_tackle: { def: 35, mid: 25, attack: 12, gk: 0 },
    tactical_foul: { mid: 32, def: 30, attack: 12, gk: 0 },
    break_line: { attack: 40, mid: 22, def: 5, gk: 0 },
    break_zone: { mid: 32, attack: 30, def: 12, gk: 0 },
    run_behind: { attack: 38, mid: 22, def: 8, gk: 0 },
    pedal_to_metal: { attack: 25, mid: 30, def: 20, gk: 5 },
    free_play: { attack: 30, mid: 30, def: 15, gk: 0 },
    wait_support: { mid: 32, attack: 25, def: 20, gk: 5 },
    stretch_team: { attack: 30, mid: 20, def: 10, gk: 0 },
    hold_small_area: { attack: 40, mid: 15, def: 5, gk: 0 },
    left_back_overlap: { def: slot === 'le' ? 40 : 15, mid: 10, attack: 5, gk: 0 },
  };

  const rf = roleFit[intent]?.[role] ?? 20;

  // Attribute fit scores (0-50 range)
  let af = 0;
  switch (intent) {
    case 'dribble_attempt':
    case 'free_play':
    case 'break_zone':
      af = v.drible * 0.5;
      break;
    case 'take_shot':
      af = v.finalizacao * 0.5;
      break;
    case 'cross_ball':
    case 'laterals_cross':
      af = v.cruzamento * 0.5;
      break;
    case 'pass_to_player':
    case 'quick_pass':
      af = v.passeCurto * 0.5;
      break;
    case 'switch_play':
      af = v.passeLongo * 0.5;
      break;
    case 'mark_player':
    case 'block_advance':
      af = v.marcacao * 0.5;
      break;
    case 'aggressive_tackle':
    case 'tactical_foul':
      // Skill: marcação + físico. Penaliza fairPlay alto (não aceita).
      af = Math.max(0, ((v.marcacao + v.fisico) / 2) * 0.5 - Math.max(0, v.fairPlay - 70) * 0.6);
      break;
    case 'invade_box':
    case 'break_line':
    case 'run_behind':
    case 'hold_small_area':
      af = ((v.velocidade + v.finalizacao) / 2) * 0.5;
      break;
    case 'pedal_to_metal':
      af = v.fisico * 0.5;
      break;
    case 'hold_ball':
    case 'wait_support':
      af = v.drible * 0.5;
      break;
    case 'team_press_high':
    case 'forwards_press_defenders':
      af = v.velocidade * 0.5;
      break;
    case 'midfielders_compact':
    case 'team_retreat':
    case 'team_hold_possession':
    case 'team_high_line':
    case 'stretch_team':
      af = v.tatico * 0.5;
      break;
    case 'calm_team':
      af = v.mentalidade * 0.5;
      break;
    default:
      af = v.tatico * 0.5;
  }

  return Math.max(0, Math.min(100, rf + af));
}

// ─── Individual obedience ───────────────────────────────────────────────────

export interface IndividualObedienceCtx {
  /** Confiança em runtime (0-100, já com mentalidade/forma do minuto). */
  confianca: number;
  /** Fadiga 0-100 (0 = fresco, 100 = morto). */
  fatigue: number;
  /** Tático do jogador (disciplina). */
  tatico: number;
  /** Relação com o manager (0-100) — MVP: fixo 75. */
  relacaoManager?: number;
  /** Skill match já calculado. */
  skillMatch: number;
  /** Dificuldade do intent (1-5). */
  difficulty: number;
}

/**
 * Score individual 0-100 (antes de multiplicar pela obediência do time).
 * Fórmula-base:
 *   confianca × 0.35 + (100-fadiga) × 0.25 + skillMatch × 0.25 + tatico × 0.10 + relacao × 0.05
 *   − penalidade por dificuldade (até −15 em dificuldade 5)
 */
export function computeIndividualObedience(ctx: IndividualObedienceCtx): number {
  const relacao = ctx.relacaoManager ?? 75;
  const base =
    ctx.confianca * 0.35 +
    (100 - Math.min(100, Math.max(0, ctx.fatigue))) * 0.25 +
    ctx.skillMatch * 0.25 +
    ctx.tatico * 0.10 +
    relacao * 0.05;
  const difficultyPenalty = (ctx.difficulty - 1) * 3.75; // 0..15
  return Math.max(0, Math.min(100, base - difficultyPenalty));
}

// ─── Team-wide obedience ────────────────────────────────────────────────────

/** Limites do multiplicador coletivo. */
export const TEAM_OBEDIENCE_MIN = 30;
export const TEAM_OBEDIENCE_MAX = 100;
export const TEAM_OBEDIENCE_DEFAULT = 30;

/** Deltas aplicados em `bumpTeamObedience`. */
export const TEAM_OBEDIENCE_DELTAS = {
  /** Comando válido emitido (independente do sucesso). */
  commandIssued: 0.1,
  /** Jogador aceitou e executou normalmente. */
  commandObeyed: 0.2,
  /** Comando criativo executado com sucesso (break_line, free_play, etc). */
  creativeSuccess: 0.5,
  /** Partida inteira sem nenhum comando de voz emitido. */
  decayPerIdleMatch: -1.0,
  /** Aviso do árbitro por palavrão — moral cai. */
  refereeWarning: -0.5,
  /** Cartão vermelho por linguagem — punição forte. */
  refereeRedLanguage: -2.0,
  /** Delta por resultado do comando individual — aplicado em VOICE_COMMAND_ISSUED por jogador. */
  byTier: {
    critical_accept: 0.25,
    accept: 0.12,
    weak_accept: 0.04,
    refuse: -0.2,
    protest: -0.4,
  } satisfies Record<import('./types').ObedienceTier, number>,
};

export function bumpTeamObedience(current: number, delta: number): number {
  const base = Number.isFinite(current) ? current : TEAM_OBEDIENCE_DEFAULT;
  return Math.max(TEAM_OBEDIENCE_MIN, Math.min(TEAM_OBEDIENCE_MAX, base + delta));
}

// ─── Effective = team × individual ──────────────────────────────────────────

/**
 * Obediência efetiva (0-100) = indiv × (team/100).
 * Intuição: time a 30% limita tudo a 30% do score individual — sensação de ser
 * ignorado. Evoluindo pro 100% libera toda a força do jogador.
 */
export function computeEffectiveObedience(
  individualScore: number,
  teamScore: number,
): number {
  const team = Math.max(TEAM_OBEDIENCE_MIN, Math.min(TEAM_OBEDIENCE_MAX, teamScore));
  return Math.max(0, Math.min(100, individualScore * (team / 100)));
}

// ─── Tier classifier ────────────────────────────────────────────────────────

/** Mapeia score 0-100 pra `ObedienceTier` consumido pela UI. */
export function classifyObedience(score: number): ObedienceTier {
  if (score >= 85) return 'critical_accept';
  if (score >= 60) return 'accept';
  if (score >= 40) return 'weak_accept';
  if (score >= 20) return 'refuse';
  return 'protest';
}

/** Fluxo completo — 1 chamada, 4 números, 1 tier. Útil no reducer. */
export function rollObedience(params: {
  intent: VoiceIntent;
  teamObedience: number;
  player: {
    attributes?: MatchPlayerAttributes;
    role?: 'gk' | 'def' | 'mid' | 'attack';
    slotId?: string;
    confianca?: number;
    fatigue?: number;
    tatico?: number;
    relacaoManager?: number;
  };
  /** Eficácia do assistente que relayed (0-100), opcional — se ausente usa 75. */
  assistantEffectiveness?: number;
}): { individualScore: number; effectiveScore: number; tier: ObedienceTier; skillMatch: number } {
  const skillMatch = computeSkillMatch(params.intent, params.player);
  const difficulty = INTENT_DIFFICULTY[params.intent] ?? 2;
  const individualScore = computeIndividualObedience({
    confianca: params.player.confianca ?? 70,
    fatigue: params.player.fatigue ?? 25,
    tatico: params.player.tatico ?? (params.player.attributes?.tatico ?? 55),
    relacaoManager: params.player.relacaoManager,
    skillMatch,
    difficulty,
  });
  const assistMul = (params.assistantEffectiveness ?? 75) / 100;
  // Assistente atua como ruído do relay: eff<50 reduz score.
  const postAssistant = individualScore * (0.5 + assistMul * 0.5);
  const effectiveScore = computeEffectiveObedience(postAssistant, params.teamObedience);
  const tier = classifyObedience(effectiveScore);
  return { individualScore, effectiveScore, tier, skillMatch };
}
