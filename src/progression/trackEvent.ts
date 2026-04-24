import { useEffect } from 'react';
import { useProgressionStore } from './progressionStore';
import type { MissionEvent } from './types';

/** Dispara um evento de progressão a partir de qualquer lugar (fora de React). */
export function trackMissionEvent(event: MissionEvent, amount = 1): void {
  useProgressionStore.getState().trackMissionEvent(event, amount);
}

/** Hook: dispara o evento uma vez quando o componente monta. */
export function useTrackScreen(event: MissionEvent, amount = 1): void {
  useEffect(() => {
    trackMissionEvent(event, amount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
