import { useEffect, useRef } from 'react';
import { applyGenesisTestSquads } from '@/game/genesisTestSquads';
import { getGameState, useGameDispatch } from '@/game/store';
import type { OlefootGameState } from '@/game/types';
import { isSupabaseConfigured } from '@/supabase/client';
import { WELCOME_GENESIS_PACK_VERSION } from '@/game/welcomeGenesisPack';

/**
 * Com Supabase configurado: sincroniza plantel da casa + adversário (`genesisAwayPlayers`)
 * a partir de `genesis_market_players` (uma vez por carregamento da app).
 */
export function GenesisTestSquadsHydrate() {
  const dispatch = useGameDispatch();
  const triedRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || triedRef.current) return;
    const st: OlefootGameState = getGameState();
    if (st.userSettings?.managerProfile) return;
    // Não popula test squad antes do welcome pack — deixa a cerimônia
    // de onboarding entregar os jogadores ao usuário novo. Só roda em
    // sessões de dev/QA que já passaram pela cerimônia.
    if ((st.userSettings?.welcomeGenesisPackVersion ?? 0) < WELCOME_GENESIS_PACK_VERSION) return;
    const players = st.players;
    if (Object.keys(players).length > 0) return;
    triedRef.current = true;
    void applyGenesisTestSquads(dispatch, players).then((ok) => {
      if (!ok) triedRef.current = false;
    });
  }, [dispatch]);

  return null;
}
