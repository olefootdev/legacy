import { useCallback, useState, type ChangeEvent } from 'react';
import { useGameDispatch } from '@/game/store';
import {
  fileToTrainerAvatarDataUrl,
  type TrainerAvatarResult,
} from '@/lib/processTrainerAvatarUpload';

function isTrainerAvatarError(
  r: TrainerAvatarResult
): r is { ok: false; error: string } {
  return r.ok === false;
}

export function useTrainerAvatarUpload() {
  const dispatch = useGameDispatch();
  const [error, setError] = useState<string | null>(null);

  const clearAvatar = useCallback(() => {
    setError(null);
    dispatch({ type: 'SET_USER_SETTINGS', partial: { trainerAvatarDataUrl: null } });
  }, [dispatch]);

  const onFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setError(null);
      const r = await fileToTrainerAvatarDataUrl(file);
      if (isTrainerAvatarError(r)) {
        setError(r.error);
        window.setTimeout(() => setError(null), 6000);
        return;
      }
      dispatch({
        type: 'SET_USER_SETTINGS',
        partial: { trainerAvatarDataUrl: r.dataUrl },
      });
    },
    [dispatch]
  );

  return { onFileChange, error, clearError: () => setError(null), clearAvatar };
}
