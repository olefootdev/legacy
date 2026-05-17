import { useEffect } from 'react';
import {
  applyHydratedSquad,
  getGameState,
  mergeRemoteSquadIntoLocal,
  setSquadHydrationDone,
} from '@/game/store';
import { loadManagerSquad } from '@/supabase/managerSquad';
import { isSupabaseConfigured } from '@/supabase/client';

/**
 * No boot, hidrata `state.players` + `state.lineup` + `formationScheme` a
 * partir do Supabase se houver row em `manager_squad` para o user logado.
 *
 * Estratégia:
 *  - Se local vazio: substitui slices inteiros pelo snapshot remoto
 *    (comportamento original).
 *  - Se local tem jogadores: MERGE — adiciona qualquer jogador remoto que
 *    falte no local. Recupera compras que sumiram por filtros antigos
 *    em persistence.ts ou caches stale. Local sempre vence em conflito
 *    (nunca sobrescreve um jogador já presente).
 *
 * Seta `squadHydrationDone` quando termina para que a cerimônia de
 * onboarding só abra depois desta verificação.
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
      const localHasPlayers = Object.keys(local.players).length > 0;
      const remote = await loadManagerSquad();
      if (cancelled) return;
      if (!remote || Object.keys(remote.players).length === 0) {
        setSquadHydrationDone();
        return;
      }
      if (!localHasPlayers) {
        // Boot frio — substitui slices inteiros.
        const fresh = getGameState();
        if (Object.keys(fresh.players).length === 0) {
          applyHydratedSquad({
            players: remote.players,
            lineup: remote.lineup,
            formationScheme: remote.formationScheme,
          });
        }
      } else {
        // Local já tem jogadores — só adiciona o que estiver faltando.
        const recovered = mergeRemoteSquadIntoLocal(remote.players);
        if (recovered.length > 0) {
          console.log(
            `[managerSquad] recuperou ${recovered.length} jogador(es) ausente(s) do Supabase:`,
            recovered,
          );
        }
      }
      setSquadHydrationDone();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
