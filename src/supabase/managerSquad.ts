/**
 * Persistência server-side do plantel do manager (`state.players` + `state.lineup`).
 *
 * Estratégia MVP: snapshot completo (players[] + lineup{} + formationScheme).
 * Idempotente, debounced no store. Hidrata no boot via ManagerSquadHydrator.
 *
 * Próximas iterações podem normalizar players em rows separadas, mas para
 * 16-30 jogadores por manager o JSONB single-row é suficiente.
 */

import { getSupabase, isSupabaseConfigured } from './client';
import type { PlayerEntity } from '@/entities/types';
import type { FormationSchemeId } from '@/match-engine/types';

interface ManagerSquadRow {
  user_id: string;
  players: PlayerEntity[];
  lineup: Record<string, string>;
  formation_scheme: FormationSchemeId | null;
  updated_at: string;
}

export interface ManagerSquadSnapshot {
  players: Record<string, PlayerEntity>;
  lineup: Record<string, string>;
  formationScheme: FormationSchemeId | null;
}

async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data?.session?.user?.id ?? null;
}

/** Upsert do snapshot completo. Silencioso em erro (apenas log). */
export async function persistManagerSquad(snapshot: {
  players: Record<string, PlayerEntity>;
  lineup: Record<string, string>;
  formationScheme: FormationSchemeId;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  if (!sb) return;
  const uid = await currentUserId();
  if (!uid) return;

  const playersArr = Object.values(snapshot.players);
  const { error } = await sb
    .from('manager_squad')
    .upsert(
      {
        user_id: uid,
        players: playersArr,
        lineup: snapshot.lineup,
        formation_scheme: snapshot.formationScheme,
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    console.warn('[managerSquad] persist falhou:', error.message);
  }
}

/** Carrega snapshot do user logado. Retorna null se não houver row (manager novo). */
export async function loadManagerSquad(): Promise<ManagerSquadSnapshot | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const uid = await currentUserId();
  if (!uid) return null;

  const { data, error } = await sb
    .from('manager_squad')
    .select('user_id, players, lineup, formation_scheme, updated_at')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) {
    console.warn('[managerSquad] load falhou:', error.message);
    return null;
  }
  if (!data) return null;

  const row = data as ManagerSquadRow;
  const playersById: Record<string, PlayerEntity> = {};
  if (Array.isArray(row.players)) {
    for (const p of row.players) {
      if (p && typeof p === 'object' && typeof (p as PlayerEntity).id === 'string') {
        playersById[(p as PlayerEntity).id] = p as PlayerEntity;
      }
    }
  }
  return {
    players: playersById,
    lineup: (row.lineup as Record<string, string>) ?? {},
    formationScheme: row.formation_scheme ?? null,
  };
}
