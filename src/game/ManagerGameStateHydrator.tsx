import { useEffect } from 'react';
import { getGameState, applyHydratedGameState, setSquadHydrationDone } from '@/game/store';
import { loadManagerGameState } from '@/supabase/managerGameState';
import { isSupabaseConfigured } from '@/supabase/client';

/**
 * No boot, hidrata os slices críticos do OlefootGameState a partir do Supabase
 * se houver row em `manager_game_state` para o user logado.
 *
 * Estratégia conservadora: só sobrescreve um slice se o valor local estiver
 * no estado "vazio/default" — preserva progresso feito nesta sessão.
 * Roda em paralelo com ManagerSquadHydrator; ambos chamam setSquadHydrationDone
 * mas o gate é idempotente (só dispara na primeira chamada).
 */
export function ManagerGameStateHydrator() {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    void (async () => {
      const remote = await loadManagerGameState();
      if (cancelled || !remote) return;
      applyHydratedGameState(remote);
    })();
    return () => { cancelled = true; };
  }, []);

  return null;
}
