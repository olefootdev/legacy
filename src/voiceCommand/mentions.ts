/**
 * Mentions no input de texto do Comando Técnico:
 *   - `@adrien`  → força target = player_id do Adrien (fuzzy match)
 *   - `#defensivo` → força target = role=def
 *
 * Uso:
 *   const { cleanedPhrase, target } = extractMentions(text, roster);
 *   → envia `cleanedPhrase` ao parser, sobrescreve target se vier != null.
 *
 * Mentions são estritamente ponto de entrada do UI — depois do strip, o
 * parser tradicional continua a reconhecer o resto da frase.
 */

import type { CommandTarget } from './types';
import type { MatchRosterContext } from './intentMatcher';
import { __testing } from './intentMatcher';

const { normalize, fuzzyMatch } = __testing;

const SECTOR_ALIASES: Record<string, CommandTarget> = {
  // Defesa
  defesa:     { kind: 'role', role: 'def' },
  defensivo:  { kind: 'role', role: 'def' },
  defensiva:  { kind: 'role', role: 'def' },
  zaga:       { kind: 'role', role: 'def' },
  zagueiros:  { kind: 'role', role: 'def' },
  // Meio
  meio:        { kind: 'role', role: 'mid' },
  meias:       { kind: 'role', role: 'mid' },
  'meio-campo':{ kind: 'role', role: 'mid' },
  meiocampo:   { kind: 'role', role: 'mid' },
  volantes:    { kind: 'role', role: 'mid' },
  // Ataque
  ataque:     { kind: 'role', role: 'attack' },
  atacantes:  { kind: 'role', role: 'attack' },
  frente:     { kind: 'role', role: 'attack' },
  pontas:     { kind: 'role', role: 'attack' },
  // GK
  goleiro:    { kind: 'role', role: 'gk' },
  arqueiro:   { kind: 'role', role: 'gk' },
  // Equipa
  time:       { kind: 'team' },
  equipa:     { kind: 'team' },
  equipe:     { kind: 'team' },
  todos:      { kind: 'team' },
  // Laterais como slots
  'lateral-esquerdo': { kind: 'slot', slotId: 'le' },
  'lateral-direito':  { kind: 'slot', slotId: 'ld' },
  le: { kind: 'slot', slotId: 'le' },
  ld: { kind: 'slot', slotId: 'ld' },
};

/** Lista de setores pra autocomplete. */
export const SECTOR_SUGGESTIONS: { token: string; label: string; target: CommandTarget }[] = [
  { token: 'defensivo',        label: '🛡️ Defesa',        target: SECTOR_ALIASES.defensivo! },
  { token: 'meio',             label: '⚙️ Meio-campo',    target: SECTOR_ALIASES.meio! },
  { token: 'ataque',           label: '⚡ Ataque',         target: SECTOR_ALIASES.ataque! },
  { token: 'goleiro',          label: '🧤 Goleiro',        target: SECTOR_ALIASES.goleiro! },
  { token: 'time',             label: '👥 Time todo',      target: SECTOR_ALIASES.time! },
  { token: 'lateral-esquerdo', label: '↤ Lateral esquerdo', target: SECTOR_ALIASES['lateral-esquerdo']! },
  { token: 'lateral-direito',  label: '↦ Lateral direito',  target: SECTOR_ALIASES['lateral-direito']! },
];

const MENTION_RE = /([@#])([\wáéíóúâêôãõç-]+)/gi;

export interface MentionExtractResult {
  cleanedPhrase: string;
  /** Target preferido extraído da mention (primeira que casou). */
  target: CommandTarget | null;
  /** Nome resolvido se foi mention de jogador — útil pro feedback UX. */
  playerName?: string;
  /** Label legível do setor se foi #mention. */
  sectorLabel?: string;
}

export function extractMentions(raw: string, roster: MatchRosterContext): MentionExtractResult {
  let target: CommandTarget | null = null;
  let playerName: string | undefined;
  let sectorLabel: string | undefined;

  const cleaned = raw.replace(MENTION_RE, (_full, sigil: string, tokenRaw: string) => {
    const token = normalize(tokenRaw);
    if (sigil === '@') {
      for (const p of roster.homePlayers) {
        if (fuzzyMatch(token, p.name)) {
          if (!target) { target = { kind: 'player_id', playerId: p.playerId }; playerName = p.name; }
          return p.name;
        }
      }
      return tokenRaw;
    }
    if (sigil === '#') {
      const sector = SECTOR_ALIASES[token];
      if (sector) {
        if (!target) { target = sector; sectorLabel = prettySectorLabel(token); }
        return ''; // strip — o parser usa o target override, não precisa da palavra
      }
      return tokenRaw;
    }
    return tokenRaw;
  }).replace(/\s+/g, ' ').trim();

  return { cleanedPhrase: cleaned, target, playerName, sectorLabel };
}

function prettySectorLabel(token: string): string {
  const hit = SECTOR_SUGGESTIONS.find((s) => s.token === token);
  return hit?.label ?? token;
}

/**
 * Detecta a mention em edição no cursor (última `@xxx` ou `#xxx` incompleta).
 * Usado pelo autocomplete enquanto o treinador digita.
 */
export interface MentionEditState {
  kind: '@' | '#';
  query: string;
  /** Índice inicial da mention (posição do sigil). */
  start: number;
}

export function detectMentionAtCursor(value: string, cursor: number): MentionEditState | null {
  const before = value.slice(0, cursor);
  const match = before.match(/([@#])([\wáéíóúâêôãõç-]*)$/i);
  if (!match) return null;
  const start = cursor - match[0].length;
  return {
    kind: match[1] as '@' | '#',
    query: match[2] ?? '',
    start,
  };
}

/** Substitui a mention em edição pelo token completo. */
export function applyMentionCompletion(
  value: string,
  cursor: number,
  state: MentionEditState,
  replacementToken: string,
): { value: string; nextCursor: number } {
  const insertion = `${state.kind}${replacementToken} `;
  const next = value.slice(0, state.start) + insertion + value.slice(cursor);
  return { value: next, nextCursor: state.start + insertion.length };
}
