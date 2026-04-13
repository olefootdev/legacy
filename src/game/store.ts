import { useCallback, useSyncExternalStore } from 'react';
import type { OlefootGameState } from './types';
import type { GameAction } from './types';
import { gameReducer } from './reducer';
import { loadGameState, saveGameState } from './persistence';
import { insertMatch } from '@/supabase/matchPersistence';
import { isSupabaseConfigured } from '@/supabase/client';

type Listener = () => void;

let state: OlefootGameState = loadGameState();
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function getGameState(): OlefootGameState {
  return state;
}

export function dispatchGame(action: GameAction): void {
  state = gameReducer(state, action);
  if (action.type === 'START_LIVE_MATCH' && isSupabaseConfigured()) {
    const lm = state.liveMatch;
    const nonce = lm?.matchClientNonce;
    if (lm && nonce != null && !lm.supabaseMatchId) {
      void insertMatch({
        homeClubId: state.club.id,
        awayName: state.nextFixture.opponent.shortName,
        mode: lm.mode,
        simulationSeed: lm.simulationSeed,
      }).then((sbId) => {
        if (!sbId) return;
        const cur = getGameState().liveMatch;
        if (!cur || cur.supabaseMatchId || cur.matchClientNonce !== nonce) return;
        state = gameReducer(getGameState(), { type: 'SET_LIVE_MATCH_SUPABASE_ID', matchId: sbId, matchClientNonce: nonce });
        saveGameState(state);
        emit();
      });
    }
  }
  saveGameState(state);
  emit();
}

export function subscribeGame(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useGameStore<T>(selector: (s: OlefootGameState) => T): T {
  return useSyncExternalStore(
    subscribeGame,
    () => selector(state),
    () => selector(state),
  );
}

export function useGameDispatch() {
  return useCallback((a: GameAction) => dispatchGame(a), []);
}
