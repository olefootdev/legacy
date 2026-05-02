/**
 * Persistência de patches admin em jogadores genesis/legacy no Supabase.
 * Usado pelo AdminSkillsPanel (skills) e AdminPlayerEvolutionPanel (evolutionRate).
 *
 * Jogadores genesis: tabela genesis_market_players
 * Jogadores legacy: tabela legacy_players
 * Jogadores de manager (genesis-GEN-*): patch no manager_squad via service_role
 */
import { getSupabase, isSupabaseConfigured } from './client';

function tableForPlayer(playerId: string): 'genesis_market_players' | 'legacy_players' | null {
  if (playerId.startsWith('genesis-')) return 'genesis_market_players';
  if (playerId.startsWith('legacy-')) return 'legacy_players';
  return null;
}

function rawIdForPlayer(playerId: string): string {
  // genesis-GEN-001 → GEN-001, legacy-123 → 123
  return playerId.replace(/^genesis-/, '').replace(/^legacy-/, '');
}

export async function persistPlayerSkills(playerId: string, skills: string[]): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const sb = getSupabase();
  if (!sb) return false;
  const table = tableForPlayer(playerId);
  if (!table) return false;
  const rawId = rawIdForPlayer(playerId);
  const { error } = await sb.from(table).update({ skills }).eq('id', rawId);
  if (error) { console.warn('[playerAdminPatch] skills falhou:', error.message); return false; }
  return true;
}

export async function persistPlayerEvolutionRate(playerId: string, rate: number): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const sb = getSupabase();
  if (!sb) return false;
  const table = tableForPlayer(playerId);
  if (!table) return false;
  const rawId = rawIdForPlayer(playerId);
  const col = table === 'genesis_market_players' ? 'evolution_rate' : 'evolution_rate';
  const { error } = await sb.from(table).update({ [col]: rate }).eq('id', rawId);
  if (error) { console.warn('[playerAdminPatch] evolutionRate falhou:', error.message); return false; }
  return true;
}
