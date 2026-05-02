/**
 * Persistência server-side das ligas admin.
 * Admin escreve via RPCs (requer is_admin()).
 * Managers leem no boot via loadAdminLeagues().
 */
import { getSupabase, isSupabaseConfigured } from './client';
import type { AdminLeagueConfig } from '@/match/adminLeagues';

export interface AdminLeagueRow {
  id: string;
  config: AdminLeagueConfig;
  is_primary: boolean;
  updated_at: string;
}

export async function loadAdminLeagues(): Promise<{ leagues: AdminLeagueConfig[]; primaryId: string | null } | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('admin_leagues')
    .select('id, config, is_primary, updated_at')
    .order('updated_at', { ascending: true });
  if (error) { console.warn('[adminLeagues] load falhou:', error.message); return null; }
  if (!data || data.length === 0) return null;
  const leagues = (data as AdminLeagueRow[]).map((r) => ({ ...r.config, id: r.id }));
  const primary = (data as AdminLeagueRow[]).find((r) => r.is_primary);
  return { leagues, primaryId: primary?.id ?? leagues[0]?.id ?? null };
}

export async function persistAdminLeague(league: AdminLeagueConfig, isPrimary: boolean): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.rpc('admin_upsert_league', {
    p_id: league.id,
    p_config: league as unknown as Record<string, unknown>,
    p_primary: isPrimary,
  });
  if (error) { console.error('[adminLeagues] upsert falhou:', error.message); return false; }
  return true;
}

export async function removeAdminLeague(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.rpc('admin_remove_league', { p_id: id });
  if (error) { console.error('[adminLeagues] remove falhou:', error.message); return false; }
  return true;
}

export async function setAdminPrimaryLeague(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.rpc('admin_set_primary_league', { p_id: id });
  if (error) { console.error('[adminLeagues] setPrimary falhou:', error.message); return false; }
  return true;
}
