import { useEffect } from 'react';
import { syncGenesisRosterPortraitsFromSupabase } from '@/game/genesisTestSquads';
import { isSupabaseConfigured } from '@/supabase/client';

/**
 * Alinha retratos dos jogadores `genesis-*` no estado local com `genesis_market_players` no Supabase.
 * O plantel persiste em disco: mudanças no Admin (Pinata/URLs) só aparecem no jogo após esta reconciliação.
 */
export function GenesisCatalogPortraitsHydrate() {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const run = () => {
      void syncGenesisRosterPortraitsFromSupabase();
    };

    run();
    const t1 = window.setTimeout(run, 900);
    const t2 = window.setTimeout(run, 2800);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return null;
}
