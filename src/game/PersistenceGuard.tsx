import { useEffect } from 'react';
import { flushAllPersistence } from './flushPersistence';

/**
 * Safety net: dispara flush quando a aba fica hidden ou antes de fechar.
 * Fire-and-forget — o browser pode matar o fetch, mas é melhor que nada.
 */
export function PersistenceGuard() {
  useEffect(() => {
    const onVisChange = () => {
      if (document.visibilityState === 'hidden') {
        void flushAllPersistence();
      }
    };
    const onBeforeUnload = () => {
      void flushAllPersistence();
    };
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);
  return null;
}
