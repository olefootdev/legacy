/**
 * OLEFOOT PYTHON MODE — Hooks de seletores das consequências persistentes.
 *
 * Wrappers tipados sobre `useGameStore` que entregam overlays prontos pra UI.
 * Outras páginas (Team, Manager, Scouts) consomem daqui em vez de mexer
 * direto no `consequenceStore`.
 */
import { useMemo } from 'react';
import { useGameStore } from '@/game/store';
import {
  evaluateConsequence,
  getActiveFor,
  EMPTY_CONSEQUENCE_STORE,
} from '@/systems/consequences/store';
import {
  computePlayerOverlay,
  computeClubOverlay,
  NEUTRAL_PLAYER_OVERLAY,
  NEUTRAL_CLUB_OVERLAY,
  type PlayerOverlay,
  type ClubOverlay,
} from '@/systems/consequences/applyOverlay';
import type { EvaluatedConsequence } from '@/systems/consequences/types';

/** Lista de consequências ativas de um jogador (já filtrada por expiresAt). */
export function usePlayerConsequences(playerId: string | undefined): EvaluatedConsequence[] {
  const store = useGameStore((s) => s.consequenceStore ?? EMPTY_CONSEQUENCE_STORE);
  return useMemo(() => {
    if (!playerId) return [];
    const now = Date.now();
    const active = getActiveFor(store, { playerId }, now);
    return active.map((c) => evaluateConsequence(c, now));
  }, [store, playerId]);
}

/** Overlay agregado de um jogador (físico, moral, mercado). */
export function usePlayerOverlay(playerId: string | undefined): PlayerOverlay {
  const store = useGameStore((s) => s.consequenceStore ?? EMPTY_CONSEQUENCE_STORE);
  return useMemo(() => {
    if (!playerId) return NEUTRAL_PLAYER_OVERLAY;
    return computePlayerOverlay(store, playerId, Date.now());
  }, [store, playerId]);
}

/** Overlay do clube do manager (torcida, moral coletivo, fanbase). */
export function useClubOverlay(): ClubOverlay {
  const store = useGameStore((s) => s.consequenceStore ?? EMPTY_CONSEQUENCE_STORE);
  const clubId = useGameStore((s) => s.club.id);
  return useMemo(() => {
    return computeClubOverlay(store, clubId, Date.now());
  }, [store, clubId]);
}

/** Todas as consequências ativas do clube (todas dimensões, player+club). */
export function useClubConsequences(): EvaluatedConsequence[] {
  const store = useGameStore((s) => s.consequenceStore ?? EMPTY_CONSEQUENCE_STORE);
  const clubId = useGameStore((s) => s.club.id);
  return useMemo(() => {
    const now = Date.now();
    return getActiveFor(store, { clubId }, now).map((c) => evaluateConsequence(c, now));
  }, [store, clubId]);
}

/** Contagem rápida pra badges no menu. */
export function useConsequenceCounts(): {
  total: number;
  unavailablePlayers: number;
  alerts: number;
} {
  const store = useGameStore((s) => s.consequenceStore ?? EMPTY_CONSEQUENCE_STORE);
  return useMemo(() => {
    const now = Date.now();
    let total = 0;
    const unavailableSet = new Set<string>();
    let alerts = 0;
    for (const c of Object.values(store.active)) {
      if (c.expiresAt <= now) continue;
      total += 1;
      if (c.playerId && c.dimension === 'physical' && c.magnitude > 0) {
        unavailableSet.add(c.playerId);
      }
      if (c.dimension === 'physical' || c.dimension === 'reputational') {
        alerts += 1;
      }
    }
    return { total, unavailablePlayers: unavailableSet.size, alerts };
  }, [store]);
}
