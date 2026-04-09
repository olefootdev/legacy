import { useCallback, useSyncExternalStore } from 'react';
import type { OlefootGameState } from './types';
import type { GameAction } from './types';
import { gameReducer } from './reducer';
import { loadGameState, saveGameState } from './persistence';

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
