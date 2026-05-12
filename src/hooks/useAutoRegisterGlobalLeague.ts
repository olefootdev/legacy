/**
 * Auto-registro na Liga Global
 *
 * Verifica no boot se o manager tem plantel mas não está na liga global.
 * Se sim, registra:
 *   1) localmente via REGISTER_GLOBAL_TEAM (atualiza o store)
 *   2) no Supabase via registerGlobalTeamIdentity — envia APENAS identidade
 *      (id, manager_id, club_name, club_short, overall). Stats/forma/divisão
 *      nunca saem do cliente, então state local antigo não reescreve o
 *      ranking autoritativo da Edge Function.
 *
 * Roda uma vez por sessão.
 */

import { useEffect, useRef } from 'react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import { registerGlobalTeamIdentity } from '@/supabase/globalLeague';

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

    const allPlayers = Object.values(players ?? {});
    const avgOverall = allPlayers.length > 0
      ? Math.round(allPlayers.reduce((sum, p) => sum + overallFromAttributes(p.attrs), 0) / allPlayers.length)
      : 70;

    const clubName = club?.name ?? 'Olefoot FC';
    const clubShort = club?.shortName ?? clubName.slice(0, 3).toUpperCase();

    // Reutiliza o time já existente no store (preserva o ID do Supabase).
    // Só cria novo objeto se o manager ainda não está na liga local.
    const existingTeam = globalLeagueMVP.teams.find(t => t.managerId === managerId);

    if (!existingTeam) {
      dispatch({
        type: 'REGISTER_GLOBAL_TEAM',
        managerId,
        clubName,
        clubShort,
        overall: avgOverall,
      });
    }

    registeredRef.current = true;

    // Identity-only upsert: nunca envia stats/forma/divisão. Edge Function é
    // a única fonte de verdade pra ranking.
    const teamId = existingTeam?.id ?? `gt_${managerId.replace(/[^a-z0-9]/gi, '_')}`;
    const registeredAt = existingTeam?.registeredAt ?? Date.now();

    void registerGlobalTeamIdentity({
      id: teamId,
      managerId,
      clubName,
      clubShort,
      overall: avgOverall,
      registeredAt,
    }).then((res) => {
      if (!res.ok) {
        console.warn('[autoRegister] failed to register team in supabase:', res.error);
        // Permite retry na próxima sessão
        registeredRef.current = false;
      } else {
        console.log('[autoRegister] team registered in Liga Global:', clubName);
      }
    });
  }, [playersCount, globalLeagueMVP, managerProfile, club, players, dispatch]);
}
