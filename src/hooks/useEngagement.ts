/**
 * OLEFOOT PYTHON MODE — Hooks de engajamento.
 *
 * Exposição limpa de presença, ausência e ciclo de bônus pra qualquer
 * componente da UI consumir sem mexer no store diretamente.
 */
import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '@/game/store';
import {
  canClaimNow,
  msUntilNextClaim,
  previewNextReward,
  getIntervalHours,
} from '@/systems/engagement/loginBonus';
import { evaluateAbsence } from '@/systems/engagement/absencePenalty';
import { hoursSinceLastLogin } from '@/systems/engagement/checkIn';

/** Avaliação completa da ausência do manager (tier + horas + efeito). */
export function useAbsence() {
  const presence = useGameStore((s) => s.managerPresence);
  // Re-avalia a cada 60s pra UI atualizar tier sem refresh
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => evaluateAbsence(presence, Date.now()), [presence, tick]);
}

/** Estado do ciclo de bonus 3h/1h. */
export function useLoginBonus() {
  const presence = useGameStore((s) => s.managerPresence);
  const lastClaim = useGameStore((s) => s.lastLoginBonusClaim);

  // Re-render a cada 30s pra countdown atualizar
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    const now = Date.now();
    if (!presence) {
      return {
        canClaim: false,
        msUntilNext: 0,
        intervalHours: getIntervalHours(now),
        nextReward: null,
        lastClaimResult: lastClaim,
      };
    }
    return {
      canClaim: canClaimNow(presence, now),
      msUntilNext: msUntilNextClaim(presence, now),
      intervalHours: getIntervalHours(now),
      nextReward: previewNextReward(presence, now),
      lastClaimResult: lastClaim,
    };
  }, [presence, lastClaim, tick]);
}

/** Quanto tempo sem login (em horas). */
export function useHoursSinceLastLogin(): number {
  const presence = useGameStore((s) => s.managerPresence);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => hoursSinceLastLogin(presence, Date.now()), [presence, tick]);
}
