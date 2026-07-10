import { useEffect } from 'react';
import {
  applyHydratedSquad,
  getGameState,
  mergeRemoteSquadIntoLocal,
  reconcileRemoteLineup,
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
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 1000;
    void (async () => {
      // Esperar sessão estar disponível antes de tentar carregar
      let hasSession = false;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const { getSupabase } = await import('@/supabase/client');
        const sb = getSupabase();
        const sess = await sb?.auth.getSession();
        if (sess?.data?.session?.user?.id) {
          hasSession = true;
          break;
        }
        if (cancelled) return;
        if (attempt < MAX_RETRIES - 1) {
          console.info('[SquadHydrator] sem sessão, retry em', RETRY_DELAY, 'ms (attempt', attempt + 1, ')');
          await new Promise((r) => setTimeout(r, RETRY_DELAY));
          if (cancelled) return;
        }
      }
      if (!hasSession) {
        console.info('[SquadHydrator] sem sessão após retries — user não autenticado');
        setSquadHydrationDone();
        return;
      }
      const local = getGameState();
      const localHasPlayers = Object.keys(local.players).length > 0;
      console.info('[SquadHydrator] localHasPlayers=', localHasPlayers);
      const remote = await loadManagerSquad();
      if (cancelled) return;
      // AUTO-CURA: descarta ids malformados "legacy-legacy-" do remoto (bug antigo
      // do prefixo duplo) pra o merge não RE-ADICIONAR o legacy-fantasma. Combina
      // com a migração no hydrateState (limpa o local).
      if (remote?.players) {
        for (const id of Object.keys(remote.players)) {
          if (id.startsWith('legacy-legacy-')) delete remote.players[id];
        }
      }
      console.info('[SquadHydrator] remote players=', remote ? Object.keys(remote.players).length : 'null');
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
          console.info('[SquadHydrator] aplicou squad remoto:', Object.keys(remote.players).length, 'jogadores');
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
        // Reconcilia a escalação: preenche só os slots vazios do XI local com o
        // remoto (nunca sobrescreve a escolha local). Recupera o lineup perdido
        // (localStorage estourado / outro browser) e encaixa jogadores recém
        // recuperados acima.
        const filledSlots = reconcileRemoteLineup(remote.lineup);
        if (filledSlots > 0) {
          console.log(`[managerSquad] reconciliou ${filledSlots} slot(s) da escalação do Supabase`);
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
