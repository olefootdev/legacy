/**
 * Frases aprendidas por confirmação do treinador — "Você quis dizer…? Sim".
 *
 * Armazena mapeamento `fraseNormalizada → intent`. A próxima vez que a mesma
 * frase aparecer, o parser resolve direto (antes dos regex de fábrica).
 *
 * Armazenamento em localStorage. Em `v2` pode sincronizar com Supabase via
 * uma tabela `manager_learned_phrases` pra persistir entre dispositivos.
 */

import type { VoiceIntent } from './types';

const STORAGE_KEY = 'olefoot_learned_voice_phrases_v1';
const MAX_ENTRIES = 200;

export interface LearnedPhrase {
  /** Frase inteira normalizada (lower, sem acentos). */
  phrase: string;
  /** Stem sem tokens de jogador/equipa — útil pra generalização. */
  stem: string;
  intent: VoiceIntent;
  /** Frase canônica que o parser reconhece — usada no re-submit. */
  canonicalPhrase: string;
  confirmCount: number;
  updatedAt: number;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function loadLearnedPhrases(): LearnedPhrase[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LearnedPhrase[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(list: LearnedPhrase[]): void {
  if (!isBrowser()) return;
  try {
    const trimmed = list
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota / privacy — ignora */
  }
}

/** Salva (ou incrementa) mapeamento frase→intent. */
export function saveLearnedPhrase(input: {
  phrase: string;
  stem: string;
  intent: VoiceIntent;
  canonicalPhrase: string;
}): void {
  const list = loadLearnedPhrases();
  const key = input.phrase;
  const existing = list.find((l) => l.phrase === key);
  if (existing) {
    existing.intent = input.intent;
    existing.stem = input.stem;
    existing.canonicalPhrase = input.canonicalPhrase;
    existing.confirmCount++;
    existing.updatedAt = Date.now();
    writeAll(list);
    return;
  }
  list.push({
    phrase: input.phrase,
    stem: input.stem,
    intent: input.intent,
    canonicalPhrase: input.canonicalPhrase,
    confirmCount: 1,
    updatedAt: Date.now(),
  });
  writeAll(list);
}

/**
 * Procura frase aprendida que case com a query.
 * Ordem: (1) match exato da frase; (2) match de stem.
 */
export function lookupLearned(
  phraseNormalized: string,
  stemNormalized: string,
): LearnedPhrase | null {
  const list = loadLearnedPhrases();
  const exact = list.find((l) => l.phrase === phraseNormalized);
  if (exact) return exact;
  const byStem = list.find((l) => l.stem && l.stem === stemNormalized);
  if (byStem) return byStem;
  return null;
}

export function clearLearnedPhrases(): void {
  if (!isBrowser()) return;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

/**
 * Hidrata o localStorage com o dicionário do Supabase.
 * Chamado ao montar o VoiceCommandPanel — faz merge preservando a maior
 * `confirmCount` / `updatedAt` entre local e remoto.
 */
export async function hydrateLearnedFromSupabase(): Promise<void> {
  if (!isBrowser()) return;
  try {
    const { fetchManagerLearnedPhrases } = await import('@/supabase/learnedPhrases');
    const remote = await fetchManagerLearnedPhrases();
    if (remote.length === 0) return;
    const local = loadLearnedPhrases();
    const byPhrase = new Map<string, LearnedPhrase>(local.map((l) => [l.phrase, l]));
    for (const r of remote) {
      const existing = byPhrase.get(r.phrase);
      const remoteUpdated = new Date(r.updated_at).getTime();
      if (!existing || remoteUpdated >= existing.updatedAt) {
        byPhrase.set(r.phrase, {
          phrase: r.phrase,
          stem: r.stem,
          intent: r.intent,
          canonicalPhrase: r.canonical_phrase,
          confirmCount: r.confirm_count,
          updatedAt: remoteUpdated,
        });
      }
    }
    writeAll(Array.from(byPhrase.values()));
  } catch (err) {
    console.warn('[learnedPhrases] hydrate failed:', err);
  }
}

/**
 * Envia `saveLearnedPhrase` para o Supabase (fire-and-forget).
 * Chamar depois da gravação local pra não bloquear o reenvio do comando.
 */
export async function syncLearnedPhraseToSupabase(input: {
  phrase: string;
  stem: string;
  intent: VoiceIntent;
  canonicalPhrase: string;
}): Promise<void> {
  try {
    const { upsertLearnedPhrase } = await import('@/supabase/learnedPhrases');
    await upsertLearnedPhrase(input);
  } catch (err) {
    console.warn('[learnedPhrases] sync failed:', err);
  }
}
