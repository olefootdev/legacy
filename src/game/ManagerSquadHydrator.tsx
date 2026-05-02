import { useEffect } from 'react';
import { applyHydratedSquad, getGameState, setSquadHydrationDone } from '@/game/store';
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
 *
 * Seta `squadHydrationDone` quando termina (com ou sem dados) para que
 * a cerimônia de onboarding só abra depois desta verificação.
 */
export function ManagerSquadHydrator() {
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSquadHydrationDone();
      return;
    }
    let cancelled = false;
    void (async () => {
      const local = getGameState();
      if (Object.keys(local.players).length > 0) {
        setSquadHydrationDone();
        return;
      }
      const remote = await loadManagerSquad();
      if (cancelled) return;
      const fresh = getGameState();
      if (Object.keys(fresh.players).length > 0) {
        setSquadHydrationDone();
        return;
      }
      if (remote && Object.keys(remote.players).length > 0) {
        applyHydratedSquad({
          players: remote.players,
          lineup: remote.lineup,
          formationScheme: remote.formationScheme,
        });
      }
      setSquadHydrationDone();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
