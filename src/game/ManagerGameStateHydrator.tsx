import { useEffect } from 'react';
import { applyHydratedGameState, markGameStateHydrationDone } from '@/game/store';
import { loadManagerGameState } from '@/supabase/managerGameState';
import { isSupabaseConfigured } from '@/supabase/client';

/**
 * No boot, hidrata os slices críticos do OlefootGameState a partir do Supabase
 * se houver row em `manager_game_state` para o user logado.
 *
 * Estratégia conservadora: só sobrescreve um slice se o valor local estiver
 * no estado "vazio/default" — preserva progresso feito nesta sessão.
 *
 * IMPORTANTE: SEMPRE libera o gate de persist via markGameStateHydrationDone,
 * mesmo quando remote é null (user novo). Sem isso, persist debounced fica
 * trancado pra sempre e nada do estado é salvo no Supabase.
 */
export function ManagerGameStateHydrator() {
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // Sem Supabase: nada pra hidratar, libera o gate igualmente.
      markGameStateHydrationDone();
      return;
    }
    let cancelled = false;
    void (async () => {
      const remote = await loadManagerGameState();
      if (cancelled) return;
      if (remote) {
        applyHydratedGameState(remote);
      } else {
        // User novo (sem row no Supabase) — libera o gate igualmente
        // pra primeiros dispatches serem persistidos normalmente.
        markGameStateHydrationDone();
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return null;
}
