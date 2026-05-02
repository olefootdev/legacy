import { useEffect } from 'react';
import { isSupabaseConfigured } from '@/supabase/client';
import { loadShopCatalogFromSupabase } from '@/supabase/platformShopCatalog';
import { loadAdminLeagues } from '@/supabase/adminLeagues';
import { dispatchGame, getGameState } from '@/game/store';
import { normalizeShopCatalog } from '@/game/shopCatalog';

/**
 * No boot, hidrata dados globais de plataforma vindos do Supabase:
 * - shop_catalog: catálogo da loja definido pelo admin
 * - admin_leagues: competições criadas pelo admin
 *
 * Esses dados substituem os defaults locais se existirem no Supabase.
 * Roda uma vez por sessão, silencioso em erro.
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
        // Só sobrescreve se o estado local ainda tem as ligas default
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
    })();
  }, []);

  return null;
}
