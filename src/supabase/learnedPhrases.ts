/**
 * Cliente Supabase pro dicionário de frases aprendidas.
 *
 * Duas operações:
 *   - upsertLearnedPhrase → replica "Sim, é isso" do painel de voz
 *   - fetchManagerLearnedPhrases → hidrata localStorage ao entrar na partida
 */

import { getSupabase } from '@/supabase/client';
import type { VoiceIntent } from '@/voiceCommand/types';

export interface RemoteLearnedPhrase {
  id: string;
  manager_id: string;
  phrase: string;
  stem: string;
  intent: VoiceIntent;
  canonical_phrase: string;
  confirm_count: number;
  created_at: string;
  updated_at: string;
}

export async function upsertLearnedPhrase(input: {
  phrase: string;
  stem: string;
  intent: VoiceIntent;
  canonicalPhrase: string;
}): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.rpc('record_learned_phrase', {
    p_phrase: input.phrase,
    p_stem: input.stem,
    p_intent: input.intent,
    p_canonical_phrase: input.canonicalPhrase,
  });
  if (error) {
    console.warn('[learnedPhrases] upsert failed:', error.message);
    return false;
  }
  return true;
}

export async function fetchManagerLearnedPhrases(limit = 500): Promise<RemoteLearnedPhrase[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('get_manager_learned_phrases', {
    p_user_id: null,
    p_limit: limit,
  });
  if (error) {
    console.warn('[learnedPhrases] fetch failed:', error.message);
    return [];
  }
  return (data ?? []) as RemoteLearnedPhrase[];
}

// ─── Admin ──────────────────────────────────────────────────────────────

export interface TopLearnedPhraseRow {
  phrase: string;
  stem: string;
  intent: VoiceIntent;
  canonical_phrase: string;
  distinct_managers: number;
  total_confirms: number;
  last_confirmed_at: string;
}

export async function adminFetchTopLearnedPhrases(
  intent: VoiceIntent | null = null,
  limit = 100,
): Promise<TopLearnedPhraseRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('admin_top_learned_phrases', {
    p_limit: limit,
    p_intent: intent,
  });
  if (error) {
    console.warn('[learnedPhrases] admin fetch failed:', error.message);
    return [];
  }
  return (data ?? []) as TopLearnedPhraseRow[];
}

export async function adminDeleteLearnedPhrase(phrase: string): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const { data, error } = await sb.rpc('admin_delete_learned_phrase', { p_phrase: phrase });
  if (error) {
    console.warn('[learnedPhrases] admin delete failed:', error.message);
    return 0;
  }
  return (data as number) ?? 0;
}
