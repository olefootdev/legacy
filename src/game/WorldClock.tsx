import { useEffect } from 'react';
import { useGameDispatch, useGameStore } from './store';

/** Ao montar / focar o separador, aplica tempo real acumulado. Opcionalmente simula em segundo plano. */
export function WorldClock() {
  const dispatch = useGameDispatch();
  const background = useGameStore((s) => s.userSettings.worldSimulateInBackground);

  useEffect(() => {
    const run = () => {
      dispatch({ type: 'WORLD_CATCH_UP', nowMs: Date.now() });
    };
    run();
    const onVis = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', run);

    let intervalId: ReturnType<typeof setInterval> | undefined;
    if (background) {
      intervalId = setInterval(run, 60_000);
    }

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', run);
      if (intervalId) clearInterval(intervalId);
    };
  }, [dispatch, background]);

  return null;
}
