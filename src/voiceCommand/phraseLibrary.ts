/**
 * OLEFOOT — Phrase Library Integration
 *
 * Integra a tabela `football_vocabulary` do Supabase com o parser de voz.
 * Carrega frases do vocabulário do futebol e faz matching fuzzy com comandos de voz.
 */

import { getSupabase } from '@/supabase/client';
import type { VoiceIntent } from './types';

export interface LearnedPhrase {
  id: string;
  phrase: string;
  stem: string;
  intent: VoiceIntent;
  canonical_phrase: string;
  confirm_count: number;
  region?: string;
  language_type?: string;
  context?: string;
  formality_level?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

let cachedPhrases: LearnedPhrase[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Carrega frases ativas da biblioteca.
 * Usa cache de 5 minutos para evitar queries repetidas.
 */
export async function loadPhraseLibrary(): Promise<LearnedPhrase[]> {
  const now = Date.now();
  if (cachedPhrases.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedPhrases;
  }

  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('football_vocabulary')
    .select('*')
    .eq('is_active', true)
    .order('confirm_count', { ascending: false });

  if (error) {
    console.error('[phraseLibrary] Erro ao carregar frases:', error);
    return cachedPhrases; // retorna cache antigo em caso de erro
  }

  cachedPhrases = data || [];
  lastFetchTime = now;
  return cachedPhrases;
}

/**
 * Normaliza texto para matching: lowercase, remove acentos, trim.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .trim();
}

/**
 * Calcula similaridade entre duas strings (0.0 a 1.0).
 * Usa Levenshtein distance normalizada.
 */
function similarity(a: string, b: string): number {
  const aNorm = normalize(a);
  const bNorm = normalize(b);

  if (aNorm === bNorm) return 1.0;

  const matrix: number[][] = [];
  const n = aNorm.length;
  const m = bNorm.length;

  if (n === 0) return m === 0 ? 1.0 : 0.0;
  if (m === 0) return 0.0;

  // Inicializa matriz
  for (let i = 0; i <= n; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= m; j++) {
    matrix[0][j] = j;
  }

  // Calcula distância
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = aNorm[i - 1] === bNorm[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[n][m];
  const maxLen = Math.max(n, m);
  return 1.0 - distance / maxLen;
}

/**
 * Busca a melhor frase correspondente ao texto de entrada.
 * Retorna null se nenhuma frase tiver similaridade >= threshold.
 */
export async function matchPhrase(
  input: string,
  threshold = 0.7
): Promise<{ phrase: LearnedPhrase; similarity: number } | null> {
  const phrases = await loadPhraseLibrary();
  if (phrases.length === 0) return null;

  const inputNorm = normalize(input);
  let bestMatch: { phrase: LearnedPhrase; similarity: number } | null = null;

  for (const phrase of phrases) {
    const sim = similarity(inputNorm, phrase.phrase);
    // Usa confirm_count como peso de confiança (normalizado)
    const confidence = Math.min(phrase.confirm_count / 10, 1.0);
    const adjustedSim = sim * (0.7 + confidence * 0.3); // 70% similaridade + 30% confiança

    if (adjustedSim >= threshold) {
      if (!bestMatch || adjustedSim > bestMatch.similarity) {
        bestMatch = { phrase, similarity: adjustedSim };
      }
    }
  }

  return bestMatch;
}

/**
 * Busca múltiplas frases correspondentes (top N).
 */
export async function matchPhrases(
  input: string,
  topN = 3,
  threshold = 0.6
): Promise<Array<{ phrase: LearnedPhrase; similarity: number }>> {
  const phrases = await loadPhraseLibrary();
  if (phrases.length === 0) return [];

  const inputNorm = normalize(input);
  const matches: Array<{ phrase: LearnedPhrase; similarity: number }> = [];

  for (const phrase of phrases) {
    const sim = similarity(inputNorm, phrase.phrase);
    const confidence = Math.min(phrase.confirm_count / 10, 1.0);
    const adjustedSim = sim * (0.7 + confidence * 0.3);

    if (adjustedSim >= threshold) {
      matches.push({ phrase, similarity: adjustedSim });
    }
  }

  return matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);
}

/**
 * Incrementa contador de uso de uma frase.
 */
export async function incrementPhraseUsage(phraseId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  // Incrementa confirm_count na tabela football_vocabulary
  const { error } = await sb.rpc('increment_vocabulary_usage', {
    p_phrase_id: phraseId,
  });

  if (error) {
    console.error('[phraseLibrary] Erro ao incrementar uso:', error);
  }
}

/**
 * Busca frases por intent específico.
 */
export async function getPhrasesByIntent(intent: VoiceIntent): Promise<LearnedPhrase[]> {
  const phrases = await loadPhraseLibrary();
  return phrases.filter(p => p.intent === intent);
}

/**
 * Invalida cache (útil após adicionar/editar frases no admin).
 */
export function invalidatePhraseCache(): void {
  cachedPhrases = [];
  lastFetchTime = 0;
}
