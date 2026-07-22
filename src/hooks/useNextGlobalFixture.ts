/**
 * useNextGlobalFixture
 *
 * Deriva a próxima partida do manager na Global League a partir do estado
 * hidratado do Supabase (globalLeagueMVP). Retorna null se o manager não
 * estiver inscrito ou não houver rodada futura.
 *
 * Prioridade:
 *   1. Rodada 'scheduled' mais próxima que contém o time do manager
 *   2. Rodada 'live' em andamento
 *
 * Não modifica o store — é um selector puro.
 */

import { useMemo } from 'react';
import { useGameStore } from '@/game/store';
import type { GlobalFixture } from '@/match/globalMatch';

export interface GlobalNextFixture {
  fixture: GlobalFixture;
  roundNumber: number;
  roundType: 'playoff' | 'league';
  scheduledKickoffMs: number;
  isHome: boolean;
  opponentName: string;
  opponentShort: string;
  opponentOverall: number;
  /** Time do coração do adversário (id api-sports) — brasão na Home; undefined = shield neutro. */
  opponentFavoriteTeamId?: number;
  myTeamName: string;
  myTeamId: string;
  division: string;
  injuryRoundsRemaining: number;
  injuryModifier: number;
  yellowCardCount: number;
  suspensionRoundsRemaining: number;
}

export function useNextGlobalFixture(): GlobalNextFixture | null {
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const club = useGameStore((s) => s.club);

  return useMemo(() => {
    if (!globalLeagueMVP) return null;
    if (globalLeagueMVP.status === 'waiting_teams') return null;

    const managerId = managerProfile?.email ?? club?.id;
    if (!managerId) return null;

    const myTeam = globalLeagueMVP.teams.find((t) => t.managerId === managerId);
    if (!myTeam) return null;

    // Junta todas as rodadas (playoffs + liga) ordenadas por número
    type AnyRound = {
      roundNumber: number;
      roundType: 'playoff' | 'league';
      status: string;
      scheduledKickoffMs: number;
      fixtures: GlobalFixture[];
    };

    const allRounds: AnyRound[] = [
      ...globalLeagueMVP.playoffRounds.map((r) => ({
        roundNumber: r.roundNumber,
        roundType: 'playoff' as const,
        status: r.status,
        scheduledKickoffMs: r.scheduledKickoffMs,
        fixtures: r.fixtures,
      })),
      ...globalLeagueMVP.leagueRounds.map((r) => ({
        roundNumber: r.roundNumber,
        roundType: 'league' as const,
        status: r.status,
        scheduledKickoffMs: r.scheduledKickoffMs,
        fixtures: r.fixtures,
      })),
    ].sort((a, b) => a.scheduledKickoffMs - b.scheduledKickoffMs);

    // Busca a rodada mais próxima (scheduled ou live) com fixture do manager
    for (const round of allRounds) {
      if (round.status !== 'scheduled' && round.status !== 'live') continue;

      const fx = round.fixtures.find(
        (f) => f.homeTeamId === myTeam.id || f.awayTeamId === myTeam.id,
      );
      if (!fx) continue;

      const isHome = fx.homeTeamId === myTeam.id;
      const opponentId = isHome ? fx.awayTeamId : fx.homeTeamId;
      const opponentName = isHome ? fx.awayTeamName : fx.homeTeamName;
      const opponentOverall = isHome ? fx.awayOverall : fx.homeOverall;
      const opponentShort = opponentName.slice(0, 3).toUpperCase();
      const opponentTeam = globalLeagueMVP.teams.find((t) => t.id === opponentId);

      return {
        fixture: fx,
        roundNumber: round.roundNumber,
        roundType: round.roundType,
        scheduledKickoffMs: round.scheduledKickoffMs,
        isHome,
        opponentName,
        opponentShort,
        opponentOverall,
        opponentFavoriteTeamId: opponentTeam?.favoriteTeamId,
        myTeamName: myTeam.clubName,
        myTeamId: myTeam.id,
        division: fx.division,
        injuryRoundsRemaining: myTeam.injuryRoundsRemaining ?? 0,
        injuryModifier: myTeam.injuryModifier ?? 0,
        yellowCardCount: myTeam.yellowCardCount ?? 0,
        suspensionRoundsRemaining: myTeam.suspensionRoundsRemaining ?? 0,
      };
    }

    return null;
  }, [globalLeagueMVP, managerProfile, club]);
}
