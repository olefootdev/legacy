/**
 * Stemmer PT-BR minimalista — baseado em regras do RSLP (simplificado).
 * Objetivo: colapsar flexões verbais/nominais pro mesmo root, de forma que
 *   aciona / acionou / acionar / acionando → "acion"
 *   passa  / passou  / passar  / passando  → "pass"
 *   chuta  / chutou  / chutar  / chutando  → "chut"
 *   drible / dribla  / driblou / driblar   → "dribl"
 *
 * Não é um stemmer completo — apenas bom o bastante pra casamento de
 * palavras-chave em comandos de voz PT. Determinístico e sem dependências.
 */

// Lista de sufixos (ordenados por tamanho desc pra sempre casar o mais longo).
// Cada sufixo tem um tamanho mínimo do stem resultante pra evitar colapsos absurdos
// (ex.: "vai" → não deve virar "").
const SUFFIXES: Array<{ suf: string; minStem: number }> = [
  // Gerúndios
  { suf: 'ando', minStem: 3 },
  { suf: 'endo', minStem: 3 },
  { suf: 'indo', minStem: 3 },
  // Condicional / futuro
  { suf: 'aria',  minStem: 3 },
  { suf: 'eria',  minStem: 3 },
  { suf: 'iria',  minStem: 3 },
  { suf: 'ariam', minStem: 3 },
  { suf: 'eriam', minStem: 3 },
  { suf: 'iriam', minStem: 3 },
  // Imperfeito
  { suf: 'avam', minStem: 3 },
  { suf: 'iam',  minStem: 3 },
  { suf: 'ava',  minStem: 3 },
  { suf: 'iam',  minStem: 3 },
  { suf: 'ia',   minStem: 3 },
  // 1ª/2ª pessoa plural
  { suf: 'amos', minStem: 3 },
  { suf: 'emos', minStem: 3 },
  { suf: 'imos', minStem: 3 },
  { suf: 'avam', minStem: 3 },
  // Pretérito perfeito
  { suf: 'aram', minStem: 3 },
  { suf: 'eram', minStem: 3 },
  { suf: 'iram', minStem: 3 },
  { suf: 'ou',   minStem: 3 },
  { suf: 'eu',   minStem: 3 },
  { suf: 'iu',   minStem: 3 },
  { suf: 'ei',   minStem: 3 },
  // 3ª pessoa plural presente
  { suf: 'am', minStem: 3 },
  { suf: 'em', minStem: 3 },
  // Infinitivo
  { suf: 'ar',   minStem: 3 },
  { suf: 'er',   minStem: 3 },
  { suf: 'ir',   minStem: 3 },
  // Plural de substantivos/adjetivos
  { suf: 'oes',  minStem: 3 },
  { suf: 'aes',  minStem: 3 },
  { suf: 'is',   minStem: 3 },
  { suf: 'ns',   minStem: 3 },
  // Presente 1ª/3ª sing + nominais finais (aplicar por último, regra mais curta)
  { suf: 'a',    minStem: 3 },
  { suf: 'e',    minStem: 3 },
  { suf: 'i',    minStem: 3 },
  { suf: 'o',    minStem: 3 },
  { suf: 'u',    minStem: 3 },
  // Plural 's'
  { suf: 's',    minStem: 3 },
];

// Ordena uma vez por tamanho de sufixo desc.
const SUFFIXES_SORTED = [...SUFFIXES].sort((a, b) => b.suf.length - a.suf.length);

// Palavras curtas/funcionais que não devem ser stemmadas.
const STOP_TOKENS = new Set([
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'pro', 'pra', 'para', 'pelo', 'pela', 'com', 'sem', 'por', 'ao',
  'que', 'se', 'e', 'ou', 'mas', 'nem',
  'ja', 'la', 'ai', 'nao', 'sim',
  'vai', 'vem', 'foi', 'tem',
]);

/** Stem de uma palavra PT — normalizada (sem acentos, lower). */
export function stemPt(word: string): string {
  if (!word) return word;
  const w = word.toLowerCase();
  if (w.length <= 3) return w;
  if (STOP_TOKENS.has(w)) return w;

  for (const { suf, minStem } of SUFFIXES_SORTED) {
    if (w.length > suf.length + minStem - 1 && w.endsWith(suf)) {
      const candidate = w.slice(0, -suf.length);
      if (candidate.length >= minStem) return candidate;
    }
  }
  return w;
}

/** Stemma uma frase inteira, preservando espaços. */
export function stemPhrasePt(phrase: string): string {
  return phrase.split(/\s+/).map(stemPt).join(' ');
}
