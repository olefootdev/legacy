import { useEffect } from 'react';
import { isSupabaseConfigured } from '@/supabase/client';
import { loadShopCatalogFromSupabase } from '@/supabase/platformShopCatalog';
import { loadAdminLeagues } from '@/supabase/adminLeagues';
import { loadGlobalLeagueState } from '@/supabase/globalLeagueState';
import { dispatchGame, getGameState } from '@/game/store';
import { normalizeShopCatalog } from '@/game/shopCatalog';

/**
 * No boot, hidrata dados globais de plataforma vindos do Supabase:
 * - shop_catalog: catálogo da loja definido pelo admin
 * - admin_leagues: competições criadas pelo admin
 * - global_league_state: estado da liga global 24/7
 */
export function PlatformDataHydrator() {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void (async () => {
      // Shop catalog
      const catalog = await loadShopCatalogFromSupabase();
      if (catalog && catalog.length > 0) {
        const normalized = normalizeShopCatalog(catalog);
        if (normalized.length > 0) {
          dispatchGame({ type: 'ADMIN_SET_SHOP_CATALOG', items: normalized });
        }
      }

      // Admin leagues
      const leaguesData = await loadAdminLeagues();
      if (leaguesData && leaguesData.leagues.length > 0) {
        const local = getGameState();
        const hasCustomLeagues = local.adminLeagues.some((l) => !l.id.startsWith('lg_ole_'));
        if (!hasCustomLeagues) {
          for (const league of leaguesData.leagues) {
            dispatchGame({ type: 'ADMIN_UPSERT_LEAGUE', league });
          }
          if (leaguesData.primaryId) {
            dispatchGame({ type: 'ADMIN_SET_PRIMARY_LEAGUE', id: leaguesData.primaryId });
          }
        }
      }

      // Liga global 24/7
      const globalState = await loadGlobalLeagueState();
      if (globalState) {
        dispatchGame({ type: 'SET_OLEFOOT_LEAGUE', payload: globalState });
      }
    })();
  }, []);

  return null;
}
