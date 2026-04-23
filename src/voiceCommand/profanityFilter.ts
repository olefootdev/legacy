/**
 * OLEFOOT — Profanity Filter (pt-BR).
 *
 * Fluxo:
 *   1. normaliza o transcript (lower, sem acento, sem pontuação)
 *   2. testa contra lista de termos proibidos (igualdade ou substring controlada)
 *   3. retorna `hits` — palavras detectadas
 *
 * O filtro é deliberadamente conservador: palavrões comuns PT-BR + variações óbvias.
 * Lista é **editável em runtime** via Supabase (tabela `profanity_words` no admin),
 * mas a lista base aqui garante que o sistema funcione mesmo sem rede.
 *
 * Uso pelo árbitro:
 *   - 1ª detecção na partida → AVISO (`referee_warning`)
 *   - 2ª detecção → VERMELHO no melhor jogador (`referee_red_language`)
 */

// Lista-base. Evita juntar variações óbvias, mas inclui as principais.
// Comentário deliberadamente técnico — este arquivo é o filtro do árbitro.
const BASE_PROFANITY_WORDS: readonly string[] = [
  // palavrões PT-BR base
  'porra',
  'caralho',
  'caralhos',
  'merda',
  'merdas',
  'bosta',
  'bostas',
  'foda',
  'fodase',
  'fodeu',
  'puta',
  'putas',
  'puto',
  'putos',
  'filho da puta',
  'fdp',
  'cacete',
  'cacetada',
  'arrombado',
  'arrombada',
  'viado',
  'veado',
  'bicha',
  'cuzao',
  'cuzão',
  'cu',
  'buceta',
  'bct',
  // insultos comuns
  'idiota',
  'imbecil',
  'otario',
  'otário',
  'burro',
  'babaca',
  'escroto',
  'desgracado',
  'desgraçado',
  // expressões
  'vai tomar no cu',
  'vai se fuder',
  'vai se foder',
  'vai a merda',
  'vai pra puta que pariu',
];

// ─── Normalização ───────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')                 // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')                    // remove tudo que não é letra/num/espaço
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Lista em runtime (mergea base + override do admin) ─────────────────────

let runtimeWords: string[] = BASE_PROFANITY_WORDS.map((w) => normalize(w));

/**
 * Substitui a lista em runtime (chamado após carregar `profanity_words` do Supabase).
 * A base permanece como fallback — novos termos são adicionados.
 */
export function setProfanityWords(words: string[]): void {
  const merged = new Set<string>(runtimeWords);
  for (const w of words) {
    const n = normalize(w);
    if (n.length >= 2) merged.add(n);
  }
  runtimeWords = Array.from(merged);
}

/** Retorna a lista ativa (base + overrides). Útil pra admin UI. */
export function getProfanityWords(): string[] {
  return [...runtimeWords];
}

// ─── Detecção ───────────────────────────────────────────────────────────────

export interface ProfanityHit {
  /** Palavra detectada (normalizada). */
  word: string;
  /** Índice do caractere no texto normalizado. */
  index: number;
}

/**
 * Escaneia o transcript e retorna TODAS as ocorrências.
 * Usa match de palavra completa (boundary ' ') pra evitar falsos positivos
 * (ex.: "putamba" não contém "puta" como palavra inteira).
 *
 * Para termos compostos (ex.: "filho da puta"), usa substring match — aí vem
 * com delimitadores de espaço nos dois lados pra coincidência exata.
 */
export function scanProfanity(transcript: string): ProfanityHit[] {
  const norm = normalize(transcript);
  if (!norm) return [];
  const padded = ` ${norm} `;                       // simplifica boundary
  const hits: ProfanityHit[] = [];
  for (const word of runtimeWords) {
    const padWord = ` ${word} `;
    let cursor = 0;
    while (true) {
      const ix = padded.indexOf(padWord, cursor);
      if (ix < 0) break;
      hits.push({ word, index: ix });
      cursor = ix + padWord.length;
    }
  }
  return hits;
}

/** Atalho booleano — true se achou qualquer palavra. */
export function hasProfanity(transcript: string): boolean {
  return scanProfanity(transcript).length > 0;
}

/** Testing helpers. */
export const __testing = { normalize };
