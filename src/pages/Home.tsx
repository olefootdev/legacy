import { useGameDispatch, useGameStore } from '@/game/store';
import { useEffect, useMemo, useState } from 'react';
import { useNextGlobalFixture } from '@/hooks/useNextGlobalFixture';
import { getGlobalLeagueRankingEntries } from '@/ranking/globalLeagueRanking';
import { buildDivisionView } from '@/ranking/divisionStandings';
import { makeInboxItem } from '@/game/inboxItem';
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
import { resolveRequest } from '@/systems/playerPersonality';
import { resolveHomeMode } from './homeMode';
import type { LegendMini } from '@/components/home/LegendsRail';
import { HeroJogo, type HeroFixture } from '@/components/home/volt/HeroJogo';
import { FaixaPontuacao } from '@/components/home/volt/FaixaPontuacao';
import { DecisaoDoDia, type RespostaDada } from '@/components/home/volt/DecisaoDoDia';
import { DivisaoTabela } from '@/components/home/volt/DivisaoTabela';
import { Mosaico } from '@/components/home/volt/Mosaico';
import { Resenha } from '@/components/home/volt/Resenha';
import { Convite } from '@/components/home/volt/Convite';
import { fetchListedLegacyPlayerRows, legacyPortraitImageUrl } from '@/supabase/legacyPlayers';
import { overallFromAttributes } from '@/entities/player';
import { fetchMyOffers } from '@/supabase/marketOffers';
import type { PlayerAttributes } from '@/entities/types';

/** Telemetria de abertura: 1× por carga da página, não por render. */
let openingTracked = false;

/** Hero — asset real do repositório (mesmo do antigo HomeHeroLegacy). */
const HERO_IMAGE = '/hero-legacy-full.png';

/**
 * Home VOLT2 (A VIRADA · V4, 2026-09-19).
 *
 * Um protagonista (o próximo jogo), uma faixa de pontuação, UMA decisão, a
 * divisão, o mosaico 2×2, a Resenha e o convite — nessa ordem, sempre. O slot
 * de decisão mostra o pedido do jogador ou, sem pedido, as pendências do
 * elenco. O `homeMode` continua calculado e medido (telemetria) e vai decidir a
 * variante Dia de Jogo do herói (V5); não reordena mais 13 blocos. Saldo NUNCA
 * aparece aqui.
 *
 * Saíram da Home (decisão aprovada com a proposta "até arrepiei"):
 * HomeImageSlider, ManagerOfDay, RankingTop10, LastGlobalChampion,
 * InheritanceModule, NextMatchCard (virou o herói) e ClubFeed (o inbox já tem
 * o sino do header).
 */
export function Home() {
  useTrackScreen('screen_home');
  const dispatch = useGameDispatch();
  const inbox = useGameStore((s) => s.inbox);
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);
  const playerHealth = useGameStore((s) => s.playerHealth);
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

  // ── Divisão — pela regra que promove de verdade (não pela nota composta) ──
  const divisionView = useMemo(
    () =>
      buildDivisionView({
        teams: globalLeagueMVP?.teams,
        managerId: managerProfile?.email ?? club.id,
        myClubId: club.id,
        promotionPercentage: globalLeagueMVP?.promotionPercentage,
      }),
    [globalLeagueMVP, managerProfile, club.id],
  );
  const roundsLeft = useMemo(() => {
    const rounds = globalLeagueMVP?.leagueRounds;
    if (!rounds || rounds.length === 0) return null;
    return rounds.filter((r) => r.status !== 'finished').length;
  }, [globalLeagueMVP]);

  // ── Mesa do Manager — pendências reais do elenco ─────────────────────────
  const suspendedCount = useMemo(
    () => Object.values(players).filter((p) => (playerHealth?.[p.id]?.suspendedMatches ?? 0) > 0).length,
    [players, playerHealth],
  );
  const expiredCount = useMemo(
    () => Object.values(players).filter((p) => p.contractExpired === true).length,
    [players],
  );

  // ── CLUB PULSE — seis sistemas invisíveis viram um número ────────────────
  const pulse = useClubPulse();

  // ── MODO DA HOME — calculado e medido; decide o slot de decisão ──────────
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
  useEffect(() => {
    if (openingTracked) return;
    openingTracked = true;
    track('pulse_seen', { value: pulse.value, band: pulse.band, trend: pulse.trend, drivers: pulse.drivers.length });
    track('home_mode', { mode: homeMode, hasRequest: (playerRequests?.length ?? 0) > 0 });
  }, [pulse, homeMode, playerRequests]);

  // ── O herói: o próximo jogo, ou a Partida Rápida quando não há jogo ──────
  const heroFixture: HeroFixture | null =
    nextGlobal && nextRoundLabel
      ? {
          opponentName: nextGlobal.opponentName,
          kickoffLabel: nextRoundLabel.replace(', ', ' · '),
          isLive: nextRoundLabel === 'Agora',
          tag: divisionView ? `#ligaglobal #div${divisionView.division}` : '#ligaglobal',
        }
      : null;
  const nextOpponent = nextGlobal
    ? {
        name: nextGlobal.opponentName,
        isToday: new Date(nextGlobal.scheduledKickoffMs).toDateString() === new Date(nowMs).toDateString(),
      }
    : null;

  // ── O vestiário: um pedido por vez; a resposta fica visível na sessão ────
  const pendingRequest = playerRequests?.[0] ?? null;
  const requestPlayer = pendingRequest ? players[pendingRequest.playerId] ?? null : null;
  const [answered, setAnswered] = useState<RespostaDada | null>(null);

  return (
    <div className="w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden">
      <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-7 px-3 pb-6 sm:px-4">
        <div className="flex flex-col gap-[18px]">
          <HeroJogo
            clubName={club.name}
            fixture={heroFixture}
            heroImage={HERO_IMAGE}
            heroImgOk={heroImgOk}
            onHeroError={() => setHeroImgOk(false)}
          />
          <FaixaPontuacao scoreTotal={scoreTotal} scoreToday={scoreToday} rank={myRank} pulse={pulse} />
        </div>

        <DecisaoDoDia
          request={pendingRequest}
          player={requestPlayer ? { pos: requestPlayer.pos, age: requestPlayer.age } : null}
          answered={answered}
          onChoose={(choice) => {
            if (!pendingRequest) return;
            setAnswered({
              playerName: pendingRequest.playerName,
              choice,
              moralDelta: resolveRequest(pendingRequest.kind, choice).moralDelta,
            });
            dispatch({ type: 'RESOLVE_PLAYER_REQUEST', requestId: pendingRequest.id, choice });
          }}
          suspendedCount={suspendedCount}
          expiredCount={expiredCount}
          offersCount={incomingCount}
        />

        {divisionView && (
          <DivisaoTabela view={divisionView} roundsLeft={roundsLeft} nextOpponent={nextOpponent} />
        )}

        <Mosaico
          legend={legends[0] ?? null}
          cupPhase={cupPhaseLabel}
          challenges={dailyChallenges?.challenges ?? []}
          streak={dailyChallenges?.streak}
          onClaim={(challengeId) => dispatch({ type: 'CLAIM_CHALLENGE_REWARD', challengeId })}
        />

        <Resenha activities={marketActivities} nowMs={nowMs} />

        <Convite />
      </div>
    </div>
  );
}
