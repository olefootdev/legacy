/**
 * Auto-registro na Liga Global
 *
 * Verifica no boot se o manager tem plantel mas não está na liga global.
 * Se sim, registra automaticamente. Roda uma vez por sessão.
 */

import { useEffect, useRef } from 'react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';

export function useAutoRegisterGlobalLeague() {
  const dispatch = useGameDispatch();
  const registeredRef = useRef(false);

  const playersCount = useGameStore((s) => Object.keys(s.players ?? {}).length);
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);

  useEffect(() => {
    if (registeredRef.current) return;
    if (playersCount === 0) return;
    if (!globalLeagueMVP) return;

    const managerId = managerProfile?.email ?? club?.id;
    if (!managerId) return;

    // Já está na liga
    if (globalLeagueMVP.teams.some(t => t.managerId === managerId)) return;

    registeredRef.current = true;

    const allPlayers = Object.values(players ?? {});
    const avgOverall = allPlayers.length > 0
      ? Math.round(allPlayers.reduce((sum, p) => sum + overallFromAttributes(p.attrs), 0) / allPlayers.length)
      : 70;

    const clubName = club?.name ?? 'Olefoot FC';
    const clubShort = club?.shortName ?? clubName.slice(0, 3).toUpperCase();

    dispatch({
      type: 'REGISTER_GLOBAL_TEAM',
      managerId,
      clubName,
      clubShort,
      overall: avgOverall,
    });
  }, [playersCount, globalLeagueMVP, managerProfile, club, players, dispatch]);
}
