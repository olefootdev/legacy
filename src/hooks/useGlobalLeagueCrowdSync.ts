/**
 * useGlobalLeagueCrowdSync
 *
 * Assina via Realtime as fixtures da Global League do manager.
 * Quando uma fixture muda para 'finished', calcula o resultado e
 * dispara GLOBAL_LEAGUE_MATCH_RESULT para atualizar a torcida local.
 *
 * Roda uma vez por sessão. Evita processar o mesmo fixture_id duas vezes.
 */

import { useEffect, useRef } from 'react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { getSupabase, isSupabaseConfigured } from '@/supabase/client';

export function useGlobalLeagueCrowdSync() {
  const dispatch = useGameDispatch();
  const processedFixtures = useRef(new Set<string>());

  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const club = useGameStore((s) => s.club);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    if (!globalLeagueMVP) return;

    const managerId = managerProfile?.email ?? club?.id;
    if (!managerId) return;

    const myTeam = globalLeagueMVP.teams.find((t) => t.managerId === managerId);
    if (!myTeam) return;

    const sb = getSupabase();
    if (!sb) return;

    const channel = sb
      .channel('global-league-crowd-sync-' + myTeam.id)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'global_league_fixtures',
          filter: 'status=eq.finished',
        },
        (payload) => {
          const fx = payload.new as {
            id: string;
            home_team_id: string;
            away_team_id: string;
            score_home: number;
            score_away: number;
            status: string;
          };

          // Só processa fixtures do time do manager
          const isHome = fx.home_team_id === myTeam.id;
          const isAway = fx.away_team_id === myTeam.id;
          if (!isHome && !isAway) return;

          // Idempotente — não processa o mesmo fixture duas vezes
          if (processedFixtures.current.has(fx.id)) return;
          processedFixtures.current.add(fx.id);

          const goalsFor = isHome ? fx.score_home : fx.score_away;
          const goalsAgainst = isHome ? fx.score_away : fx.score_home;
          const win = goalsFor > goalsAgainst;
          const draw = goalsFor === goalsAgainst;

          console.log(
            '[crowdSync] resultado Global League:',
            win ? 'vitoria' : draw ? 'empate' : 'derrota',
            goalsFor + '-' + goalsAgainst,
          );

          dispatch({
            type: 'GLOBAL_LEAGUE_MATCH_RESULT',
            win,
            draw,
            goalsFor,
            goalsAgainst,
          });
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [globalLeagueMVP, managerProfile, club, dispatch]);
}
