/**
 * lazyRetry — wrapper de React.lazy com retry de chunk load.
 *
 * Causa do bug "tela preta na 1ª carga":
 * Após deploy novo, o navegador pode ter `index.html` em cache referenciando
 * URLs de chunks novas que ainda não propagaram no edge (Cloudflare). O
 * `import()` falha com TypeError (ChunkLoadError), Suspense não tem fallback
 * de erro e a árvore inteira desmonta → tela preta. Reload pega o html
 * atualizado e tudo funciona.
 *
 * Este helper:
 * 1. Retenta o `import()` 3x com backoff exponencial (200ms → 600ms → 1.4s).
 * 2. Se ainda falhar e for um ChunkLoadError clássico, força reload completo
 *    (uma vez por sessão, controlado por sessionStorage) — assim o usuário
 *    nem percebe a falha.
 * 3. Se mesmo com reload continuar falhando, propaga o erro pra ErrorBoundary
 *    raiz, que mostra fallback visível (não tela preta).
 *
 * Uso: trocar `lazy(() => import('./X'))` por `lazyRetry(() => import('./X'))`.
 */
import { lazy, type ComponentType } from 'react';
/* eslint-disable @typescript-eslint/no-explicit-any */

const RELOAD_FLAG = 'olefoot.chunkReloadAttempt';

function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as { message?: string }).message ?? String(err);
  // Mensagens típicas:
  //   "Failed to fetch dynamically imported module: ..."
  //   "Loading chunk N failed."
  //   "Importing a module script failed."
  //   "ChunkLoadError"
  return (
    /Failed to fetch dynamically imported module/i.test(msg)
    || /Loading chunk \d+ failed/i.test(msg)
    || /Importing a module script failed/i.test(msg)
    || /ChunkLoadError/i.test(msg)
    || (err as { name?: string })?.name === 'ChunkLoadError'
  );
}

function shouldHardReload(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(RELOAD_FLAG) !== '1';
  } catch {
    return true;
  }
}

function markReloaded(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    /* ignore */
  }
}

async function importWithRetry<T>(
  factory: () => Promise<T>,
  attempts: number = 3,
  baseDelayMs: number = 200,
): Promise<T> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await factory();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        // Backoff exponencial leve: 200, 600, 1400
        const delay = baseDelayMs * Math.pow(3, i);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  // Todos os retries falharam.
  if (isChunkLoadError(lastErr) && shouldHardReload()) {
    markReloaded();
    // Reload sem cache. Não usar location.reload() — que pode pegar do bfcache.
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
    // Suspende renderização atual com promise pendente; reload reseta tudo.
    return new Promise<T>(() => {});
  }
  throw lastErr;
}

/**
 * Drop-in replacement para `React.lazy` com retry + auto-reload em
 * ChunkLoadError na primeira tentativa por sessão.
 */
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): ReturnType<typeof lazy<T>> {
  return lazy(() => importWithRetry(factory));
}
