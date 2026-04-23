/**
 * Guesser de intent quando o parser determinístico falha.
 *
 * Estratégia:
 *   1. Normaliza a frase.
 *   2. Para cada intent, conta quantas palavras-chave do dicionário aparecem.
 *   3. Detecta nome de jogador via fuzzy match contra o roster.
 *   4. Combina score de intent + boost se tiver jogador.
 *   5. Devolve sugestão (intent + target + frase canônica pra UI).
 *
 * O Guesser é usado na UI pra oferecer "Você quis dizer X?" e, ao confirmar,
 * salvar a frase no `learnedPhrases`.
 */

import type { CommandTarget, VoiceIntent } from './types';
import { INTENT_ASSISTANT } from './types';
import type { MatchRosterContext } from './intentMatcher';
import { __testing } from './intentMatcher';
import { stemPt } from './stemPt';

const { normalize, fuzzyMatch } = __testing;

/** Dicionário de palavras-chave (stems normalizados) por intent. */
const INTENT_HINTS: Partial<Record<VoiceIntent, string[]>> = {
  pass_to_player:  ['passa', 'passe', 'toca', 'tabela', 'aciona', 'acione', 'lanca', 'lança', 'serve', 'entrega', 'mete', 'liga', 'da\\s+a\\s+bola', 'da\\s+bola', 'oferece'],
  take_shot:       ['chuta', 'chute', 'finaliza', 'bate', 'arrisca', 'atira', 'pega\\s+pro\\s+gol', 'manda\\s+ver'],
  dribble_attempt: ['drible', 'dribla', 'enfia', 'encara', 'passa\\s+por', 'vai\\s+em\\s+cima'],
  cross_ball:      ['cruza', 'cruzamento', 'levanta', 'lanca\\s+pra\\s+area', 'bota\\s+na\\s+area'],
  invade_box:      ['invade', 'penetra', 'ataca\\s+a\\s+area', 'chega\\s+na\\s+area'],
  hold_ball:       ['segura', 'guarda', 'segura\\s+a\\s+bola', 'retem'],
  hold_small_area: ['pequena', 'na\\s+pequena'],
  break_line:      ['quebra\\s+a?\\s*linha', 'fura'],
  run_behind:      ['pelas?\\s+costas', 'por\\s+tras', 'rasga'],
  stretch_team:    ['estica', 'alarga', 'abre\\s+o\\s+jogo'],
  left_back_overlap: ['sobe\\s+o\\s+lateral', 'lateral\\s+sobe'],
  laterals_cross:  ['laterais\\s+cruza', 'aciona\\s+a?\\s*lateral', 'lateral\\s+cruza'],

  team_press_high: ['pressiona', 'pressao', 'press', 'marca\\s+alto', 'sufoca'],
  team_retreat:    ['recua', 'recuar', 'volta', 'todos?\\s+atras', 'defende'],
  team_hold_possession: ['mata\\s+o\\s+jogo', 'mantem', 'segura\\s+o\\s+jogo', 'posse'],
  team_high_line:  ['sobe\\s+o\\s+time', 'linha\\s+alta'],
  pedal_to_metal:  ['acelera', 'corre', 'forca', 'pisa\\s+no\\s+acelerador', 'no\\s+talo', 'tudo\\s+pra\\s+frente'],
  quick_pass:      ['toque\\s+rapido', 'toca\\s+rapido', 'passe\\s+rapido'],
  switch_play:     ['troca\\s+de\\s+lado', 'inverte'],
  mark_player:     ['marca', 'cola', 'pega\\s+o'],
  block_advance:   ['fecha\\s+o', 'segura\\s+o\\s+cara'],
  aggressive_tackle: ['entra\\s+duro', 'divida\\s+forte'],
  tactical_foul:   ['faz\\s+falta', 'falta\\s+tatica', 'para\\s+com\\s+falta'],
  free_play:       ['se\\s+vira', 'joga\\s+livre', 'improvisa'],
  wait_support:    ['espera', 'aguarda\\s+apoio'],
  calm_team:       ['acalma', 'respira', 'calma'],
  forwards_press_defenders: ['atacantes?\\s+pressiona', 'ataque\\s+pressao'],
  midfielders_compact: ['meio\\s+compacto', 'meias?\\s+fecha'],
  spare_player:    ['poupa', 'desacelera'],
};

export interface GuessResult {
  intent: VoiceIntent;
  target: CommandTarget;
  /** Nome do jogador resolvido (pra UI: "…pro Felipe"). */
  playerName?: string;
  /** Confiança 0-1. */
  confidence: number;
  /** Frase canônica que vamos efetivamente mandar ao parser (ex: "passa pro felipe"). */
  canonicalPhrase: string;
  /** Stem pra salvar aprendizado (frase sem nome de jogador). */
  stem: string;
}

const PLAYER_STOP_TOKENS = new Set([
  'aciona', 'passa', 'toca', 'lanca', 'lança', 'serve', 'entrega', 'mete', 'da', 'dá',
  'chuta', 'bate', 'arrisca', 'finaliza', 'atira', 'drible', 'dribla', 'cruza',
  'invade', 'marca', 'cola', 'pega', 'recua', 'sobe', 'acelera',
  'mais', 'menos', 'muito', 'pouco', 'agora', 'ja', 'já',
  'pro', 'pra', 'para', 'pelo', 'pela', 'com', 'sem', 'no', 'na', 'nos', 'nas',
  'de', 'do', 'da', 'dos', 'das', 'em', 'que', 'se', 'um', 'uma', 'uns', 'umas',
  'o', 'a', 'os', 'as', 'e', 'ou', 'ai', 'aí', 'la', 'lá',
  'lateral', 'laterais', 'meio', 'campo', 'area', 'área', 'bola', 'jogo',
  'esquerda', 'direita', 'frente', 'tras', 'trás',
]);

function detectPlayer(normalized: string, ctx: MatchRosterContext): { id: string; name: string } | null {
  const tokens = normalized.split(' ').filter((t) => t.length >= 3 && !PLAYER_STOP_TOKENS.has(t));
  for (const tok of tokens) {
    for (const p of ctx.homePlayers) {
      if (fuzzyMatch(tok, p.name)) return { id: p.playerId, name: p.name };
    }
  }
  return null;
}

// Cache de stems dos hints — computados uma vez, reutilizados por frase.
const STEMMED_HINTS: Partial<Record<VoiceIntent, string[]>> = {};
function stemmedHintsFor(intent: VoiceIntent): string[] {
  const cached = STEMMED_HINTS[intent];
  if (cached) return cached;
  const raw = INTENT_HINTS[intent] ?? [];
  const stems = raw.map((h) => {
    // Hint pode ser "passa" (single word) ou "pisa\\s+no\\s+acelerador" (multi).
    if (h.includes('\\s+')) return h; // multi-token: mantém regex original
    return stemPt(h);
  });
  STEMMED_HINTS[intent] = stems;
  return stems;
}

function scoreIntent(normalized: string, intent: VoiceIntent): number {
  const hints = stemmedHintsFor(intent);
  if (hints.length === 0) return 0;
  // Tokens da frase em stem.
  const tokensStem = normalized.split(' ').map(stemPt);
  const joinedStem = tokensStem.join(' ');
  let matches = 0;
  for (const h of hints) {
    if (h.includes('\\s+')) {
      // Multi-token regex — roda contra a frase normalizada (sem stem)
      // porque sequências ("pisa no acelerador") não sobrevivem ao stem.
      if (new RegExp(`\\b${h}\\b`).test(normalized)) matches++;
      continue;
    }
    if (tokensStem.includes(h)) matches++;
    // fallback: substring do stem (ex.: hint "acion" dentro de "aciona" stemado "acion")
    else if (h.length >= 4 && joinedStem.includes(h)) matches++;
  }
  return matches;
}

function buildStem(normalized: string, playerName?: string): string {
  if (!playerName) return normalized;
  const tokens = normalized.split(' ');
  const firstName = normalize(playerName.split(' ')[0] ?? playerName);
  return tokens.filter((t) => !fuzzyMatch(t, firstName)).join(' ').trim();
}

function canonicalFor(intent: VoiceIntent, playerName?: string): string {
  const first = playerName ? (playerName.split(' ')[0] ?? playerName).toLowerCase() : null;
  switch (intent) {
    case 'pass_to_player':   return first ? `passa pro ${first}` : 'toca rapido';
    case 'take_shot':        return first ? `${first} chuta` : 'chuta';
    case 'dribble_attempt':  return first ? `${first} dribla` : 'tenta o drible';
    case 'cross_ball':       return first ? `${first} cruza` : 'cruza a bola';
    case 'invade_box':       return first ? `${first} invade a area` : 'invade a area';
    case 'hold_ball':        return first ? `${first} segura a bola` : 'segura a bola';
    case 'mark_player':      return first ? `marca o ${first}` : 'marca alto';
    case 'team_press_high':  return 'pressiona alto';
    case 'team_retreat':     return 'recua';
    case 'team_hold_possession': return 'mata o jogo';
    case 'team_high_line':   return 'sobe o time';
    case 'pedal_to_metal':   return 'pisa no acelerador';
    case 'calm_team':        return 'acalma o time';
    case 'laterals_cross':   return 'laterais cruza mais';
    case 'break_line':       return first ? `${first} quebra a linha` : 'quebra a linha';
    case 'run_behind':       return first ? `${first} corre pelas costas` : 'corre pelas costas';
    case 'free_play':        return 'se vira';
    case 'quick_pass':       return 'toque rapido';
    default:                 return INTENT_ASSISTANT[intent] ? intent : intent;
  }
}

function targetFor(intent: VoiceIntent, playerId?: string): CommandTarget {
  if (playerId) return { kind: 'player_id', playerId };
  switch (intent) {
    case 'team_press_high':
    case 'team_retreat':
    case 'team_hold_possession':
    case 'team_high_line':
    case 'pedal_to_metal':
    case 'calm_team':
    case 'quick_pass':
      return { kind: 'team' };
    case 'invade_box':
    case 'break_line':
    case 'stretch_team':
      return { kind: 'role', role: 'attack' };
    case 'cross_ball':
    case 'laterals_cross':
    case 'mark_player':
      return { kind: 'role', role: 'def' };
    default:
      return { kind: 'ball_carrier' };
  }
}

/**
 * Tenta adivinhar intent a partir de frase não reconhecida.
 * Devolve null se confiança for muito baixa (não empurra sugestão ruim).
 */
export function guessCommand(raw: string, ctx: MatchRosterContext): GuessResult | null {
  const normalized = normalize(raw);
  if (!normalized) return null;
  const player = detectPlayer(normalized, ctx);

  let bestIntent: VoiceIntent | null = null;
  let bestScore = 0;
  for (const intent of Object.keys(INTENT_HINTS) as VoiceIntent[]) {
    const sc = scoreIntent(normalized, intent);
    if (sc > bestScore) {
      bestScore = sc;
      bestIntent = intent;
    }
  }

  // Sem palavra-chave mas com jogador → assume pass_to_player (caso típico "o felipe ali").
  if (!bestIntent && player) {
    bestIntent = 'pass_to_player';
    bestScore = 1;
  }
  if (!bestIntent) return null;

  // Confiança: 1 keyword = 0.55, 2 = 0.85; + 0.15 se tem player pra intent que usa player.
  let confidence = Math.min(0.95, 0.3 + bestScore * 0.3);
  const usesPlayer = ['pass_to_player', 'take_shot', 'dribble_attempt', 'cross_ball', 'mark_player', 'invade_box', 'hold_ball', 'break_line', 'run_behind'].includes(bestIntent);
  if (usesPlayer && player) confidence = Math.min(0.99, confidence + 0.15);
  if (confidence < 0.45) return null;

  const canonical = canonicalFor(bestIntent, player?.name);
  const stem = buildStem(normalized, player?.name);
  return {
    intent: bestIntent,
    target: targetFor(bestIntent, player?.id),
    playerName: player?.name,
    confidence,
    canonicalPhrase: canonical,
    stem,
  };
}

/** Label PT-BR da intenção pra UI de confirmação. */
export function intentLabelPt(intent: VoiceIntent): string {
  const map: Record<string, string> = {
    pass_to_player: 'Toca a bola pro jogador',
    take_shot: 'Finaliza',
    dribble_attempt: 'Tenta o drible',
    cross_ball: 'Cruza a bola',
    invade_box: 'Invade a área',
    hold_ball: 'Segura a bola',
    mark_player: 'Marca o jogador',
    team_press_high: 'Pressiona alto',
    team_retreat: 'Recua o bloco',
    team_hold_possession: 'Mata o jogo',
    team_high_line: 'Sobe a linha',
    pedal_to_metal: 'Acelera o jogo',
    calm_team: 'Acalma o time',
    laterals_cross: 'Laterais cruzam mais',
    break_line: 'Quebra a linha',
    run_behind: 'Corre pelas costas',
    free_play: 'Joga livre',
    quick_pass: 'Passa rápido',
    hold_small_area: 'Segura na pequena área',
    stretch_team: 'Estica o time',
    left_back_overlap: 'Lateral esquerdo sobe',
    switch_play: 'Troca de lado',
    block_advance: 'Fecha o avanço',
    aggressive_tackle: 'Divide forte',
    tactical_foul: 'Falta tática',
    wait_support: 'Espera o apoio',
    forwards_press_defenders: 'Atacantes pressionam',
    midfielders_compact: 'Meio compacto',
    spare_player: 'Poupa o jogador',
  };
  return map[intent] ?? intent;
}
