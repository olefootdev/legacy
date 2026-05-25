import { useEffect } from 'react';
import { isSupabaseConfigured } from '@/supabase/client';
import { loadOlefootPythonModeState } from '@/supabase/olefootPythonMode';
import { dispatchGame } from './store';

/**
 * OLEFOOT PYTHON MODE — Hidratação no boot.
 *
 * Carrega consequências ativas (não-expiradas) e presença do Supabase,
 * mescla com estado local via action HYDRATE_OLEFOOT_PYTHON_MODE.
 *
 * Roda em paralelo com ManagerGameStateHydrator — completamente
 * independente, sem coordenação.
 */
export function OlefootPythonModeHydrator() {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1500;

    void (async () => {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const snapshot = await loadOlefootPythonModeState();
        if (cancelled) return;
        if (snapshot) {
          const consequences = Object.values(snapshot.consequenceStore?.active ?? {});
          dispatchGame({
            type: 'HYDRATE_OLEFOOT_PYTHON_MODE',
            consequences,
            managerPresence: snapshot.managerPresence,
          });
          console.info(
            '[OlefootPythonModeHydrator] hidratado:',
            consequences.length, 'consequências,',
            snapshot.managerPresence ? 'presence existe' : 'presence nova',
          );
          return;
        }
        // null = sem sessão ainda; retry
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY));
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return null;
}
