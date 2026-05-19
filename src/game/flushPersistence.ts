import { cancelPendingPersistTimers, getGameState } from './store';
import { persistManagerSquad } from '@/supabase/managerSquad';
import { persistManagerGameState } from '@/supabase/managerGameState';
import { isSupabaseConfigured, getSupabase } from '@/supabase/client';

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
  const sb = getSupabase();
  const sess = await sb?.auth.getSession();
  const uid = sess?.data?.session?.user?.id;
  const playerCount = Object.keys(state.players).length;
  const exp = state.finance?.expLifetimeEarned ?? 0;
  const hasDone = state.userSettings?.hasDoneOnboarding ?? false;
  console.info('[flush] uid=', uid, 'players=', playerCount, 'exp=', exp, 'hasDoneOnboarding=', hasDone, 'caller=', new Error().stack?.split('\n')[2]?.trim());
  if (!uid) {
    console.warn('[flush] ABORTADO — sem sessão auth.');
    return;
  }
  if (playerCount === 0 && !hasDone) {
    console.warn('[flush] skip — 0 players e onboarding não feito (user novo, nada a salvar ainda)');
    return;
  }
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, FLUSH_TIMEOUT_MS));
  const persist = Promise.all([
    persistManagerSquad({
      players: state.players,
      lineup: state.lineup,
      formationScheme: state.manager.formationScheme,
    }).then(() => console.info('[flush] squad OK —', playerCount, 'players salvos')).catch((e) => console.warn('[flush] squad FAILED:', e)),
    persistManagerGameState(state).then(() => console.info('[flush] gameState OK — exp=', exp)).catch((e) => console.warn('[flush] gameState FAILED:', e)),
  ]).then(() => {});
  await Promise.race([persist, timeout]);
  console.info('[flush] concluído');
}
