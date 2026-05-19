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
      markGameStateHydrationDone();
      return;
    }
    let cancelled = false;
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 1000;
    void (async () => {
      let remote: Awaited<ReturnType<typeof loadManagerGameState>> = null;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        remote = await loadManagerGameState();
        if (cancelled) return;
        // Se retornou null, pode ser user novo OU sessão não pronta.
        // Verificar se temos sessão — se não, retry.
        if (remote === null) {
          const { getSupabase } = await import('@/supabase/client');
          const sb = getSupabase();
          const sess = await sb?.auth.getSession();
          if (sess?.data?.session?.user?.id) {
            // Temos sessão mas não há row — user novo legítimo
            console.info('[GameStateHydrator] user novo (sem row no Supabase)');
            break;
          }
          // Sem sessão — retry
          if (attempt < MAX_RETRIES - 1) {
            console.info('[GameStateHydrator] sem sessão, retry em', RETRY_DELAY, 'ms (attempt', attempt + 1, ')');
            await new Promise((r) => setTimeout(r, RETRY_DELAY));
            if (cancelled) return;
            continue;
          }
        }
        break;
      }
      if (cancelled) return;
      console.info('[GameStateHydrator] remote=', remote ? { finance: remote.finance, onboardingFlags: remote.onboardingFlags } : 'null');
      if (remote) {
        applyHydratedGameState(remote);
      } else {
        markGameStateHydrationDone();
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return null;
}
