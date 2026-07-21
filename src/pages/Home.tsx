import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Search, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatExp, FRIENDLY_CHALLENGE_BRO_FEE_RATE, friendlyChallengeBroFeeCents } from '@/systems/economy';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '@/supabase/client';
import { useNextGlobalFixture } from '@/hooks/useNextGlobalFixture';
import {
  createFriendlyChallenge,
  FRIENDLY_CHALLENGE_TTL_SEC,
  markFriendlyChallengeExpiredIfNeeded,
  searchClubsForFriendly,
  subscribeFriendlyChallengeUpdates,
  unsubscribeChannel,
  updateFriendlyChallengeStatus,
  type ClubSearchHit,
  type FriendlyChallengeRow,
} from '@/supabase/friendlyChallenges';
import {
  filterOpponentRankingMatches,
  type RankingEntry,
} from '@/ranking/worldRanking';
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
import { HeroCinematic } from '@/components/home/HeroCinematic';
import { NextMatchCard } from '@/components/home/NextMatchCard';
import { LegendsRail, type LegendMini } from '@/components/home/LegendsRail';
import { ManagerDesk } from '@/components/home/ManagerDesk';
import { InheritanceModule } from '@/components/home/InheritanceModule';
import { ManagerOfDay } from '@/components/home/ManagerOfDay';
import { RankingTop10 } from '@/components/home/RankingTop10';
import { fetchListedLegacyPlayerRows, legacyPortraitImageUrl } from '@/supabase/legacyPlayers';
import { overallFromAttributes } from '@/entities/player';
import { fetchMyOffers } from '@/supabase/marketOffers';
import type { PlayerAttributes, PlayerEntity } from '@/entities/types';

/** Hero — asset real do repositório (mesmo do antigo HomeHeroLegacy). */
const HERO_IMAGE = '/hero-legacy-full.png';

/** Header compacto de seção — rail + label Agency (copy mínima). */

export function Home() {
  useTrackScreen('screen_home');
  const dispatch = useGameDispatch();
  const navigate = useNavigate();
  const finance = useGameStore((s) => s.finance);
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
  const dailyChallenges = useGameStore((s) => s.dailyChallenges);
  const streakChallenges = useGameStore((s) => s.streakChallenges);
  // Viral #5 (saga) + #6 (rival fantasma): sequência viva + recorde a bater.
  const quickStreak = useGameStore((s) => s.quickMatchStreak);
  const quickBestWin = useGameStore((s) => s.quickBestWin);
  // REBRAND — pontuação do manager (eixo da Home nova).
  const managerScore = useGameStore((s) => s.managerScore);
  const legendsCup = useGameStore((s) => s.legendsCup);
  const trainingPlans = useGameStore((s) => s.manager.trainingPlans);

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

  const [amistosoOpen, setAmistosoOpen] = useState(false);
  const [hasOnlineSession, setHasOnlineSession] = useState(false);
  const [opponentQuery, setOpponentQuery] = useState('');
  const [amistosoOnlineHits, setAmistosoOnlineHits] = useState<ClubSearchHit[]>([]);
  const [amistosoOfflineHits, setAmistosoOfflineHits] = useState<RankingEntry[]>([]);
  const [amistosoLookupMessage, setAmistosoLookupMessage] = useState<string | null>(null);
  const [selectedOnlineOpponent, setSelectedOnlineOpponent] = useState<ClubSearchHit | null>(null);
  const [selectedOfflineOpponent, setSelectedOfflineOpponent] = useState<RankingEntry | null>(null);
  const [amistosoSearchBusy, setAmistosoSearchBusy] = useState(false);
  const [waitingChallenge, setWaitingChallenge] = useState<{
    id: string;
    expiresAt: string;
    opponentName: string;
    mode: 'live' | 'quick' | 'penalty';
    betCurrency: 'BRO' | 'EXP';
    prizeBroUnits: number;
    prizeExp: number;
  } | null>(null);
  const [waitTick, setWaitTick] = useState(0);
  const waitChannelRef = useRef<RealtimeChannel | null>(null);
  const refundedChallengeIdsRef = useRef<Set<string>>(new Set());
  const [friendlyMode, setFriendlyMode] = useState<'quick' | 'penalty'>('quick');
  const [betCurrency, setBetCurrency] = useState<'BRO' | 'EXP'>('BRO');
  const [betInput, setBetInput] = useState('10');
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

  useEffect(() => {
    if (!amistosoOpen) {
      setOpponentQuery('');
      setAmistosoOnlineHits([]);
      setAmistosoOfflineHits([]);
      setAmistosoLookupMessage(null);
      setSelectedOnlineOpponent(null);
      setSelectedOfflineOpponent(null);
      setWaitingChallenge(null);
      unsubscribeChannel(waitChannelRef.current);
      waitChannelRef.current = null;
    }
  }, [amistosoOpen]);

  useEffect(() => {
    if (!amistosoOpen) return;
    void (async () => {
      const sb = getSupabase();
      if (!sb) {
        setHasOnlineSession(false);
        return;
      }
      const { data } = await sb.auth.getUser();
      setHasOnlineSession(!!data.user);
    })();
  }, [amistosoOpen]);

  const useOnlineInviteFlow = isSupabaseConfigured() && hasOnlineSession;

  const refundChallengeOnce = (challengeId: string, fn: () => void) => {
    if (refundedChallengeIdsRef.current.has(challengeId)) return;
    refundedChallengeIdsRef.current.add(challengeId);
    fn();
  };

  const refundWaitingStake = (meta: {
    id: string;
    opponentName: string;
    mode: 'live' | 'quick' | 'penalty';
    betCurrency: 'BRO' | 'EXP';
    prizeBroUnits: number;
    prizeExp: number;
  }) => {
    refundChallengeOnce(meta.id, () => {
    if (meta.betCurrency === 'BRO') {
      dispatch({
        type: 'REFUND_FRIENDLY_CHALLENGE',
        opponentName: meta.opponentName,
        mode: meta.mode,
        currency: 'BRO',
        prizeAmount: meta.prizeBroUnits,
      });
    } else {
      dispatch({
        type: 'REFUND_FRIENDLY_CHALLENGE',
        opponentName: meta.opponentName,
        mode: meta.mode,
        currency: 'EXP',
        prizeAmount: meta.prizeExp,
      });
    }
    });
  };

  const refundFromChallengeRow = (row: FriendlyChallengeRow) => {
    refundChallengeOnce(row.id, () => {
    const name = row.challenged_club_name;
    if (row.bet_currency === 'BRO' && row.bet_bro_cents != null && row.bet_bro_cents > 0) {
      dispatch({
        type: 'REFUND_FRIENDLY_CHALLENGE',
        opponentName: name,
        mode: row.mode,
        currency: 'BRO',
        prizeAmount: row.bet_bro_cents / 100,
      });
    } else if (row.bet_currency === 'EXP' && row.bet_exp != null && row.bet_exp > 0) {
      dispatch({
        type: 'REFUND_FRIENDLY_CHALLENGE',
        opponentName: name,
        mode: row.mode,
        currency: 'EXP',
        prizeAmount: row.bet_exp,
      });
    }
    });
  };

  useEffect(() => {
    if (!waitingChallenge) return;
    const id = waitingChallenge.id;
    const sb = getSupabase();
    if (!sb) return;
    try {
      waitChannelRef.current = subscribeFriendlyChallengeUpdates(id, (row: FriendlyChallengeRow) => {
        if (row.status === 'accepted') {
          unsubscribeChannel(waitChannelRef.current);
          waitChannelRef.current = null;
          setWaitingChallenge(null);
          setAmistosoOpen(false);
          const path = (row.mode as string) === 'penalty' ? '/match/penalty' : '/match/quick';
          navigate(`${path}?fc=${encodeURIComponent(id)}`);
        } else if (row.status === 'declined' || row.status === 'expired' || row.status === 'cancelled') {
          unsubscribeChannel(waitChannelRef.current);
          waitChannelRef.current = null;
          refundFromChallengeRow(row);
          setWaitingChallenge(null);
        }
      });
    } catch {
      /* ignore */
    }
    return () => {
      unsubscribeChannel(waitChannelRef.current);
      waitChannelRef.current = null;
    };
  }, [waitingChallenge?.id, navigate, dispatch]);

  useEffect(() => {
    if (!waitingChallenge) return;
    const iv = window.setInterval(() => setWaitTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [waitingChallenge?.id]);

  const expireHandledIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!waitingChallenge) {
      expireHandledIdRef.current = null;
      return;
    }
    if (expireHandledIdRef.current === waitingChallenge.id) return;
    const leftMs = new Date(waitingChallenge.expiresAt).getTime() - Date.now();
    if (leftMs > 0) return;
    expireHandledIdRef.current = waitingChallenge.id;
    const meta = waitingChallenge;
    void (async () => {
      await markFriendlyChallengeExpiredIfNeeded(meta.id);
      const sb = getSupabase();
      if (sb) {
        const { data } = await sb.from('friendly_challenges').select('status').eq('id', meta.id).maybeSingle();
        const st = (data as { status?: string } | null)?.status;
        if (st === 'pending') {
          await updateFriendlyChallengeStatus(meta.id, 'expired');
        }
      }
      refundWaitingStake({ id: meta.id, ...meta });
      unsubscribeChannel(waitChannelRef.current);
      waitChannelRef.current = null;
      setWaitingChallenge(null);
    })();
  }, [waitingChallenge, waitTick, dispatch]);

  const betBroCents = useMemo(() => {
    const n = parseFloat(betInput.replace(',', '.'));
    if (Number.isNaN(n) || n <= 0) return 0;
    return Math.max(1, Math.round(n * 100));
  }, [betInput]);
  const feeBroCents = betBroCents > 0 ? friendlyChallengeBroFeeCents(betBroCents) : 0;
  const totalBroCents = betBroCents + feeBroCents;

  const startOfflineFriendly = () => {
    const row = selectedOfflineOpponent;
    if (!row) {
      alert('Busque e selecione um time no ranking local.');
      return;
    }
    const name = row.team;
    const oid = row.entryId;
    if (betCurrency === 'BRO') {
      if (betBroCents < 1) {
        alert('Informe um valor de prêmio em BRO válido.');
        return;
      }
      if (finance.broCents < totalBroCents) {
        alert('Saldo BRO insuficiente para prêmio + taxa de 5% (feeChallenger).');
        return;
      }
      dispatch({
        type: 'START_FRIENDLY_CHALLENGE',
        opponentName: name,
        opponentId: oid,
        mode: friendlyMode,
        currency: 'BRO',
        prizeAmount: betBroCents / 100,
      });
    } else {
      const exp = Math.max(1, Math.round(parseFloat(betInput.replace(',', '.')) || 0));
      if (Number.isNaN(exp) || exp < 1) {
        alert('Informe um valor inteiro de EXP para o prêmio.');
        return;
      }
      if (finance.ole < exp) {
        alert('Saldo EXP insuficiente.');
        return;
      }
      dispatch({
        type: 'START_FRIENDLY_CHALLENGE',
        opponentName: name,
        opponentId: oid,
        mode: friendlyMode,
        currency: 'EXP',
        prizeAmount: exp,
      });
    }
    setAmistosoOpen(false);
    navigate(friendlyMode === 'penalty' ? '/match/penalty' : '/match/quick');
  };

  const cancelWaitingChallenge = async () => {
    if (!waitingChallenge) return;
    await updateFriendlyChallengeStatus(waitingChallenge.id, 'cancelled');
    refundWaitingStake({ id: waitingChallenge.id, ...waitingChallenge });
    unsubscribeChannel(waitChannelRef.current);
    waitChannelRef.current = null;
    setWaitingChallenge(null);
  };

  const sendOnlineFriendlyChallenge = async () => {
    const hit = selectedOnlineOpponent;
    if (!hit) {
      alert('Busque e selecione um clube com conta online.');
      return;
    }
    if (betCurrency === 'BRO') {
      if (betBroCents < 1) {
        alert('Informe um valor de prêmio em BRO válido.');
        return;
      }
      if (finance.broCents < totalBroCents) {
        alert('Saldo BRO insuficiente para prêmio + taxa de 5% (feeChallenger).');
        return;
      }
    } else {
      const exp = Math.max(1, Math.round(parseFloat(betInput.replace(',', '.')) || 0));
      if (Number.isNaN(exp) || exp < 1) {
        alert('Informe um valor inteiro de EXP para o prêmio.');
        return;
      }
      if (finance.ole < exp) {
        alert('Saldo EXP insuficiente.');
        return;
      }
    }
    const created = await createFriendlyChallenge({
      challengedClubId: hit.club_id,
      challengedClubName: hit.name,
      challengerClubName: club.name,
      mode: friendlyMode,
      betCurrency,
      betBroCents: betCurrency === 'BRO' ? betBroCents : null,
      betExp:
        betCurrency === 'EXP'
          ? Math.max(1, Math.round(parseFloat(betInput.replace(',', '.')) || 0))
          : null,
    });
    if ('error' in created) {
      alert(created.error);
      return;
    }
    const expVal = Math.max(1, Math.round(parseFloat(betInput.replace(',', '.')) || 0));
    if (betCurrency === 'BRO') {
      dispatch({
        type: 'START_FRIENDLY_CHALLENGE',
        opponentName: hit.name,
        opponentId: hit.club_id,
        mode: friendlyMode,
        currency: 'BRO',
        prizeAmount: betBroCents / 100,
      });
    } else {
      dispatch({
        type: 'START_FRIENDLY_CHALLENGE',
        opponentName: hit.name,
        opponentId: hit.club_id,
        mode: friendlyMode,
        currency: 'EXP',
        prizeAmount: expVal,
      });
    }
    const expiresAt = new Date(Date.now() + FRIENDLY_CHALLENGE_TTL_SEC * 1000).toISOString();
    refundedChallengeIdsRef.current.delete(created.id);
    setWaitingChallenge({
      id: created.id,
      expiresAt,
      opponentName: hit.name,
      mode: friendlyMode,
      betCurrency,
      prizeBroUnits: betBroCents / 100,
      prizeExp: expVal,
    });
  };

  // Ranking real — MESMA fonte do /competicao/ranking (times da Liga Global).
  // Alimenta o rank do hero, o top 5 da seção Ranking e a busca de amistoso.
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

  // Ranking local pra busca de amistoso — fallback gracioso: liga não carregou
  // → só o próprio clube (nunca quebra a Home). `exp` = pontos da temporada.
  const fullSorted = useMemo<RankingEntry[]>(() => {
    if (rankedEntries.length > 0) {
      return rankedEntries.map((r) => ({ team: r.team, exp: r.points, isMe: r.isMe, entryId: r.entryId }));
    }
    return [{ team: club.name, exp: Math.round(finance.ole), isMe: true, entryId: club.id }];
  }, [rankedEntries, club.name, club.id, finance.ole]);

  const lookupAmistosoOpponent = () => {
    const q = opponentQuery.trim();
    if (!q) {
      setAmistosoOfflineHits([]);
      setAmistosoOnlineHits([]);
      setAmistosoLookupMessage('Digite o nome (ou parte) do time e toque em Buscar time.');
      return;
    }
    if (useOnlineInviteFlow) {
      setAmistosoSearchBusy(true);
      void (async () => {
        const hits = await searchClubsForFriendly(q);
        setAmistosoSearchBusy(false);
        setAmistosoOnlineHits(hits);
        setAmistosoLookupMessage(
          hits.length ? null : 'Nenhum clube online encontrado. Tente outro termo (mín. 2 letras).',
        );
      })();
      return;
    }
    const hits = filterOpponentRankingMatches(fullSorted, q, 12);
    setAmistosoOfflineHits(hits);
    setAmistosoLookupMessage(
      hits.length ? null : 'Nenhum time encontrado no ranking local. Tente outro termo.',
    );
  };

  const pickOnlineOpponent = (hit: ClubSearchHit) => {
    setSelectedOnlineOpponent(hit);
    setOpponentQuery(hit.name);
    setAmistosoOnlineHits([]);
    setAmistosoLookupMessage(null);
  };

  const pickOfflineOpponent = (row: RankingEntry) => {
    setSelectedOfflineOpponent(row);
    setOpponentQuery(row.team);
    setAmistosoOfflineHits([]);
    setAmistosoLookupMessage(null);
  };

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

  return (
    <div className="w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden">
      <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-4 px-3 sm:px-4">

        {/* Dobra 1 — trailer cinematográfico do manager */}
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
        />

        {/* No topo agora — líder real do ranking (#1) */}
        {leader ? (
          <ManagerOfDay clubName={leader.team} points={leader.points} overall={leader.overall} />
        ) : null}

        {/* Lendas em Destaque — drops reais (legacy_players) */}
        <LegendsRail legends={legends} />

        {/* Próxima Partida — Liga Global + selo Nemesis + gatilho do amistoso */}
        <NextMatchCard
          clubName={club.name}
          opponentName={nextGlobal ? nextGlobal.opponentName : null}
          countdownLabel={nextRoundLabel}
          isLive={nextRoundLabel === 'Agora'}
          isNemesis={isNemesisNext}
          onFriendly={() => setAmistosoOpen(true)}
        />

        {/* Ranking de Clubes — Top 10, aba Geral real */}
        <RankingTop10 top={top10} myRow={myRow} myRank={myRank} />

        {/* Mesa do Manager — pendências reais */}
        <ManagerDesk
          suspendedCount={suspendedCount}
          expiredCount={expiredCount}
          offersCount={incomingCount}
        />

        {/* Herança (Messi→Yamal) — some quando não há lenda + joia */}
        {inheritance ? (
          <InheritanceModule legend={inheritance.legend} jewel={inheritance.jewel} />
        ) : null}

        {/* A Resenha — pulso do mundo via feed real de mercado */}
        <section aria-label="A Resenha">
          <div className="mb-2.5 flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--color-success)', boxShadow: '0 0 0 3px rgba(0,200,81,0.18)' }}
            />
            <h2 className="font-impact uppercase text-white" style={{ fontSize: '13px', letterSpacing: '0.02em' }}>
              A Resenha
            </h2>
          </div>
          <div
            className="border border-[var(--color-border)] bg-dark-gray p-3 sm:p-4"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <MarketActivityFeed activities={marketActivities} maxVisible={5} />
            <div className="mt-2 border-t border-white/5 pt-1">
              <Link
                to="/mercado/transfer"
                className="inline-flex min-h-[44px] items-center gap-1 text-white/55 hover:text-neon-yellow transition-colors font-display font-bold uppercase"
                style={{ fontSize: '10px', letterSpacing: '0.22em' }}
              >
                Ir ao mercado
                <ChevronRight className="w-4 h-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Modal de amistoso — fluxo preservado (busca online/offline + aposta) */}
      <AnimatePresence>
        {amistosoOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto overscroll-y-contain bg-black/88 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative my-auto flex max-h-[min(90dvh,calc(100dvh-6rem))] w-full max-w-lg flex-col overflow-hidden border-neon-yellow/40 sports-panel p-0 sm:max-h-[min(92dvh,720px)]"
            >
              <button
                type="button"
                aria-label="Fechar amistoso"
                onClick={() => {
                  if (waitingChallenge) void cancelWaitingChallenge();
                  setAmistosoOpen(false);
                }}
                className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="shrink-0 border-b border-white/10 bg-neon-yellow/5 p-6">
                <h3 className="text-xl font-display font-black uppercase tracking-wider text-white">Amistoso</h3>
                <p className="mt-2 text-sm leading-snug text-gray-300">Mostre que você é o melhor no jogo</p>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain p-6">
                {waitingChallenge ? (
                  <div className="space-y-4 py-2 text-center">
                    <p className="text-sm font-bold text-white">À espera de {waitingChallenge.opponentName}</p>
                    <p className="text-[11px] text-gray-500">
                      O adversário tem {FRIENDLY_CHALLENGE_TTL_SEC}s para aceitar (ambos online). Quando aceitar, a
                      partida abre automaticamente.
                    </p>
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-neon-yellow/40 font-display text-3xl font-black text-neon-yellow">
                      {Math.max(
                        0,
                        Math.ceil(
                          (new Date(waitingChallenge.expiresAt).getTime() - Date.now()) / 1000,
                        ),
                      )}
                      s
                    </div>
                    <button
                      type="button"
                      onClick={() => void cancelWaitingChallenge()}
                      className="w-full border border-white/15 py-2.5 text-xs font-bold uppercase text-gray-400 hover:bg-white/5"
                    >
                      Cancelar convite
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1.5">
                        {useOnlineInviteFlow ? 'Buscar clube (conta online)' : 'Buscar adversário (ranking local)'}
                      </label>
                      <div className="flex gap-2">
                        <input
                          value={opponentQuery}
                          onChange={(e) => {
                            setOpponentQuery(e.target.value);
                            setAmistosoOnlineHits([]);
                            setAmistosoOfflineHits([]);
                            setAmistosoLookupMessage(null);
                            setSelectedOnlineOpponent(null);
                            setSelectedOfflineOpponent(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              lookupAmistosoOpponent();
                            }
                          }}
                          placeholder={useOnlineInviteFlow ? 'Nome do clube (mín. 2 letras)' : 'Nome do time'}
                          className="min-w-0 flex-1 bg-black/40 border border-white/15 rounded px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          disabled={amistosoSearchBusy}
                          onClick={() => void lookupAmistosoOpponent()}
                          className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded border border-neon-yellow/50 bg-neon-yellow/10 px-3 py-2 text-[11px] font-display font-bold uppercase tracking-wide text-neon-yellow hover:bg-neon-yellow/20 disabled:opacity-40"
                        >
                          <Search className="h-4 w-4" />
                          <span className="hidden min-[380px]:inline">Buscar time</span>
                        </button>
                      </div>
                      <p className="mt-1.5 text-[10px] text-gray-600 leading-snug">
                        {useOnlineInviteFlow
                          ? 'Só aparecem clubes com perfil Supabase. Seleciona um resultado — não precisas de ID.'
                          : 'Sem sessão online: ranking local Olefoot. Ao enviar, entras logo em campo (sem convite).'}
                      </p>
                      {amistosoLookupMessage ? (
                        <p className="mt-2 text-[11px] text-amber-200/90">{amistosoLookupMessage}</p>
                      ) : null}
                      {useOnlineInviteFlow && selectedOnlineOpponent ? (
                        <p className="mt-2 text-xs text-neon-yellow">
                          Selecionado: <strong>{selectedOnlineOpponent.name}</strong>
                        </p>
                      ) : null}
                      {!useOnlineInviteFlow && selectedOfflineOpponent ? (
                        <p className="mt-2 text-xs text-neon-yellow">
                          Selecionado: <strong>{selectedOfflineOpponent.team}</strong>
                        </p>
                      ) : null}
                      {useOnlineInviteFlow && amistosoOnlineHits.length > 0 ? (
                        <ul className="mt-2 max-h-40 overflow-y-auto rounded border border-white/10 divide-y divide-white/5">
                          {amistosoOnlineHits.map((hit) => (
                            <li key={hit.club_id}>
                              <button
                                type="button"
                                onClick={() => pickOnlineOpponent(hit)}
                                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                              >
                                <span className="min-w-0 truncate font-display font-bold text-white">{hit.name}</span>
                                <span className="shrink-0 text-[10px] text-gray-500">{hit.short_name}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {!useOnlineInviteFlow && amistosoOfflineHits.length > 0 ? (
                        <ul className="mt-2 max-h-40 overflow-y-auto rounded border border-white/10 divide-y divide-white/5">
                          {amistosoOfflineHits.map((row) => (
                            <li key={row.entryId}>
                              <button
                                type="button"
                                onClick={() => pickOfflineOpponent(row)}
                                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                              >
                                <span className="min-w-0 truncate font-display font-bold text-white">{row.team}</span>
                                <span className="shrink-0 text-[10px] text-gray-500">{formatExp(row.exp)} pts</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    {/* Viral #5 (saga) + #6 (rival fantasma): puxa o jogador pra
                        próxima partida via loss-aversion (não quebrar a sequência)
                        e competição assíncrona (superar o próprio recorde). */}
                    {((quickStreak?.current ?? 0) >= 2 || quickBestWin) && (
                      <div className="rounded border border-neon-yellow/30 bg-neon-yellow/[0.06] px-3 py-2">
                        {(quickStreak?.current ?? 0) >= 2 && (
                          <p className="text-[11px] text-white/85 font-semibold">
                            🔥 Você vem de <span className="text-neon-yellow font-bold">{quickStreak!.current} vitórias seguidas</span> — não quebre o embalo.
                          </p>
                        )}
                        {quickBestWin && (
                          <p className="text-[10px] text-white/55 mt-0.5">
                            Recorde a bater: <span className="text-white/80 font-bold tabular-nums">{quickBestWin.homeScore}–{quickBestWin.awayScore}</span> vs {quickBestWin.opponentName}
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-2">
                        Modo de partida
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFriendlyMode('quick')}
                          className={cn(
                            'py-2.5 rounded text-xs font-display font-bold uppercase border',
                            friendlyMode === 'quick'
                              ? 'bg-neon-yellow text-black border-neon-yellow'
                              : 'border-white/15 text-gray-400',
                          )}
                        >
                          Partida Rápida
                        </button>
                        <button
                          type="button"
                          onClick={() => setFriendlyMode('penalty')}
                          className={cn(
                            'py-2.5 rounded text-xs font-display font-bold uppercase border',
                            friendlyMode === 'penalty'
                              ? 'bg-neon-yellow text-black border-neon-yellow'
                              : 'border-white/15 text-gray-400',
                          )}
                        >
                          Disputa Penalty
                        </button>
                      </div>
                      <p className="mt-2 text-[10px] text-gray-500 leading-snug">
                        Partida Rápida segue as regras oficiais da liga. Disputa Penalty é uma disputa de 5 cobranças.
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                          Bet (prêmio do vencedor)
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setBetCurrency('BRO')}
                            className={cn(
                              'px-2 py-1 rounded text-[10px] font-bold uppercase',
                              betCurrency === 'BRO' ? 'bg-white text-black' : 'bg-white/5 text-gray-500',
                            )}
                          >
                            BRO
                          </button>
                          <button
                            type="button"
                            onClick={() => setBetCurrency('EXP')}
                            className={cn(
                              'px-2 py-1 rounded text-[10px] font-bold uppercase',
                              betCurrency === 'EXP' ? 'bg-neon-yellow text-black' : 'bg-white/5 text-gray-500',
                            )}
                          >
                            EXP
                          </button>
                        </div>
                      </div>
                      <input
                        value={betInput}
                        onChange={(e) => setBetInput(e.target.value)}
                        placeholder={betCurrency === 'BRO' ? 'Ex.: 10,50' : 'Ex.: 500'}
                        className="w-full bg-black/40 border border-white/15 rounded px-3 py-2 text-sm"
                      />
                      {betCurrency === 'BRO' && betBroCents > 0 && (
                        <div className="mt-2 text-[11px] text-gray-500 space-y-1 border border-white/10 rounded p-2 bg-black/30">
                          <div className="flex justify-between">
                            <span>Prêmio ao vencedor</span>
                            <span className="text-white font-bold">{(betBroCents / 100).toFixed(2)} BRO</span>
                          </div>
                          <div className="flex justify-between text-neon-yellow/90">
                            <span>Taxa plataforma ({Math.round(FRIENDLY_CHALLENGE_BRO_FEE_RATE * 100)}% · feeChallenger)</span>
                            <span className="font-bold">{(feeBroCents / 100).toFixed(2)} BRO</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-white/10 font-bold text-white">
                            <span>Total debitado</span>
                            <span>{(totalBroCents / 100).toFixed(2)} BRO</span>
                          </div>
                          <p className="text-[10px] text-gray-600 pt-1">
                            A taxa credita a tesouraria da empresa (destino final configurável no Admin).
                          </p>
                        </div>
                      )}
                      {betCurrency === 'EXP' && (
                        <p className="text-[10px] text-gray-600 mt-2">
                          Desafios em EXP não cobram taxa de plataforma neste fluxo.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void (useOnlineInviteFlow ? sendOnlineFriendlyChallenge() : startOfflineFriendly())}
                      className="w-full btn-primary py-3"
                    >
                      <span className="btn-primary-inner">
                        {useOnlineInviteFlow ? 'Enviar desafio' : 'Criar desafio e jogar'}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
