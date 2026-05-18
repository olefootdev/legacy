import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import type { OpponentStub } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';

/**
 * Modo CLASSIC — usa o plantel real do manager + adversário do `nextFixture`.
 * Se o usuário entrar direto sem passar pelo QuickSearchModal, auto-busca um
 * manager real (fallback bot do pool) para nunca cair no TITANS FC mock.
 */
export function MatchClassic() {
  const navigate = useNavigate();
  const location = useLocation();

  // Estado do manager
  const playersById   = useGameStore(s => s.players);
  const lineupRaw     = useGameStore(s => s.lineup);
  const club          = useGameStore(s => s.club);
  const fixtureBase   = useGameStore(s => s.nextFixture);
  const profile       = useGameStore(s => s.userSettings?.managerProfile);
  const leagueSeason  = useGameStore(s => s.leagueSeason);
  const homeCrestUrl  = useGameStore(s => matchdayHomeCrestUrl(s.userSettings));

  // PvP assíncrono via navigate state (QuickSearchModal) + auto-busca on mount
  // Fix 2026-05-18b: useRef pra evitar loop (playersById muda referência a cada
  // update do store → effect retrigger → setState → loop infinito).
  const pvpStubFromState = (location.state as { pvpOpponentStub?: OpponentStub } | null)?.pvpOpponentStub;
  const [autoOpponent, setAutoOpponent] = useState<OpponentStub | null>(null);
  const autoSearchTriedRef = useRef(false);
  const isPlaceholderOpponent =
    !pvpStubFromState && fixtureBase?.opponent?.id === 'placeholder-opponent';

  useEffect(() => {
    if (!isPlaceholderOpponent || autoSearchTriedRef.current) return;
    autoSearchTriedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const { quickFindOpponent, opponentMatchToStub } = await import('@/match/friendlyMatchmaking');
        const { getSupabase } = await import('@/supabase/client');
        const { getGameState } = await import('@/game/store');
        const sb = getSupabase();
        const userId = sb ? (await sb.auth.getSession()).data.session?.user?.id : undefined;
        const snapshot = getGameState().players;
        const myOverall = Math.round(
          Object.values(snapshot).reduce((s, p) => s + overallFromAttributes(p.attrs), 0) /
            Math.max(1, Object.keys(snapshot).length),
        );
        const match = await quickFindOpponent(club.id, myOverall || 70, userId);
        if (!cancelled) setAutoOpponent(opponentMatchToStub(match, myOverall || 70));
      } catch (err) {
        console.warn('[MatchClassic] auto opponent search failed', err);
        autoSearchTriedRef.current = false;
      }
    })();
    return () => { cancelled = true; };
  }, [isPlaceholderOpponent, club.id]);

  const opponentOverride = pvpStubFromState ?? autoOpponent;
  const fixture = opponentOverride
    ? { ...fixtureBase, opponent: opponentOverride, awayName: opponentOverride.name }
    : fixtureBase;

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
