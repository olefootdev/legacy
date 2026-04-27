/**
 * Subscription Realtime para a Liga Global.
 *
 * Quando o tick do servidor (Edge Function global-league-tick) altera
 * fixtures/events/teams/rounds/state, o cliente recebe um evento e re-hidrata
 * o estado completo. Mudanças vêm em rajada (uma rodada inteira é simulada
 * de uma vez), então debouncamos os triggers num único re-fetch.
 */

import { getSupabase, isSupabaseConfigured } from './client';

const REHYDRATE_DEBOUNCE_MS = 800;
const TABLES = [
  'global_league_state',
  'global_league_teams',
  'global_league_rounds',
  'global_league_fixtures',
  'global_league_events',
] as const;

/**
 * Inscreve em mudanças nas tabelas da Liga Global.
 * Chama `onChange` (debounced) quando algo muda. Retorna função de cleanup.
 */
export function subscribeGlobalLeagueChanges(onChange: () => void): () => void {
  if (!isSupabaseConfigured()) return () => {};
  const supabase = getSupabase();
  if (!supabase) return () => {};

  let pending: ReturnType<typeof setTimeout> | null = null;
  const trigger = () => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = null;
      onChange();
    }, REHYDRATE_DEBOUNCE_MS);
  };

  const channel = supabase.channel('global-league-sync');
  for (const table of TABLES) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      trigger,
    );
  }
  void channel.subscribe();

  return () => {
    if (pending) clearTimeout(pending);
    void supabase.removeChannel(channel);
  };
}
