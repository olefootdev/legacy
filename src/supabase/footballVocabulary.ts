/**
 * Módulo de Vocabulário de Futebol
 * Gerencia a biblioteca global de comandos de voz PT-BR
 */

import { supabase } from './client';
import type { Database } from './database.types';

type FootballVocabularyRow = Database['public']['Tables']['football_vocabulary']['Row'];
type FootballVocabularyInsert = Database['public']['Tables']['football_vocabulary']['Insert'];
type FootballVocabularyUpdate = Database['public']['Tables']['football_vocabulary']['Update'];

export interface FootballVocabularyEntry {
  id: string;
  phrase: string;
  stem: string;
  intent: string;
  canonical_phrase: string;
  confirm_count: number;
  region: string;
  language_type: string;
  context: string;
  formality_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Busca todas as frases ativas do vocabulário
 */
export async function getAllActiveVocabulary(): Promise<FootballVocabularyEntry[]> {
  const { data, error } = await supabase
    .from('football_vocabulary')
    .select('*')
    .eq('is_active', true)
    .order('phrase', { ascending: true });

  if (error) {
    console.error('Erro ao buscar vocabulário:', error);
    return [];
  }

  return data as FootballVocabularyEntry[];
}

/**
 * Busca vocabulário por intent
 */
export async function getVocabularyByIntent(intent: string): Promise<FootballVocabularyEntry[]> {
  const { data, error } = await supabase
    .from('football_vocabulary')
    .select('*')
    .eq('intent', intent)
    .eq('is_active', true)
    .order('confirm_count', { ascending: false });

  if (error) {
    console.error('Erro ao buscar vocabulário por intent:', error);
    return [];
  }

  return data as FootballVocabularyEntry[];
}

/**
 * Busca vocabulário por região
 */
export async function getVocabularyByRegion(region: string): Promise<FootballVocabularyEntry[]> {
  const { data, error } = await supabase
    .from('football_vocabulary')
    .select('*')
    .eq('region', region)
    .eq('is_active', true)
    .order('phrase', { ascending: true });

  if (error) {
    console.error('Erro ao buscar vocabulário por região:', error);
    return [];
  }

  return data as FootballVocabularyEntry[];
}

/**
 * Busca uma frase específica
 */
export async function searchVocabularyPhrase(phrase: string): Promise<FootballVocabularyEntry | null> {
  const { data, error } = await supabase
    .from('football_vocabulary')
    .select('*')
    .eq('phrase', phrase.toLowerCase())
    .single();

  if (error) {
    console.error('Erro ao buscar frase:', error);
    return null;
  }

  return data as FootballVocabularyEntry;
}

/**
 * Adiciona nova entrada ao vocabulário (admin only)
 */
export async function addVocabularyEntry(
  entry: Omit<FootballVocabularyInsert, 'id' | 'created_at' | 'updated_at'>
): Promise<FootballVocabularyEntry | null> {
  const { data, error } = await supabase
    .from('football_vocabulary')
    .insert(entry)
    .select()
    .single();

  if (error) {
    console.error('Erro ao adicionar entrada:', error);
    return null;
  }

  return data as FootballVocabularyEntry;
}

/**
 * Atualiza entrada existente (admin only)
 */
export async function updateVocabularyEntry(
  id: string,
  updates: FootballVocabularyUpdate
): Promise<FootballVocabularyEntry | null> {
  const { data, error } = await supabase
    .from('football_vocabulary')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar entrada:', error);
    return null;
  }

  return data as FootballVocabularyEntry;
}

/**
 * Remove entrada (admin only)
 */
export async function deleteVocabularyEntry(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('football_vocabulary')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao deletar entrada:', error);
    return false;
  }

  return true;
}

/**
 * Incrementa contador de confirmação de uma frase
 */
export async function incrementConfirmCount(id: string): Promise<boolean> {
  const { error } = await supabase.rpc('increment_vocabulary_confirm', { vocab_id: id });

  if (error) {
    console.error('Erro ao incrementar contador:', error);
    return false;
  }

  return true;
}

/**
 * Busca todas as entradas (incluindo inativas) para admin
 */
export async function getAllVocabularyForAdmin(): Promise<FootballVocabularyEntry[]> {
  const { data, error } = await supabase
    .from('football_vocabulary')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar vocabulário completo:', error);
    return [];
  }

  return data as FootballVocabularyEntry[];
}

/**
 * Estatísticas do vocabulário
 */
export async function getVocabularyStats() {
  const { data, error } = await supabase
    .from('football_vocabulary')
    .select('intent, region, is_active');

  if (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return {
      total: 0,
      active: 0,
      byIntent: {} as Record<string, number>,
      byRegion: {} as Record<string, number>,
    };
  }

  const total = data.length;
  const active = data.filter((d) => d.is_active).length;
  const byIntent: Record<string, number> = {};
  const byRegion: Record<string, number> = {};

  data.forEach((entry) => {
    byIntent[entry.intent] = (byIntent[entry.intent] || 0) + 1;
    byRegion[entry.region] = (byRegion[entry.region] || 0) + 1;
  });

  return { total, active, byIntent, byRegion };
}
