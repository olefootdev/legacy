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
import { useLegendDrops } from '@/components/home/rua/useLegendDrops';
import { FitaRua, MarcaRua } from '@/components/ui/Rua';
import { Ingresso, type IngressoFixture } from '@/components/home/rua/Ingresso';
import { FaixaRespeito } from '@/components/home/rua/FaixaRespeito';
import { Vestiario, type RespostaDada } from '@/components/home/rua/Vestiario';
import { QuantoFalta } from '@/components/home/rua/QuantoFalta';
import { MissoesRua } from '@/components/home/rua/MissoesRua';
import { DropLenda } from '@/components/home/rua/DropLenda';
import { LegendsCupRua } from '@/components/home/rua/LegendsCupRua';
import { Carteirinha } from '@/components/home/rua/Carteirinha';
import { ResenhaRua } from '@/components/home/rua/ResenhaRua';
import { ConviteFaixa } from '@/components/home/rua/ConviteFaixa';
import { ConviteFundacao } from '@/components/home/rua/ConviteFundacao';
import { fetchMyOffers } from '@/supabase/marketOffers';
import { L, LOCALE } from '@/i18n/L';

/** Rótulo de "agora" do countdown — também usado pra marcar o herói como ao vivo. */
const AGORA_LABEL = L('Agora', 'Now');

/** Telemetria de abertura: 1× por carga da página, não por render. */
let openingTracked = false;

/**
 * Home 2027 — DS "RESPEITO É OURO" (olefoot-design-27/, 2026-10-07).
 *
 * Preto de asfalto com grão, a fita #persista #correloko, a saudação na voz, o
 * INGRESSO do próximo jogo (ou da Partida Rápida), a faixa de respeito, UMA
 * decisão, as missões à vista, "quanto falta pra subir", o drop de lenda na
 * escada, Legends Cup, a carteirinha de sócio, a Resenha, a faixa do convite
 * e a assinatura. Saldo NUNCA aparece aqui (é da Carteira). Ouro é chapado e
 * raro: posição no mundo, carta de respeito/lenda, sócio — nada de degradê.
 *
 * O `homeMode` continua calculado e medido (telemetria). Os blocos VOLT2 de
 * `components/home/volt/` seguem vivos só no preview de dev.
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
          L('Bem Vindo ao Olefoot', 'Welcome to Olefoot'),
          {
            body: L(
              'A Olefoot chega hoje carregando a alma do futebol que aprendemos a amar — aquele de táticas pensadas, decisões de boleiro e histórias que atravessam gerações.',
              'Olefoot arrives today carrying the soul of the football we learned to love — smart tactics, real football calls and stories that cross generations.',
            ),
            tag: 'Olefoot',
            timeLabel: L('Agora', 'Now'),
          }
        ),
      });
    }
  }, [dispatch, inbox]);

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

  // Lendas em destaque — drops reais do Supabase (legacy_players listadas).
  const legends = useLegendDrops(6);

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
    if (diff <= 0) return AGORA_LABEL;
    if (diff < 3_600_000) {
      const mm = Math.floor(diff / 60_000);
      const ss = Math.floor((diff % 60_000) / 1000);
      return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }
    const d = new Date(nextGlobal.scheduledKickoffMs);
    const isToday = d.toDateString() === new Date(nowMs).toDateString();
    const timeStr = d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
    return isToday
      ? L(`Hoje, ${timeStr}`, `Today, ${timeStr}`)
      : `${d.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit' })}, ${timeStr}`;
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

  // ── O herói: o ingresso do próximo jogo, ou da Partida Rápida ──────────
  const heroFixture: IngressoFixture | null =
    nextGlobal && nextRoundLabel
      ? {
          opponentName: nextGlobal.opponentName,
          kickoffLabel: nextRoundLabel.replace(', ', ' · '),
          isLive: nextRoundLabel === AGORA_LABEL,
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

  const firstName = managerProfile?.firstName?.trim() || null;
  const managerName = managerProfile ? [managerProfile.firstName, managerProfile.lastName].filter(Boolean).join(' ').trim() || null : null;
  const hoje = new Date(nowMs);
  const carimbo = `${hoje.toLocaleDateString(LOCALE, { weekday: 'short' }).replace('.', '')} ${String(hoje.getDate()).padStart(2, '0')}.${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden">
      <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-10 px-3 pb-8 sm:px-4">
        {/* A fita da casa — #persista #correloko, colada torta no topo. */}
        <FitaRua className="-mx-3 -mt-3 py-2 sm:-mx-4" />

        <div className="flex flex-col gap-5">
          <header className="flex min-w-0 items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <h1 className="block min-w-0 truncate font-voz text-[clamp(38px,10.5vw,56px)] leading-[0.95] text-papel">
                {firstName ? L(`E aí, ${firstName}`, `Yo, ${firstName}`) : L('E aí, manager', 'Yo, manager')}
              </h1>
              <span className="block min-w-0 truncate font-prova text-[12px] font-bold uppercase tracking-[0.2em] text-mudo">
                {club.name}
                {myRank != null && <span className="text-ouro-27"> · #{myRank} {L('no mundo', 'worldwide')}</span>}
              </span>
            </div>
            <span className="shrink-0 font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">{carimbo}</span>
          </header>

          <Ingresso clubName={club.name} fixture={heroFixture} division={divisionView?.division ?? null} rank={myRank} />
          <FaixaRespeito scoreTotal={scoreTotal} scoreToday={scoreToday} rank={myRank} pulse={pulse} />
        </div>

        <ConviteFundacao />

        <Vestiario
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

        <MissoesRua
          challenges={dailyChallenges?.challenges ?? []}
          streak={dailyChallenges?.streak}
          onClaim={(challengeId) => dispatch({ type: 'CLAIM_CHALLENGE_REWARD', challengeId })}
        />

        {divisionView && <QuantoFalta view={divisionView} roundsLeft={roundsLeft} nextOpponent={nextOpponent} />}

        <DropLenda legends={legends} />

        <div className="grid grid-cols-1 gap-4">
          <LegendsCupRua phase={cupPhaseLabel} />
          <Carteirinha managerName={managerName} clubName={club.name} />
        </div>

        <ResenhaRua activities={marketActivities} nowMs={nowMs} />

        <ConviteFaixa />

        {/* Assinatura — o fecho de toda peça do DS 2027. */}
        <footer className="flex min-w-0 items-end justify-between gap-4 border-t-2 border-linha pt-6">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="font-voz text-[clamp(36px,10vw,52px)] leading-none text-ouro-27">{L('Respeito é ouro.', 'Respect is gold.')}</span>
            <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
              {L('Olefoot · T2027 · da rua pro mundo', 'Olefoot · S2027 · from the street to the world')}
            </span>
          </div>
          <MarcaRua tipo="nove" className="h-20 bg-ouro-27" />
        </footer>
      </div>
    </div>
  );
}
