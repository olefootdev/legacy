import { useEffect, useRef } from 'react';
import { applyGenesisTestSquads } from '@/game/genesisTestSquads';
import { getGameState, useGameDispatch } from '@/game/store';
import type { OlefootGameState } from '@/game/types';
import { isSupabaseConfigured } from '@/supabase/client';

/**
 * Com Supabase configurado: sincroniza plantel da casa + adversário (`genesisAwayPlayers`)
 * a partir de `genesis_market_players` (uma vez por carregamento da app).
 *
 * Gate: hasDoneOnboarding=true — só popula test squad para sessões dev/QA
 * onde o manager já completou a cerimônia de boas-vindas.
 */
export function GenesisTestSquadsHydrate() {
  const dispatch = useGameDispatch();
  const triedRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || triedRef.current) return;
    const st: OlefootGameState = getGameState();
    if (st.userSettings?.managerProfile) return;
    if (!st.userSettings?.hasDoneOnboarding) return;
    const players = st.players;
    if (Object.keys(players).length > 0) return;
    triedRef.current = true;
    void applyGenesisTestSquads(dispatch, players).then((ok) => {
      if (!ok) triedRef.current = false;
    });
  }, [dispatch]);

  return null;
}
