import { useEffect, useRef, useState } from 'react';
import { dispatchGame, useGameStore, useSquadHydrationDone } from '@/game/store';

/**
 * Recovery de managers órfãos.
 *
 * Detecta manager com perfil + flag hasDoneOnboarding=true + players=0
 * (algo deu errado: localStorage limpou, browser fechou no meio, etc).
 *
 * Reseta a flag pra que a cerimônia reabra. Aguarda hydration + 1.5s
 * settle pra não resetar antes dos jogadores chegarem do Supabase.
 */
export function useRecoverOrphanManager() {
  const hasProfile = useGameStore((s) => !!s.userSettings?.managerProfile);
  const hasDoneOnboarding = useGameStore((s) => s.userSettings?.hasDoneOnboarding ?? false);
  const playersCount = useGameStore((s) => Object.keys(s.players ?? {}).length);
  const hydrationDone = useSquadHydrationDone();
  const recoveredRef = useRef(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!hydrationDone) return;
    const t = setTimeout(() => setSettled(true), 1500);
    return () => clearTimeout(t);
  }, [hydrationDone]);

  useEffect(() => {
    if (recoveredRef.current) return;
    if (!settled) return;
    if (!hasProfile) return;
    if (playersCount > 0) return;
    if (!hasDoneOnboarding) return; // já está em estado limpo — cerimônia abre

    recoveredRef.current = true;
    dispatchGame({
      type: 'SET_USER_SETTINGS',
      partial: { hasDoneOnboarding: false },
    });
  }, [settled, hasProfile, playersCount, hasDoneOnboarding]);
}
