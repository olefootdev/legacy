import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClassicMatchScreen } from '@/components/classic/ClassicMatchScreen';
import { useGameStore } from '@/game/store';
import { mergeLineupWithDefaults } from '@/entities/lineup';
import { matchdayHomeCrestUrl } from '@/settings/matchdayCrest';
import {
  buildClassicTeamFromLineup,
  buildClassicTeamFromSquad,
  buildSyntheticAwayTeam,
} from '@/engine/classic/realPlayers';
import type { ClassicPlayer } from '@/engine/classic/types';

/**
 * Modo CLASSIC — usa o plantel real do manager + adversário do `nextFixture`.
 * Cai pra demo (TIGRES vs ALVORADA FC) quando não há manager logado.
 */
export function MatchClassic() {
  const navigate = useNavigate();

  // Estado do manager
  const playersById   = useGameStore(s => s.players);
  const lineupRaw     = useGameStore(s => s.lineup);
  const club          = useGameStore(s => s.club);
  const fixture       = useGameStore(s => s.nextFixture);
  const profile       = useGameStore(s => s.userSettings?.managerProfile);
  const leagueSeason  = useGameStore(s => s.leagueSeason);
  const homeCrestUrl  = useGameStore(s => matchdayHomeCrestUrl(s.userSettings));

  const teams = useMemo<{
    home: ClassicPlayer[] | undefined;
    away: ClassicPlayer[] | undefined;
  }>(() => {
    if (!playersById || Object.keys(playersById).length === 0) {
      return { home: undefined, away: undefined };
    }
    const lineup = mergeLineupWithDefaults(lineupRaw ?? {}, playersById);

    // Identifica destaque casa: jogador com maior OVR
    const all = Object.values(playersById);
    const starterId = all
      .slice()
      .sort((a, b) => {
        const av = a.attrs?.finalizacao ?? 60;
        const bv = b.attrs?.finalizacao ?? 60;
        return bv - av;
      })[0]?.id;

    const home = buildClassicTeamFromLineup(playersById, lineup, {
      team: 'home',
      starterId,
      formation: '4-3-3',
    });

    const away = fixture?.opponent?.genesisAwayPlayers && fixture.opponent.genesisAwayPlayers.length >= 11
      ? buildClassicTeamFromSquad(fixture.opponent.genesisAwayPlayers, {
          team: 'away',
          formation: '4-3-3',
        })
      : buildSyntheticAwayTeam(
          fixture?.opponent?.shortName ?? fixture?.awayName ?? 'ADVERSÁRIO',
          fixture?.opponent?.strength ?? 75,
          { team: 'away', formation: '4-3-3' },
        );

    if (home.length !== 11 || away.length !== 11) {
      return { home: undefined, away: undefined };
    }
    return { home, away };
  }, [playersById, lineupRaw, fixture]);

  const homeTeamName    = club?.name      ?? 'TIGRES';
  const homeTeamShort   = club?.shortName ?? homeTeamName.slice(0, 3).toUpperCase();
  const awayTeamName    = fixture?.opponent?.name      ?? 'ALVORADA FC';
  const awayTeamShort   = fixture?.opponent?.shortName ?? awayTeamName.slice(0, 3).toUpperCase();
  const homeManager     = profile?.firstName ? `${profile.firstName}`.toUpperCase() : 'JONES';
  const round           = (leagueSeason?.played ?? 11) + 1;

  return (
    <ClassicMatchScreen
      config={{
        homeTeam:     homeTeamName,
        awayTeam:     awayTeamName,
        homeShort:    homeTeamShort,
        awayShort:    awayTeamShort,
        homeCrestUrl,
        awayCrestUrl: fixture?.opponent?.supporterCrestUrl ?? null,
        homeManager,
        awayManager:  'CPU',
        round,
        competition:  'CLASSIC LEAGUE',
      }}
      homePlayers={teams.home}
      awayPlayers={teams.away}
      onExit={() => navigate('/', { replace: true })}
    />
  );
}
