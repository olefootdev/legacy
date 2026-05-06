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
  buildClassicNarrativeProfiles,
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
    homeNarrativeProfiles: ReturnType<typeof buildClassicNarrativeProfiles> | undefined;
  }>(() => {
    if (!playersById || Object.keys(playersById).length === 0) {
      return { home: undefined, away: undefined, homeNarrativeProfiles: undefined };
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

    // AWAY ganha formação aleatória entre as 4 disponíveis — variedade real
    // (não fica preso em 4-3-3). HOME mantém 4-3-3 como base do manager.
    const awayFormationOptions = ['4-3-3', '4-4-2', '4-2-3-1', '5-3-2'] as const;
    const awayFormation = awayFormationOptions[Math.floor(Math.random() * awayFormationOptions.length)];

    const home = buildClassicTeamFromLineup(playersById, lineup, {
      team: 'home',
      starterId,
      formation: '4-3-3',
    });

    const away = fixture?.opponent?.genesisAwayPlayers && fixture.opponent.genesisAwayPlayers.length >= 11
      ? buildClassicTeamFromSquad(fixture.opponent.genesisAwayPlayers, {
          team: 'away',
          formation: awayFormation,
        })
      : buildSyntheticAwayTeam(
          fixture?.opponent?.shortName ?? fixture?.awayName ?? 'ADVERSÁRIO',
          fixture?.opponent?.strength ?? 75,
          { team: 'away', formation: awayFormation },
        );

    if (home.length !== 11 || away.length !== 11) {
      return { home: undefined, away: undefined, homeNarrativeProfiles: undefined };
    }

    const homeNarrativeProfiles = buildClassicNarrativeProfiles(playersById, lineup);

    return { home, away, homeNarrativeProfiles };
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
      homeNarrativeProfiles={teams.homeNarrativeProfiles}
      onExit={() => navigate('/', { replace: true })}
    />
  );
}
