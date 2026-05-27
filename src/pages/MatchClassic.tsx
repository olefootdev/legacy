import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ClassicMatchScreen } from '@/components/classic/ClassicMatchScreen';
import { useGameStore, useGameDispatch } from '@/game/store';
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
  const dispatch      = useGameDispatch();

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
        if (cancelled) return;
        const stub = opponentMatchToStub(match, myOverall || 70);
        setAutoOpponent(stub);
        dispatch({ type: 'ADMIN_PATCH_NEXT_FIXTURE', partial: { opponent: stub, awayName: stub.name } });
      } catch (err) {
        console.warn('[MatchClassic] auto opponent search failed', err);
        if (cancelled) return;
        // Não cai em bot — UI exibe "Nenhum manager disponível" via NO_OPPONENT_STUB_ID.
        const { opponentMatchToStub } = await import('@/match/friendlyMatchmaking');
        const myOverall = 70;
        const stub = opponentMatchToStub({ type: 'none' }, myOverall);
        setAutoOpponent(stub);
        dispatch({ type: 'ADMIN_PATCH_NEXT_FIXTURE', partial: { opponent: stub, awayName: stub.name } });
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

  // Gate: nunca joga contra placeholder/bot. Mostra mensagem honesta.
  const opponentId = fixture?.opponent?.id;
  if (opponentId === 'no-opponent-available') {
    return (
      <div className="flex w-full min-h-svh items-center justify-center bg-deep-black px-6">
        <div className="max-w-md text-center space-y-6">
          <div className="ole-eyebrow !text-neon-yellow"><span>Partida clássica</span></div>
          <h1
            className="text-white italic"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontWeight: 700,
              fontSize: 'clamp(28px, 5vw, 44px)',
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
            }}
          >
            Nenhum manager disponível
          </h1>
          <p className="text-white/65 text-sm leading-relaxed">
            A Olefoot não tem partidas contra bots. Estamos procurando outro manager pra ti — tenta de novo em alguns segundos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-neon-yellow text-black px-5 py-2.5 hover:bg-white transition-colors"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '11px',
                fontWeight: 900,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Procurar de novo
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="border border-white/15 text-white/80 px-5 py-2.5 hover:border-neon-yellow hover:text-neon-yellow transition-colors"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Voltar pra Home
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        opponentUserId: fixture?.opponent?.id && !fixture.opponent.id.startsWith('bot-') && !fixture.opponent.id.startsWith('placeholder') ? fixture.opponent.id : null,
      }}
      homePlayers={teams.home}
      awayPlayers={teams.away}
      homeNarrativeProfiles={teams.homeNarrativeProfiles}
      onExit={() => navigate('/', { replace: true })}
    />
  );
}
