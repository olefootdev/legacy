/**
 * Cliente Supabase pra log de comandos de voz + gestão de profanity.
 */

import { getSupabase } from '@/supabase/client';
import type { PersonaAggregates } from '@/voiceCommand/persona';

export interface RecordVoiceCommandInput {
  matchId?: string | null;
  intent: string;
  targetPlayerId?: string | null;
  tier?: string | null;
  effectiveObedience?: number | null;
  individualObedience?: number | null;
  teamObedienceAtTime?: number | null;
  rawText: string;
  assistant?: string | null;
  minute: number;
}

export async function recordVoiceCommand(input: RecordVoiceCommandInput): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('record_voice_command', {
    p_match_id: input.matchId ?? null,
    p_intent: input.intent,
    p_target_player_id: input.targetPlayerId ?? null,
    p_tier: input.tier ?? null,
    p_effective_obedience: input.effectiveObedience ?? null,
    p_individual_obedience: input.individualObedience ?? null,
    p_team_obedience_at_time: input.teamObedienceAtTime ?? null,
    p_raw_text: input.rawText,
    p_assistant: input.assistant ?? null,
    p_minute: input.minute,
  });
  if (error) {
    console.warn('[voiceLog] record failed:', error.message);
    return null;
  }
  return (data as string) ?? null;
}

export async function fetchManagerPersona(userId?: string): Promise<PersonaAggregates | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_manager_persona', {
    p_user_id: userId ?? null,
  });
  if (error) {
    console.warn('[voiceLog] persona fetch failed:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return (row as PersonaAggregates) ?? null;
}

/**
 * Fetch direto dos comandos do manager — usado pra calcular distribuição
 * por categoria no `buildManagerPersona`.
 */
export async function fetchManagerCommandIntents(userId?: string, limit = 500): Promise<Record<string, number>> {
  const sb = getSupabase();
  if (!sb) return {};
  const uid = userId ?? (await sb.auth.getUser()).data.user?.id;
  if (!uid) return {};
  const { data, error } = await sb
    .from('manager_voice_commands')
    .select('intent')
    .eq('manager_id', uid)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[voiceLog] intents fetch failed:', error.message);
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const intent = (row as { intent: string }).intent;
    counts[intent] = (counts[intent] ?? 0) + 1;
  }
  return counts;
}

// ─── Admin — profanity ──────────────────────────────────────────────────────

export async function fetchProfanityWords(): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('profanity_words')
    .select('word')
    .eq('active', true)
    .order('added_at', { ascending: false });
  if (error) {
    console.warn('[voiceLog] profanity fetch failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => (r as { word: string }).word);
}

export async function adminAddProfanity(word: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.rpc('admin_add_profanity', { p_word: word });
  if (error) {
    console.warn('[voiceLog] admin add profanity failed:', error.message);
    return false;
  }
  return true;
}

export async function adminRemoveProfanity(word: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.rpc('admin_remove_profanity', { p_word: word });
  if (error) {
    console.warn('[voiceLog] admin remove profanity failed:', error.message);
    return false;
  }
  return true;
}
