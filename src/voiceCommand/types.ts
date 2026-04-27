/**
 * OLEFOOT — Voice Command System
 * Tipos compartilhados entre parser, assistentes, fila e UI.
 *
 * O comando do manager viaja por 3 camadas:
 *   1. Parser → `ParsedCommand` (ou vários, se composto)
 *   2. Assistente filtra (eficácia) → `RelayedCommand`
 *   3. Motor injeta na fila do jogador → `PendingCommand`
 *   4. Jogador rola obediência → `CommandResolution`
 */

import type { FormationSchemeId } from '@/match-engine/types';

// ─── Intents ────────────────────────────────────────────────────────────────

/** Todas as intenções reconhecidas pelo parser. */
export type VoiceIntent =
  // Individual (ação sobre 1 jogador nomeado ou o portador da bola)
  | 'invade_box'              // "Adrien, invade a grande área"
  | 'dribble_attempt'         // "Tenta o drible" / "Passa por ele"
  | 'take_shot'               // "Chuta" / "Finaliza"
  | 'cross_ball'              // "Cruza mais" / "Cruza a bola"
  | 'pass_to_player'          // "Passa pro Gui"
  | 'hold_ball'               // "Segura a bola"
  | 'quick_pass'              // "Toca rápido"
  | 'switch_play'             // "Troca de lado"
  | 'mark_player'             // "Marca o 10"
  | 'block_advance'           // "Segura ele"
  | 'aggressive_tackle'       // "Entra com tudo"
  | 'tactical_foul'           // "Faz falta no 10"

  // Coletivo (time todo ou linha)
  | 'team_press_high'         // "Pressiona alto"
  | 'team_retreat'            // "Recua" / "Volta pra defesa"
  | 'team_hold_possession'    // "Segura a bola" / "Mata o jogo"
  | 'team_high_line'          // "Sobe o time"
  | 'forwards_press_defenders'// "Atacantes, pressionem os zagueiros"
  | 'midfielders_compact'     // "Meias fecham o meio"
  | 'laterals_cross'          // "Laterais cruzam mais"
  | 'left_back_overlap'       // "Sobe o lateral esquerdo"

  // Criativos (exclusivos de voz)
  | 'break_line'              // "Quebra a linha" / "Vai até a pequena"
  | 'break_zone'              // "Quebra a zona"
  | 'run_behind'              // "Corre pelas costas"
  | 'pedal_to_metal'          // "Pisa no acelerador"
  | 'free_play'               // "Se vira"
  | 'wait_support'            // "Espera a chegada"
  | 'stretch_team'            // "Estica o time"
  | 'hold_small_area'         // "Vai pra pequena e se segura"

  // Físico / Mental
  | 'spare_player'            // "Poupa o Palhinha"
  | 'calm_team'               // "Acalma o time"

  // Táticos — substituição e formação
  | 'player_substitution'     // "Sai Adrien entra Gui"
  | 'formation_change'        // "Muda pra 4-3-3"

  // Árbitro (disparado por profanity, não pelo parser direto)
  | 'referee_warning'
  | 'referee_red_language';

/** Família do comando — usa na UI pra agrupar, colorir, e rotear assistente. */
export type IntentCategory =
  | 'individual'
  | 'collective'
  | 'tactical'
  | 'creative'
  | 'aggressive'
  | 'substitution'
  | 'formation'
  | 'meta';

/** Mapa Intent → Categoria. */
export const INTENT_CATEGORY: Record<VoiceIntent, IntentCategory> = {
  invade_box: 'individual',
  dribble_attempt: 'individual',
  take_shot: 'individual',
  cross_ball: 'individual',
  pass_to_player: 'individual',
  hold_ball: 'individual',
  quick_pass: 'individual',
  switch_play: 'individual',
  mark_player: 'individual',
  block_advance: 'individual',
  aggressive_tackle: 'aggressive',
  tactical_foul: 'aggressive',
  team_press_high: 'collective',
  team_retreat: 'collective',
  team_hold_possession: 'collective',
  team_high_line: 'collective',
  forwards_press_defenders: 'collective',
  midfielders_compact: 'collective',
  laterals_cross: 'collective',
  left_back_overlap: 'tactical',
  break_line: 'creative',
  break_zone: 'creative',
  run_behind: 'creative',
  pedal_to_metal: 'creative',
  free_play: 'creative',
  wait_support: 'creative',
  stretch_team: 'creative',
  hold_small_area: 'creative',
  spare_player: 'meta',
  calm_team: 'meta',
  player_substitution: 'substitution',
  formation_change: 'formation',
  referee_warning: 'meta',
  referee_red_language: 'meta',
};

// ─── Assistentes ────────────────────────────────────────────────────────────

export type AssistantRole = 'tatico' | 'ataque' | 'defesa' | 'fisico' | 'mental';

export const ASSISTANT_LABEL: Record<AssistantRole, string> = {
  tatico: 'Auxiliar Tático',
  ataque: 'Auxiliar de Ataque',
  defesa: 'Auxiliar Defensivo',
  fisico: 'Preparador Físico',
  mental: 'Preparador Mental',
};

export const ASSISTANT_GLYPH: Record<AssistantRole, string> = {
  tatico: '🧠',
  ataque: '⚔️',
  defesa: '🛡️',
  fisico: '💪',
  mental: '🧘',
};

/** Roteamento default: cada intent chega ao assistente responsável. */
export const INTENT_ASSISTANT: Record<VoiceIntent, AssistantRole> = {
  // Individual ofensivo
  invade_box: 'ataque',
  dribble_attempt: 'ataque',
  take_shot: 'ataque',
  cross_ball: 'ataque',
  pass_to_player: 'ataque',
  hold_ball: 'tatico',
  quick_pass: 'ataque',
  switch_play: 'tatico',
  // Individual defensivo
  mark_player: 'defesa',
  block_advance: 'defesa',
  aggressive_tackle: 'defesa',
  tactical_foul: 'defesa',
  // Coletivos
  team_press_high: 'tatico',
  team_retreat: 'tatico',
  team_hold_possession: 'tatico',
  team_high_line: 'tatico',
  forwards_press_defenders: 'tatico',
  midfielders_compact: 'tatico',
  laterals_cross: 'ataque',
  left_back_overlap: 'tatico',
  // Criativos
  break_line: 'ataque',
  break_zone: 'tatico',
  run_behind: 'ataque',
  pedal_to_metal: 'fisico',
  free_play: 'tatico',
  wait_support: 'tatico',
  stretch_team: 'tatico',
  hold_small_area: 'ataque',
  // Meta
  spare_player: 'fisico',
  calm_team: 'mental',
  // Administrativos
  player_substitution: 'tatico',
  formation_change: 'tatico',
  // Árbitro (não rotea)
  referee_warning: 'tatico',
  referee_red_language: 'tatico',
};

// ─── Estrutura do comando ───────────────────────────────────────────────────

/** Alvo do comando — pode ser jogador específico, linha inteira ou time. */
export type CommandTarget =
  | { kind: 'player_id'; playerId: string }
  | { kind: 'player_name'; nameToken: string }   // parser ainda não resolveu
  | { kind: 'shirt_number'; number: number }
  | { kind: 'role'; role: 'gk' | 'def' | 'mid' | 'attack' }
  | { kind: 'slot'; slotId: string }
  | { kind: 'team' }
  | { kind: 'ball_carrier' };                    // "o portador da bola"

/** Comando produzido pelo parser antes de resolver alvos. */
export interface ParsedCommand {
  intent: VoiceIntent;
  target: CommandTarget;
  /** Alvo secundário (ex: "faz falta NO 10" → primary=tackler, secondary=vítima). */
  secondaryTarget?: CommandTarget;
  /** Substituição tem 2 alvos obrigatórios. */
  substitutionInfo?: {
    out: CommandTarget;
    in: CommandTarget;
  };
  /** Formation change carrega o esquema alvo. */
  formationTarget?: FormationSchemeId;
  /** Transcript bruto que originou o comando (debug + log). */
  rawText: string;
  /** Posição da frase no transcript (pra comando composto). */
  fragmentIndex: number;
}

/** Comando após passar pelo assistente (relay). */
export interface RelayedCommand extends ParsedCommand {
  assistant: AssistantRole;
  /** Eficácia aplicada (0–100). */
  assistantEffectiveness: number;
  /** Resultado do relay. */
  relayQuality: 'clean' | 'basic' | 'partial_loss' | 'distorted';
  /** Narração gerada pelo assistente pro feed. */
  relayNarrative: string;
}

/** Comando na fila do jogador (injetado no AgentEx no motor tático). */
export interface PendingCommand {
  intent: VoiceIntent;
  issuedAt: number;               // world.simTime
  expiresAt: number;               // world.simTime + duration
  urgency: 'normal' | 'high';
  /** Eficácia composta (time × assistente × individual). */
  effectiveObedience: number;     // 0–100
  /** Tier gerado pelo obedienceRoll — usado pra balão. */
  tier: ObedienceTier;
  /** Payload específico do intent (ex: shirt number do alvo pra marcar). */
  payload?: Record<string, unknown>;
}

// ─── Obediência ─────────────────────────────────────────────────────────────

export type ObedienceTier =
  | 'critical_accept'   // ≥85 · "DEIXA COMIGO!"
  | 'accept'            // 60–85 · "Vou fazer"
  | 'weak_accept'       // 40–60 · "Vou tentar"
  | 'refuse'            // 20–40 · ignora silenciosamente
  | 'protest';          // <20 · "NÃO POSSO" com tremor

export const OBEDIENCE_TIER_BUBBLE: Record<ObedienceTier, string> = {
  critical_accept: 'DEIXA COMIGO!',
  accept: 'Vou fazer',
  weak_accept: 'Vou tentar',
  refuse: 'Tá difícil...',
  protest: 'NÃO POSSO',
};

export const OBEDIENCE_TIER_COLOR: Record<ObedienceTier, string> = {
  critical_accept: 'green',
  accept: 'yellow',
  weak_accept: 'orange',
  refuse: 'red',
  protest: 'red',
};

/** Resolução final quando o jogador terminou (ou recusou) o comando. */
export interface CommandResolution {
  intent: VoiceIntent;
  playerId: string;
  outcome: 'success' | 'partial' | 'failure' | 'refused' | 'protested';
  durationMs: number;
  narrative: string;
}

// ─── Dificuldade e skill-match por intent ──────────────────────────────────

/** Dificuldade base do comando (1 = trivial, 5 = heroico). Usada no obedienceRoll. */
export const INTENT_DIFFICULTY: Record<VoiceIntent, number> = {
  invade_box: 2,
  dribble_attempt: 3,
  take_shot: 2,
  cross_ball: 2,
  pass_to_player: 1,
  hold_ball: 2,
  quick_pass: 1,
  switch_play: 2,
  mark_player: 2,
  block_advance: 2,
  aggressive_tackle: 4,
  tactical_foul: 4,
  team_press_high: 2,
  team_retreat: 1,
  team_hold_possession: 1,
  team_high_line: 2,
  forwards_press_defenders: 3,
  midfielders_compact: 2,
  laterals_cross: 2,
  left_back_overlap: 3,
  break_line: 4,
  break_zone: 4,
  run_behind: 4,
  pedal_to_metal: 3,
  free_play: 3,
  wait_support: 2,
  stretch_team: 3,
  hold_small_area: 3,
  spare_player: 1,
  calm_team: 1,
  player_substitution: 1,
  formation_change: 1,
  referee_warning: 1,
  referee_red_language: 1,
};

/**
 * Duração (ms) que `pendingCommand` fica ativo no jogador — depois disso volta
 * ao comportamento default. Comandos criativos duram mais.
 */
export const INTENT_DURATION_MS: Record<VoiceIntent, number> = {
  invade_box: 8_000,
  dribble_attempt: 5_000,
  take_shot: 3_000,
  cross_ball: 4_000,
  pass_to_player: 4_000,
  hold_ball: 5_000,
  quick_pass: 3_000,
  switch_play: 4_000,
  mark_player: 12_000,
  block_advance: 8_000,
  aggressive_tackle: 6_000,
  tactical_foul: 6_000,
  team_press_high: 20_000,
  team_retreat: 20_000,
  team_hold_possession: 20_000,
  team_high_line: 20_000,
  forwards_press_defenders: 15_000,
  midfielders_compact: 15_000,
  laterals_cross: 10_000,
  left_back_overlap: 10_000,
  break_line: 12_000,
  break_zone: 10_000,
  run_behind: 8_000,
  pedal_to_metal: 15_000,
  free_play: 8_000,
  wait_support: 5_000,
  stretch_team: 12_000,
  hold_small_area: 10_000,
  spare_player: 30_000,
  calm_team: 30_000,
  player_substitution: 0,       // one-shot (não fica em pendingCommand)
  formation_change: 0,          // one-shot
  referee_warning: 0,
  referee_red_language: 0,
};
