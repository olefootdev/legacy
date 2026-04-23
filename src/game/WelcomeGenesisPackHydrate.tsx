import { useEffect, useRef } from 'react';
import { tryGrantWelcomeGenesisPack, WELCOME_GENESIS_PACK_VERSION } from '@/game/welcomeGenesisPack';
import { getGameState } from '@/game/store';
import { isSupabaseConfigured } from '@/supabase/client';

/**
 * Após cadastro: se o plantel ficou vazio (ex.: rede lenta) e o pack ainda não foi marcado,
 * tenta entregar o welcome pack uma vez por sessão ao carregar a app.
 */
export function WelcomeGenesisPackHydrate() {
  const sessionTriedRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || sessionTriedRef.current) return;
    const st = getGameState();
    if (!st.userSettings?.managerProfile) return;
    if ((st.userSettings.welcomeGenesisPackVersion ?? 0) >= WELCOME_GENESIS_PACK_VERSION) return;
    if (Object.keys(st.players).length > 0) return;

    sessionTriedRef.current = true;
    void tryGrantWelcomeGenesisPack().then((r) => {
      if (
        r.ok === false &&
        (r.reason === 'no_supabase' ||
          r.reason === 'insufficient_catalog' ||
          r.reason === 'selection_failed')
      ) {
        sessionTriedRef.current = false;
      }
    });
  }, []);

  return null;
}
