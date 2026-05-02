/**
 * Persistência do estado da liga global (OlefootLeague + GlobalLeagueState).
 * Usa tabela admin_global_league_snapshot (JSONB) separada da
 * tabela global_league_state (schema relacional existente).
 */
import { getSupabase, isSupabaseConfigured } from './client';
import type { OlefootLeagueState } from '@/match/olefootLeague';

const TABLE = 'admin_global_league_snapshot';

export async function persistGlobalLeagueState(state: OlefootLeagueState): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb
    .from(TABLE)
    .upsert({ id: 'singleton', state: state as unknown as Record<string, unknown> }, { onConflict: 'id' });
  if (error) { console.warn('[globalLeagueState] persist falhou:', error.message); return false; }
  return true;
}

export async function loadGlobalLeagueState(): Promise<OlefootLeagueState | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from(TABLE)
    .select('state')
    .eq('id', 'singleton')
    .maybeSingle();
  if (error) { console.warn('[globalLeagueState] load falhou:', error.message); return null; }
  if (!data) return null;
  return data.state as OlefootLeagueState;
}
