/**
 * Parser inteligente de comandos de voz com:
 * - Fuzzy matching de nomes (Levenshtein distance)
 * - Inferência de alvo (portador da bola)
 * - Contexto de histórico ("de novo", "repete")
 * - Correção de transcrições erradas
 * - Sinônimos contextuais
 */

import type { PitchPlayerState } from '@/engine/types';
import type { VoiceIntent } from './types';
import { parseCoachCommand, type ParsedCommand } from '@/match/coachCommands';

export interface ParserContext {
  /** Jogadores no campo. */
  players: PitchPlayerState[];
  /** ID do portador da bola (se houver). */
  ballCarrierId?: string;
  /** Últimos 5 intents executados. */
  recentIntents: VoiceIntent[];
  /** Último comando completo (texto). */
  lastCommand?: string;
}

/**
 * Calcula distância de Levenshtein entre duas strings.
 * Usado para fuzzy matching de nomes.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substituição
          matrix[i]![j - 1]! + 1,     // inserção
          matrix[i - 1]![j]! + 1      // deleção
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

/**
 * Normaliza string para comparação (lowercase, sem acentos).
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

/**
 * Encontra jogador mais próximo por nome (fuzzy matching).
 * Retorna null se distância > 3 (muito diferente).
 */
export function findClosestPlayerName(
  nameToken: string,
  players: PitchPlayerState[],
): PitchPlayerState | null {
  if (!nameToken || players.length === 0) return null;

  const normalized = normalize(nameToken);
  let bestMatch: PitchPlayerState | null = null;
  let bestDistance = Infinity;

  for (const player of players) {
    const playerNorm = normalize(player.name);

    // Exact match
    if (playerNorm === normalized) {
      return player;
    }

    // Partial match (começa com)
    if (playerNorm.startsWith(normalized) || normalized.startsWith(playerNorm)) {
      return player;
    }

    // Fuzzy match
    const distance = levenshteinDistance(normalized, playerNorm);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = player;
    }
  }

  // Aceita se distância <= 3 (ex: "Adriano" vs "Adriana")
  return bestDistance <= 3 ? bestMatch : null;
}

/**
 * Extrai nomes de jogadores do transcript.
 * Procura por padrões: "@nome", "nome,", "o nome", etc.
 */
function extractPlayerNames(transcript: string): string[] {
  const normalized = normalize(transcript);
  const names: string[] = [];

  // Padrão 1: "@nome"
  const atMatches = transcript.match(/@(\w+)/g);
  if (atMatches) {
    names.push(...atMatches.map((m) => m.slice(1)));
  }

  // Padrão 2: "nome," ou "nome!"
  const punctMatches = normalized.match(/(\w+)[,!]/g);
  if (punctMatches) {
    names.push(...punctMatches.map((m) => m.slice(0, -1)));
  }

  // Padrão 3: "o <nome>" ou "a <nome>"
  const articleMatches = normalized.match(/\b[oa]\s+(\w+)/g);
  if (articleMatches) {
    names.push(...articleMatches.map((m) => m.split(/\s+/)[1]!));
  }

  return names;
}

/**
 * Detecta sinônimos de intents comuns.
 */
const INTENT_SYNONYMS: Record<string, VoiceIntent[]> = {
  // Chute
  'chuta': ['take_shot'],
  'finaliza': ['take_shot'],
  'manda': ['take_shot'],
  'bate': ['take_shot'],
  'arremata': ['take_shot'],

  // Drible
  'dribla': ['dribble_attempt'],
  'passa por': ['dribble_attempt'],
  'vai nele': ['dribble_attempt'],
  'enfrenta': ['dribble_attempt'],

  // Passe
  'passa': ['pass_to_player', 'quick_pass'],
  'toca': ['quick_pass'],
  'joga': ['pass_to_player'],

  // Cruzamento
  'cruza': ['cross_ball'],
  'levanta': ['cross_ball'],
  'bota na área': ['cross_ball'],

  // Marcação
  'marca': ['mark_player'],
  'cola': ['mark_player'],
  'gruda': ['mark_player'],
  'segura': ['mark_player', 'hold_ball'],

  // Pressão
  'pressiona': ['team_press_high'],
  'vai pra cima': ['team_press_high'],
  'aperta': ['team_press_high'],

  // Recuo
  'recua': ['team_retreat'],
  'volta': ['team_retreat'],
  'defende': ['team_retreat'],
};

/**
 * Detecta intent por sinônimos.
 */
function detectIntentBySynonyms(transcript: string): VoiceIntent | null {
  const normalized = normalize(transcript);

  for (const [keyword, intents] of Object.entries(INTENT_SYNONYMS)) {
    if (normalized.includes(keyword)) {
      return intents[0] ?? null;
    }
  }

  return null;
}

/**
 * Detecta comandos de repetição ("de novo", "repete", "mais uma vez").
 */
function isRepeatCommand(transcript: string): boolean {
  const normalized = normalize(transcript);
  return (
    normalized.includes('de novo') ||
    normalized.includes('repete') ||
    normalized.includes('mais uma vez') ||
    normalized.includes('outra vez')
  );
}

/**
 * Detecta comandos de cancelamento ("para", "cancela", "esquece").
 */
export function isCancelCommand(transcript: string): boolean {
  const normalized = normalize(transcript);
  return (
    normalized.includes('para') ||
    normalized.includes('cancela') ||
    normalized.includes('esquece') ||
    normalized.includes('deixa pra la')
  );
}

/**
 * Parse inteligente com contexto.
 */
export function parseWithContext(
  transcript: string,
  ctx: ParserContext,
): ParsedCommand | null {
  // 1. Detecta repetição
  if (isRepeatCommand(transcript) && ctx.lastCommand) {
    return parseCoachCommand(ctx.lastCommand);
  }

  // 2. Tenta parse normal primeiro
  let parsed = parseCoachCommand(transcript);

  // 3. Se falhou, tenta corrigir nomes com fuzzy matching
  if (!parsed) {
    const correctedTranscript = correctPlayerNames(transcript, ctx.players);
    if (correctedTranscript !== transcript) {
      parsed = parseCoachCommand(correctedTranscript);
    }
  }

  // 4. Se ainda falhou, tenta detectar intent por sinônimos
  if (!parsed) {
    const intent = detectIntentBySynonyms(transcript);
    if (intent) {
      // Infere alvo: portador da bola ou time todo
      const target = ctx.ballCarrierId
        ? ctx.players.find((p) => p.playerId === ctx.ballCarrierId)
        : null;

      if (target) {
        return {
          scope: 'player',
          target: target.name,
          message: transcript,
          raw: transcript,
        };
      } else {
        return {
          scope: 'team',
          message: transcript,
          raw: transcript,
        };
      }
    }
  }

  // 5. Se comando não tem alvo explícito, infere portador da bola
  if (parsed && !parsed.target && ctx.ballCarrierId) {
    const carrier = ctx.players.find((p) => p.playerId === ctx.ballCarrierId);
    if (carrier) {
      parsed.target = carrier.name;
      parsed.scope = 'player';
    }
  }

  return parsed;
}

/**
 * Corrige nomes de jogadores no transcript usando fuzzy matching.
 */
function correctPlayerNames(
  transcript: string,
  players: PitchPlayerState[],
): string {
  const names = extractPlayerNames(transcript);
  let corrected = transcript;

  for (const nameToken of names) {
    const match = findClosestPlayerName(nameToken, players);
    if (match && normalize(match.name) !== normalize(nameToken)) {
      // Substitui nome errado pelo correto
      corrected = corrected.replace(
        new RegExp(`\\b${nameToken}\\b`, 'gi'),
        match.name
      );
    }
  }

  return corrected;
}

/**
 * Calcula score de confiança do parse (0-100).
 * Usado pra decidir se mostra preview ou não.
 */
export function parseConfidence(
  transcript: string,
  parsed: ParsedCommand | null,
  ctx: ParserContext,
): number {
  if (!parsed) return 0;

  let score = 50; // Base

  // +20 se tem alvo explícito
  if (parsed.target) {
    score += 20;
  }

  // +15 se alvo é jogador válido
  if (parsed.target && ctx.players.some((p) => normalize(p.name) === normalize(parsed.target!))) {
    score += 15;
  }

  // +10 se comando é comum (histórico)
  if (ctx.recentIntents.length > 0) {
    score += 10;
  }

  // -20 se transcript é muito curto (<5 chars)
  if (transcript.length < 5) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}
