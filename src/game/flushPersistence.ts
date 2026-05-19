import { cancelPendingPersistTimers, getGameState } from './store';
import { persistManagerSquad } from '@/supabase/managerSquad';
import { persistManagerGameState } from '@/supabase/managerGameState';
import { isSupabaseConfigured } from '@/supabase/client';

const FLUSH_TIMEOUT_MS = 4000;

/**
 * Cancela timers debounced e persiste squad + gameState imediatamente.
 * Resolve quando ambos completam ou após timeout de 4s (o que vier primeiro).
 * Nunca rejeita — erros são logados e engolidos.
 */
export async function flushAllPersistence(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  cancelPendingPersistTimers();
  const state = getGameState();
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, FLUSH_TIMEOUT_MS));
  const persist = Promise.all([
    persistManagerSquad({
      players: state.players,
      lineup: state.lineup,
      formationScheme: state.manager.formationScheme,
    }).catch((e) => console.warn('[flush] squad persist failed:', e)),
    persistManagerGameState(state).catch((e) => console.warn('[flush] gameState persist failed:', e)),
  ]).then(() => {});
  await Promise.race([persist, timeout]);
}
