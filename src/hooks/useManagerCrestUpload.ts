import { useCallback, useState, type ChangeEvent } from 'react';
import { useGameDispatch } from '@/game/store';
import { fileToManagerCrestPngDataUrl } from '@/lib/processManagerCrestUpload';

export function useManagerCrestUpload() {
  const dispatch = useGameDispatch();
  const [error, setError] = useState<string | null>(null);

  const clearCrest = useCallback(() => {
    setError(null);
    dispatch({ type: 'SET_USER_SETTINGS', partial: { managerCrestPngDataUrl: null } });
  }, [dispatch]);

  const onFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setError(null);
      const r = await fileToManagerCrestPngDataUrl(file);
      if (r.ok === true) {
        dispatch({
          type: 'SET_USER_SETTINGS',
          partial: { managerCrestPngDataUrl: r.dataUrl },
        });
        return;
      }
      setError(r.error);
      window.setTimeout(() => setError(null), 6000);
    },
    [dispatch],
  );

  return { onFileChange, error, clearError: () => setError(null), clearCrest };
}
