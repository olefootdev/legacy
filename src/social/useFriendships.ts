/**
 * Hook de amizade real entre managers.
 *
 * Substitui o `state.social` do Zustand, que era 100% mock local: nascia com um
 * pedido fake do "WOLVES" pra todo manager e aceitava convites contra clubes NPC
 * inventados, sem nunca falar com o servidor. Removido em 2026-07-17.
 *
 * A fonte agora é `manager_friendships` no Supabase (ver src/supabase/friendships.ts).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  fetchMyFriendships,
  respondFriendRequest,
  removeFriendship,
  sendFriendRequest,
  EMPTY_FRIENDSHIPS,
  type Friendships,
} from '@/supabase/friendships';

export interface UseFriendships {
  data: Friendships;
  loading: boolean;
  /** Última mensagem de erro de uma ação (convite/resposta). */
  error: string | null;
  refresh: () => Promise<void>;
  accept: (requestId: string) => Promise<boolean>;
  decline: (requestId: string) => Promise<boolean>;
  /** Desfaz amizade ou cancela convite enviado. */
  remove: (friendshipId: string) => Promise<boolean>;
  invite: (managerId: string) => Promise<boolean>;
}

export function useFriendships(): UseFriendships {
  const [data, setData] = useState<Friendships>(EMPTY_FRIENDSHIPS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await fetchMyFriendships();
    setData(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Toda ação refaz o fetch: o servidor é a verdade, não o estado otimista. */
  const run = useCallback(
    async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
      setError(null);
      const res = await fn();
      if (res.ok === false) {
        setError(res.error);
        await refresh();
        return false;
      }
      await refresh();
      return true;
    },
    [refresh],
  );

  return {
    data,
    loading,
    error,
    refresh,
    accept: (id) => run(() => respondFriendRequest(id, true)),
    decline: (id) => run(() => respondFriendRequest(id, false)),
    remove: (id) => run(() => removeFriendship(id)),
    invite: (managerId) => run(() => sendFriendRequest(managerId)),
  };
}
