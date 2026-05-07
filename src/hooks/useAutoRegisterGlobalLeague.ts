/**
 * Auto-registro na Liga Global
 *
 * Verifica no boot se o manager tem plantel mas não está na liga global.
 * Se sim, registra:
 *   1) localmente via REGISTER_GLOBAL_TEAM (atualiza o store)
 *   2) no Supabase via upsertGlobalTeamInSupabase (essencial — Edge Function
 *      lê de lá pra incluir o time na próxima rodada)
 *
 * Roda uma vez por sessão.
 */

import { useEffect, useRef } from 'react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import { upsertGlobalTeamInSupabase } from '@/supabase/globalLeague';
import { createGlobalTeam } from '@/match/globalLeagueMVP';

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

    // Já está na liga local
    const alreadyRegisteredLocally = globalLeagueMVP.teams.some(t => t.managerId === managerId);

    registeredRef.current = true;

    const allPlayers = Object.values(players ?? {});
    const avgOverall = allPlayers.length > 0
      ? Math.round(allPlayers.reduce((sum, p) => sum + overallFromAttributes(p.attrs), 0) / allPlayers.length)
      : 70;

    const clubName = club?.name ?? 'Olefoot FC';
    const clubShort = club?.shortName ?? clubName.slice(0, 3).toUpperCase();

    // 1. Registra localmente (se ainda não está)
    if (!alreadyRegisteredLocally) {
      dispatch({
        type: 'REGISTER_GLOBAL_TEAM',
        managerId,
        clubName,
        clubShort,
        overall: avgOverall,
      });
    }

    // 2. Persiste no Supabase (idempotente via onConflict: manager_id).
    //    Sem isso, a Edge Function não vê o time e nunca inclui na rodada.
    const teamForSupabase = createGlobalTeam(managerId, clubName, clubShort, avgOverall);
    void upsertGlobalTeamInSupabase(teamForSupabase).then((res) => {
      if (!res.ok) {
        console.warn('[autoRegister] failed to register team in supabase:', res.error);
      } else {
        console.log('[autoRegister] team registered in Liga Global:', clubName);
      }
    });
  }, [playersCount, globalLeagueMVP, managerProfile, club, players, dispatch]);
}
