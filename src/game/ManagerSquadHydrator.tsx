import { useEffect } from 'react';
import { applyHydratedSquad, getGameState } from '@/game/store';
import { loadManagerSquad } from '@/supabase/managerSquad';
import { isSupabaseConfigured } from '@/supabase/client';

/**
 * No boot, hidrata `state.players` + `state.lineup` + `formationScheme` a
 * partir do Supabase se houver row em `manager_squad` para o user logado.
 *
 * Estratégia conservadora: só hidrata se o estado local estiver vazio
 * (plantel sem jogadores). Se houver jogadores locais (cadastro acabou de
 * rodar nesta sessão), preferimos o estado local — ele será persistido
 * pelo store em seguida.
 */
export function ManagerSquadHydrator() {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    void (async () => {
      const local = getGameState();
      if (Object.keys(local.players).length > 0) return;
      const remote = await loadManagerSquad();
      if (cancelled || !remote) return;
      const fresh = getGameState();
      if (Object.keys(fresh.players).length > 0) return;
      if (Object.keys(remote.players).length === 0) return;
      applyHydratedSquad({
        players: remote.players,
        lineup: remote.lineup,
        formationScheme: remote.formationScheme,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
