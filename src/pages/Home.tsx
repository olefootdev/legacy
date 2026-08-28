import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGameDispatch, useGameStore } from '@/game/store';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNextGlobalFixture } from '@/hooks/useNextGlobalFixture';
import { getGlobalLeagueRankingEntries } from '@/ranking/globalLeagueRanking';
import { makeInboxItem } from '@/game/inboxItem';
import { MarketActivityFeed } from '@/market/MarketActivityFeed';
import { fetchMarketActivities } from '@/supabase/marketActivities';
import type { MarketActivity } from '@/market/socialTrade';
import { shouldResetDailyChallenges } from '@/game/dailyChallenges';
import { shouldRefreshChallenges } from '@/match/quickStreakChallenges';
import { fetchMyPendingPvpResults, claimPvpMatchResult } from '@/supabase/pvpMatches';
import { managerScoreToday } from '@/systems/managerScore/managerScore';
import { roundOf } from '@/match/legendsCup/legendsCupModel';
import { useTrackScreen } from '@/progression/trackEvent';
import { useClubPulse } from '@/hooks/useClubPulse';
import { track } from '@/analytics/track';
import { resolveHomeMode, blockOrderFor, type HomeBlock } from './homeMode';
import { HeroCinematic } from '@/components/home/HeroCinematic';
import { HomeImageSlider } from '@/components/home/HomeImageSlider';
import { NextMatchCard } from '@/components/home/NextMatchCard';
import { matchdayHomeCrestUrl } from '@/settings/matchdayCrest';
import { localCrestUrl } from '@/settings/crestUrl';
import { LegendsRail, type LegendMini } from '@/components/home/LegendsRail';
import { ManagerDesk } from '@/components/home/ManagerDesk';
import { InheritanceModule } from '@/components/home/InheritanceModule';
import { ManagerOfDay } from '@/components/home/ManagerOfDay';
import { ReferralInvite } from '@/components/home/ReferralInvite';
import { DailyMissions } from '@/components/home/DailyMissions';
import { ClubFeed } from '@/components/home/ClubFeed';
import { PlayerRequestCard } from '@/components/home/PlayerRequestCard';
import { DivisionRanking } from '@/components/home/DivisionRanking';
import { RankingTop10 } from '@/components/home/RankingTop10';
import { LastGlobalChampion } from '@/components/home/LastGlobalChampion';
import { fetchListedLegacyPlayerRows, legacyPortraitImageUrl } from '@/supabase/legacyPlayers';
import { overallFromAttributes } from '@/entities/player';
import { fetchMyOffers } from '@/supabase/marketOffers';
import type { PlayerAttributes, PlayerEntity } from '@/entities/types';

/** Telemetria de abertura: 1× por carga da página, não por render. */
let openingTracked = false;

/** Hero — asset real do repositório (mesmo do antigo HomeHeroLegacy). */
const HERO_IMAGE = '/hero-legacy-full.png';

/** Header compacto de seção — rail + label Agency (copy mínima). */

export function Home() {
  useTrackScreen('screen_home');
  const dispatch = useGameDispatch();
  const inbox = useGameStore((s) => s.inbox);
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);
  const playerHealth = useGameStore((s) => s.playerHealth);
  const ligaOleNemesis = useGameStore((s) => s.ligaOleNemesis);
  // Propostas de compra recebidas (P2P) — alimenta a Mesa do Manager.
  // Seletor com referência ESTÁVEL (nada de `?? []` no selector, que quebra o
  // cache do useSyncExternalStore e derruba a Home em loop). O count sai daqui;
  // o refetch real do servidor roda 1× no mount logo abaixo.
  const incomingOffers = useGameStore((s) => s.managerProspectMarket?.incomingOffers);
  const incomingCount = incomingOffers?.length ?? 0;

  // Próxima partida real da Global League
  const nextGlobal = useNextGlobalFixture();
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  // Identidade do manager na Liga Global (manager_id = email ?? club.id).
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const favoriteRealTeam = useGameStore((s) => s.userSettings?.favoriteRealTeam ?? null);
  const dailyChallenges = useGameStore((s) => s.dailyChallenges);
  const streakChallenges = useGameStore((s) => s.streakChallenges);
  // REBRAND — pontuação do manager (eixo da Home nova).
  const managerScore = useGameStore((s) => s.managerScore);
  const legendsCup = useGameStore((s) => s.legendsCup);
  // Fase 4 — pedido de jogador aguardando resposta (no máximo 1 por vez).
  const playerRequests = useGameStore((s) => s.playerRequests);
  // Flash de título/eliminação — efêmero, manda a Home entrar em modo festa.
  const ligaOleResultFlash = useGameStore((s) => s.ligaOleResultFlash);
  const legendsCupResultFlash = useGameStore((s) => s.legendsCupResultFlash);

  // Inicializa/renova engagement state quando user abre a Home.
  // Daily reseta por UTC day; streak por semana. Garante que o progress tracker
  // do reducer encontre o state já populado (ele só atua quando state existe).
  useEffect(() => {
    if (!dailyChallenges || shouldResetDailyChallenges(dailyChallenges.lastResetDate)) {
      dispatch({ type: 'RESET_DAILY_CHALLENGES' });
    }
    if (!streakChallenges || shouldRefreshChallenges(streakChallenges)) {
      dispatch({ type: 'REFRESH_STREAK_CHALLENGES' });
    }
  }, [dispatch, dailyChallenges, streakChallenges]);

  // Auto-claim de resultados PvP pendentes (partidas que outros managers
  // jogaram contra mim enquanto eu estava offline). Aplica EXP local + marca
  // como claimed no servidor. Roda 1× no mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const pending = await fetchMyPendingPvpResults();
      if (cancelled || pending.length === 0) return;
      for (const p of pending) {
        const claimed = await claimPvpMatchResult(p.id);
        if (cancelled || claimed <= 0) continue;
        const outcome: 'win' | 'draw' | 'loss' =
          p.outcome === 'away_win' ? 'win' : p.outcome === 'draw' ? 'draw' : 'loss';
        const opponentLabel = p.opponentClubName ?? p.opponentDisplayName ?? 'Manager';
        dispatch({
          type: 'WALLET_RECEIVE_PVP_REWARD',
          amount: claimed,
          mode: p.mode,
          outcome,
          opponentLabel,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // Adiciona notificação de boas-vindas na primeira visita
  useEffect(() => {
    const hasWelcomeNotification = inbox.some(
      (item) => item.id === 'olefoot-welcome-v1'
    );
    if (!hasWelcomeNotification) {
      dispatch({
        type: 'INBOX_PREPEND',
        item: makeInboxItem(
          'olefoot-welcome-v1',
          'COMPANY_ANNOUNCEMENT',
          'CLUBE',
          'Bem Vindo ao Olefoot',
          {
            body: 'A Olefoot chega hoje carregando a alma do futebol que aprendemos a amar — aquele de táticas pensadas, decisões de boleiro e histórias que atravessam gerações.',
            tag: 'Olefoot',
            timeLabel: 'Agora',
          }
        ),
      });
    }
  }, [dispatch, inbox]);

  const [heroImgOk, setHeroImgOk] = useState(true);

  // Atividades reais do mercado — feed público do Supabase
  const [marketActivities, setMarketActivities] = useState<MarketActivity[]>([]);
  useEffect(() => {
    void fetchMarketActivities(10).then(setMarketActivities);
  }, []);

  // Propostas P2P — refetch real 1× no mount (sincroniza a Mesa do Manager
  // com o servidor). Silencioso: mercado offline não quebra a Home.
  useEffect(() => {
    void fetchMyOffers()
      .then(({ incoming, outgoing }) => {
        dispatch({ type: 'SET_MARKET_OFFERS', incoming, outgoing });
      })
      .catch(() => {});
  }, [dispatch]);

  // Lendas em destaque — drops reais do Supabase (legacy_players listadas),
  // ordenadas por created_at desc. Selo "Novo" só nas realmente recentes.
  const [legends, setLegends] = useState<LegendMini[]>([]);
  useEffect(() => {
    void fetchListedLegacyPlayerRows().then((rows) => {
      const sorted = [...rows].sort((a, b) => {
        const ta = a.created_at ? Date.parse(a.created_at) : 0;
        const tb = b.created_at ? Date.parse(b.created_at) : 0;
        return tb - ta;
      });
      const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
      setLegends(
        sorted.slice(0, 6).map((r) => ({
          id: r.id,
          name: r.name.trim(),
          pos: r.pos,
          ovr: overallFromAttributes(r.attributes as unknown as PlayerAttributes, r.pos),
          portraitUrl: legacyPortraitImageUrl(r),
          isNew: r.created_at ? Date.now() - Date.parse(r.created_at) < NEW_WINDOW_MS : false,
        })),
      );
    });
  }, []);

  // Relógio da Home — alimenta countdown da próxima rodada + delta "hoje".
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const iv = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);


  // Ranking real — MESMA fonte do /competicao/ranking (times da Liga Global).
  // Alimenta o rank do hero e o top 5 da seção Ranking.
  const rankedEntries = useMemo(
    () =>
      getGlobalLeagueRankingEntries(
        globalLeagueMVP?.teams,
        managerProfile?.email ?? club.id,
        club.id,
      ),
    [globalLeagueMVP, managerProfile, club.id],
  );
  const myRankIdx = useMemo(() => rankedEntries.findIndex((r) => r.isMe), [rankedEntries]);
  const myRank = myRankIdx >= 0 ? myRankIdx + 1 : null;


  // ── REBRAND: dados do cockpit ────────────────────────────────────────────

  const scoreTotal = managerScore?.total ?? 0;
  const scoreToday = managerScoreToday(managerScore, nowMs);
  const managerFirstName = managerProfile?.firstName?.trim() || 'Manager';

  /** Countdown da próxima rodada da Liga Global. */
  const nextRoundLabel = useMemo(() => {
    if (!nextGlobal) return null;
    const diff = nextGlobal.scheduledKickoffMs - nowMs;
    if (diff <= 0) return 'Agora';
    if (diff < 3_600_000) {
      const mm = Math.floor(diff / 60_000);
      const ss = Math.floor((diff % 60_000) / 1000);
      return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }
    const d = new Date(nextGlobal.scheduledKickoffMs);
    const isToday = d.toDateString() === new Date(nowMs).toDateString();
    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return isToday
      ? `Hoje, ${timeStr}`
      : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${timeStr}`;
  }, [nextGlobal, nowMs]);

  /** Legends Cup — campanha ativa mostra a fase atual. */
  const cupActive = legendsCup?.status === 'active';
  const cupPhaseLabel = cupActive ? roundOf(legendsCup!.roundIndex) : null;

  const myEntry = myRankIdx >= 0 ? rankedEntries[myRankIdx] : null;

  // ── Ranking Top 10 (aba Geral real) + Manager do Dia (líder #1) ──────────
  const top10 = useMemo(
    () => rankedEntries.slice(0, 10).map((r) => ({ entryId: r.entryId, team: r.team, points: r.points, isMe: r.isMe })),
    [rankedEntries],
  );
  const myRow = myEntry
    ? { entryId: myEntry.entryId, team: myEntry.team, points: myEntry.points, isMe: true }
    : null;
  const leader = rankedEntries[0] ?? null;

  // ── Ranking da DIVISÃO do manager ────────────────────────────────────────
  // Mesmo dado do ranking geral, recortado pela divisão em que ele compete —
  // que é onde promoção e rebaixamento realmente acontecem. rankedEntries já
  // vem ordenado por score, então filtrar preserva a ordem.
  const myDivision = myEntry?.division ?? null;
  const divisionEntries = useMemo(
    () => (myDivision != null ? rankedEntries.filter((r) => r.division === myDivision) : []),
    [rankedEntries, myDivision],
  );
  const divisionTop10 = useMemo(
    () => divisionEntries.slice(0, 10).map((r) => ({ entryId: r.entryId, team: r.team, points: r.points, isMe: r.isMe })),
    [divisionEntries],
  );
  const myDivisionRankIdx = useMemo(() => divisionEntries.findIndex((r) => r.isMe), [divisionEntries]);
  const myDivisionRank = myDivisionRankIdx >= 0 ? myDivisionRankIdx + 1 : null;

  // ── Mesa do Manager — pendências reais do elenco ─────────────────────────
  const suspendedCount = useMemo(
    () => Object.values(players).filter((p) => (playerHealth?.[p.id]?.suspendedMatches ?? 0) > 0).length,
    [players, playerHealth],
  );
  const expiredCount = useMemo(
    () => Object.values(players).filter((p) => p.contractExpired === true).length,
    [players],
  );

  // ── Herança (Messi→Yamal) — lenda do plantel aponta a joia da base ───────
  const inheritance = useMemo(() => {
    const all = Object.values(players);
    const isLegacyPlayer = (p: PlayerEntity) => p.isLegacy === true || p.id.startsWith('legacy-');
    const legacies = all.filter(isLegacyPlayer);
    if (legacies.length === 0) return null;
    const legend = legacies.reduce((best, p) =>
      overallFromAttributes(p.attrs, p.pos) > overallFromAttributes(best.attrs, best.pos) ? p : best,
    );
    const youths = all.filter((p) => !isLegacyPlayer(p));
    let jewel: PlayerEntity | undefined = youths.find((p) => p.archetype === 'novo_talento');
    if (!jewel && youths.length > 0) {
      jewel = youths
        .slice()
        .sort((a, b) => {
          const ageA = a.age ?? 99;
          const ageB = b.age ?? 99;
          if (ageA !== ageB) return ageA - ageB;
          return (b.evolutionRate ?? 0) - (a.evolutionRate ?? 0);
        })[0];
    }
    if (!jewel) return null;
    return {
      legend: { name: legend.name, num: legend.num },
      jewel: { name: jewel.name, num: jewel.num },
    };
  }, [players]);

  // ── Nemesis — próximo adversário é o algoz da última Liga Ole? ───────────
  const isNemesisNext = !!(
    ligaOleNemesis &&
    nextGlobal &&
    ligaOleNemesis.name.trim().toLowerCase() === nextGlobal.opponentName.trim().toLowerCase()
  );

  const cupSublabel = cupActive && cupPhaseLabel ? `Legends Cup · ${cupPhaseLabel}` : 'Legends Cup · comece agora';

  // ── CLUB PULSE — seis sistemas invisíveis viram um número no cockpit ─────
  const pulse = useClubPulse();

  // ── MODO DA HOME — a tela reage ao estado do clube (Fase 1) ──────────────
  // Nenhum bloco novo: só muda QUAL sobe pro topo. Ver src/pages/homeMode.ts.
  const injuredCount = useMemo(
    () => Object.values(players).filter((p) => (playerHealth?.[p.id]?.outForMatches ?? 0) > 0).length,
    [players, playerHealth],
  );
  const hasResultFlash = !!(ligaOleResultFlash || legendsCupResultFlash);
  const homeMode = useMemo(
    () =>
      resolveHomeMode({
        nextKickoffMs: nextGlobal?.scheduledKickoffMs ?? null,
        incomingOffersCount: incomingCount,
        suspendedCount,
        expiredCount,
        injuredCount,
        hasResultFlash,
        nowMs,
      }),
    [nextGlobal, incomingCount, suspendedCount, expiredCount, injuredCount, hasResultFlash, nowMs],
  );

  // ── Telemetria de abertura (Fase 1) ──────────────────────────────────────
  // Em que estado o clube abre, e qual modo a Home escolheu. É o que permite
  // perguntar depois: quem abre "em crise" volta amanhã? O modo matchday
  // realmente pega gente antes do jogo?
  useEffect(() => {
    if (openingTracked) return;
    openingTracked = true;
    track('pulse_seen', { value: pulse.value, band: pulse.band, trend: pulse.trend, drivers: pulse.drivers.length });
    track('home_mode', { mode: homeMode, hasRequest: (playerRequests?.length ?? 0) > 0 });
  }, [pulse, homeMode, playerRequests]);

  // ── Blocos da Home ────────────────────────────────────────────────────────
  // Cada entrada é um bloco que JÁ existia. O que a Fase 1 mudou é só a ORDEM:
  // `blockOrderFor(homeMode)` decide o que sobe. Bloco sem dado devolve null e
  // simplesmente não aparece — nenhum some da lista por decisão de layout.
  const pendingRequest = playerRequests?.[0] ?? null;

  const blocks: Record<HomeBlock, ReactNode> = {
    // O vestiário fala. É a única decisão da Home que muda relação, moral e,
    // por consequência, a obediência do jogador dentro de campo.
    playerRequest: pendingRequest ? (
      <PlayerRequestCard
        key="playerRequest"
        request={pendingRequest}
        onChoose={(choice) =>
          dispatch({ type: 'RESOLVE_PLAYER_REQUEST', requestId: pendingRequest.id, choice })
        }
      />
    ) : null,

    slider: <HomeImageSlider key="slider" />,

    nextMatch: (
      <NextMatchCard
        key="nextMatch"
        clubName={club.name}
        opponentName={nextGlobal ? nextGlobal.opponentName : null}
        kickoffMs={nextGlobal ? nextGlobal.scheduledKickoffMs : null}
        isLive={nextRoundLabel === 'Agora'}
        isNemesis={isNemesisNext}
        myCrestUrl={matchdayHomeCrestUrl({ favoriteRealTeam })}
        opponentCrestUrl={
          nextGlobal?.opponentFavoriteTeamId != null ? localCrestUrl(nextGlobal.opponentFavoriteTeamId) : null
        }
      />
    ),

    // O clube contando o que fez — inbox tipado, que só vivia num dropdown.
    feed: <ClubFeed key="feed" inbox={inbox} />,

    managerDesk: (
      <ManagerDesk
        key="managerDesk"
        suspendedCount={suspendedCount}
        expiredCount={expiredCount}
        offersCount={incomingCount}
      />
    ),

    managerOfDay: leader ? (
      <ManagerOfDay key="managerOfDay" clubName={leader.team} points={leader.points} overall={leader.overall} />
    ) : null,

    legends: <LegendsRail key="legends" legends={legends} />,

    rankingTop10: <RankingTop10 key="rankingTop10" top={top10} myRow={myRow} myRank={myRank} />,

    divisionRanking: (
      <DivisionRanking
        key="divisionRanking"
        division={myDivision}
        top={divisionTop10}
        myRow={myRow}
        myRank={myDivisionRank}
        divisionSize={divisionEntries.length}
      />
    ),

    lastChampion: <LastGlobalChampion key="lastChampion" />,

    inheritance: inheritance ? (
      <InheritanceModule key="inheritance" legend={inheritance.legend} jewel={inheritance.jewel} />
    ) : null,

    // A Resenha — o MUNDO. Seção editorial que sangra a largura com fundo
    // próprio: é o terceiro tempo do ritmo de cor da Home (amarelo da Mesa →
    // preto → editorial), em vez de mais um card igual aos de cima.
    resenha: (
      <section
        key="resenha"
        aria-label="A Resenha"
        className="ole-bleed"
        style={{ background: '#15130c', paddingBlock: 'clamp(22px, 5vw, 34px)' }}
      >
        <span className="ole-eyebrow-poster" style={{ fontSize: '12px' }}>
          O mundo se mexeu
        </span>
        <h2
          className="mb-4 mt-2 font-impact uppercase text-white"
          style={{ fontSize: 'clamp(26px, 6vw, 40px)', lineHeight: 0.9, letterSpacing: '-0.01em' }}
        >
          A Resenha
        </h2>

        <MarketActivityFeed activities={marketActivities} maxVisible={5} />

        <Link
          to="/mercado/transfer"
          className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-white/55 hover:text-neon-yellow transition-colors font-display font-bold uppercase"
          style={{ fontSize: '10px', letterSpacing: '0.22em' }}
        >
          Ir ao mercado
          <ChevronRight className="w-4 h-4" aria-hidden />
        </Link>
      </section>
    ),

    // O par que fecha a Home: o que traz gente nova (indicação) e o que traz a
    // pessoa de volta amanhã (missões). Cada um some sozinho quando não tem dado.
    referralAndMissions: (
      <div key="referralAndMissions" className="grid gap-4 min-[700px]:grid-cols-2">
        <ReferralInvite />
        <DailyMissions
          challenges={dailyChallenges?.challenges ?? []}
          streak={dailyChallenges?.streak}
          onClaim={(challengeId) => dispatch({ type: 'CLAIM_CHALLENGE_REWARD', challengeId })}
        />
      </div>
    ),
  };

  return (
    <div className="w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden">
      <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-4 px-3 sm:px-4">

        {/* Dobra 1 — trailer cinematográfico do manager + CLUB PULSE */}
        <HeroCinematic
          clubName={club.name}
          managerName={managerFirstName}
          scoreTotal={scoreTotal}
          scoreToday={scoreToday}
          rank={myRank}
          heroImage={HERO_IMAGE}
          heroImgOk={heroImgOk}
          onHeroError={() => setHeroImgOk(false)}
          cupSublabel={cupSublabel}
          pulse={pulse}
        />

        {/* O resto da Home na ordem que o ESTADO do clube pede. */}
        {blockOrderFor(homeMode).map((id) => blocks[id])}
      </div>
    </div>
  );
}
