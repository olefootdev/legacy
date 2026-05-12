import { useEffect, useRef, useState } from 'react';
import { dispatchGame, useGameStore, useSquadHydrationDone } from '@/game/store';

/**
 * Recovery de managers órfãos.
 *
 * Detecta managers que ficaram sem plantel por qualquer motivo:
 * 1. hasDoneOnboarding=true mas players=0 (fechou browser no meio)
 * 2. welcomeGenesisPackVersion marcado mas hasDoneOnboarding=false e players=0
 *    (saiu pelo botão X da cerimônia)
 *
 * Em ambos os casos, reseta as flags para que a cerimônia reabra.
 * Aguarda hydration + 1.5s settle para não resetar antes dos jogadores
 * chegarem do Supabase.
 */
export function useRecoverOrphanManager() {
  const hasProfile = useGameStore((s) => !!s.userSettings?.managerProfile);
  const hasDoneOnboarding = useGameStore((s) => s.userSettings?.hasDoneOnboarding ?? false);
  const welcomePackVersion = useGameStore((s) => s.userSettings?.welcomeGenesisPackVersion ?? 0);
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

    // Caso 1: completou onboarding mas ficou sem jogadores
    // Caso 2: marcou welcomePackVersion (saiu pelo X) mas não completou
    const needsRecovery = hasDoneOnboarding || (welcomePackVersion > 0 && !hasDoneOnboarding);
    if (!needsRecovery) return;

    recoveredRef.current = true;
    dispatchGame({
      type: 'SET_USER_SETTINGS',
      partial: { hasDoneOnboarding: false, welcomeGenesisPackVersion: 0 },
    });
  }, [settled, hasProfile, playersCount, hasDoneOnboarding, welcomePackVersion]);
}
