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

    // Upsert no Supabase usando o time existente (ID estável) ou os dados
    // atuais do clube. onConflict: manager_id garante idempotência.
    const teamToUpsert = existingTeam
      ? { ...existingTeam, clubName, clubShort, overall: avgOverall }
      : { id: `gt_${managerId.replace(/[^a-z0-9]/gi, '_')}`, managerId, clubName, clubShort, overall: avgOverall,
          playoffPoints: 0, playoffMatchesPlayed: 0, playoffWins: 0, playoffDraws: 0, playoffLosses: 0,
          playoffGoalsFor: 0, playoffGoalsAgainst: 0, points: 0, matchesPlayed: 0, wins: 0, draws: 0,
          losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, recentForm: [] as Array<'W'|'D'|'L'>,
          allTimePoints: 0, allTimeMatchesPlayed: 0, allTimeWins: 0, allTimeDraws: 0, allTimeLosses: 0,
          allTimeGoalsFor: 0, allTimeGoalsAgainst: 0, allTimeSeasonsPlayed: 0,
          injuryRoundsRemaining: 0, injuryModifier: 0, yellowCardCount: 0, suspensionRoundsRemaining: 0,
          registeredAt: Date.now() };

    void upsertGlobalTeamInSupabase(teamToUpsert).then((res) => {
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
