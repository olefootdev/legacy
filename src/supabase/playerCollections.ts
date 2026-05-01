/**
 * Módulo de Coleções de Jogadores
 * Gerencia coleções para organização de jogadores
 */

import { supabase } from './client';
import type { Database } from './database.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlayerCollectionRow = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlayerCollectionInsert = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlayerCollectionUpdate = any;

export interface PlayerCollection {
  id: string;
  collection_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Busca todas as coleções ativas
 */
export async function getAllActiveCollections(): Promise<PlayerCollection[]> {
  const { data, error } = await supabase
    .from('player_collections')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Erro ao buscar coleções:', error);
    return [];
  }

  return data as PlayerCollection[];
}

/**
 * Busca todas as coleções (incluindo inativas) para admin
 */
export async function getAllCollectionsForAdmin(): Promise<PlayerCollection[]> {
  const { data, error } = await supabase
    .from('player_collections')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar coleções:', error);
    return [];
  }

  return data as PlayerCollection[];
}

/**
 * Busca uma coleção por collection_id
 */
export async function getCollectionById(collectionId: string): Promise<PlayerCollection | null> {
  const { data, error } = await supabase
    .from('player_collections')
    .select('*')
    .eq('collection_id', collectionId)
    .single();

  if (error) {
    console.error('Erro ao buscar coleção:', error);
    return null;
  }

  return data as PlayerCollection;
}

/**
 * Adiciona nova coleção (admin only)
 */
export async function addCollection(
  collection: Omit<PlayerCollectionInsert, 'id' | 'created_at' | 'updated_at'>
): Promise<PlayerCollection | null> {
  const { data, error } = await supabase
    .from('player_collections')
    .insert(collection)
    .select()
    .single();

  if (error) {
    console.error('Erro ao adicionar coleção:', error);
    return null;
  }

  return data as PlayerCollection;
}

/**
 * Atualiza coleção existente (admin only)
 */
export async function updateCollection(
  id: string,
  updates: PlayerCollectionUpdate
): Promise<PlayerCollection | null> {
  const { data, error } = await supabase
    .from('player_collections')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar coleção:', error);
    return null;
  }

  return data as PlayerCollection;
}

/**
 * Remove coleção (admin only)
 */
export async function deleteCollection(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('player_collections')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao deletar coleção:', error);
    return false;
  }

  return true;
}

/**
 * Verifica se collection_id já existe
 */
export async function collectionIdExists(collectionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('player_collections')
    .select('id')
    .eq('collection_id', collectionId)
    .single();

  if (error) {
    return false;
  }

  return !!data;
}
