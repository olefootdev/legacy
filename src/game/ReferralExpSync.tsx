import { useEffect, useRef } from 'react';
import { useGameStore } from '@/game/store';
import { isSupabaseConfigured } from '@/supabase/client';
import { syncMyExpLifetime } from '@/supabase/referrals';

/**
 * Rede de segurança da comissão de indicação (EXP 5%).
 *
 * O trigger server-side `profiles_referral_exp_commission_trg` credita 5% do
 * EXP do indicado pro referrer — mas só quando o cliente sincroniza o
 * `expLifetimeEarned` via `sync_my_exp_lifetime`. Hoje isso só acontece no
 * Postgame e no Login, então EXP ganho fora desses fluxos (Liga Global,
 * relatório de olheiro, prêmio de divisão, GAT, HODL, etc.) NUNCA disparava a
 * comissão do indicador.
 *
 * Este componente observa o lifetime EXP no store e sincroniza (com debounce)
 * sempre que ele cresce — independente da origem. O server é monotônico e
 * idempotente, então sincronizar a mais é seguro; só re-sincronizamos quando o
 * valor de fato aumenta acima do último enviado.
 */
const SYNC_DEBOUNCE_MS = 3000;

export function ReferralExpSync() {
  const expLifetime = useGameStore((s) => s.finance?.expLifetimeEarned ?? 0);
  const lastSyncedRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    if (expLifetime <= 0) return;
    if (expLifetime <= lastSyncedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const value = expLifetime;
      lastSyncedRef.current = value;
      void syncMyExpLifetime(value);
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [expLifetime]);

  return null;
}
