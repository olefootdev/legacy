import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRightLeft,
  ChevronRight,
  Crown,
  Dumbbell,
  Search,
  Trophy,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
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
import { AbsenceBanner } from '@/components/olefoot-python-mode/AbsenceBanner';
import { LoginBonusWidget } from '@/components/olefoot-python-mode/LoginBonusWidget';
import { PassiveIncomeWidget } from '@/components/PassiveIncomeWidget';
import { LigaOleBanner } from '@/components/home/LigaOleBanner';
import { CoroaDoDiaBanner } from '@/components/home/CoroaDoDiaBanner';
import { DesafioDiarioBanner } from '@/components/home/DesafioDiarioBanner';
import { shouldResetDailyChallenges } from '@/game/dailyChallenges';
import { shouldRefreshChallenges } from '@/match/quickStreakChallenges';
import { fetchMyPendingPvpResults, claimPvpMatchResult } from '@/supabase/pvpMatches';
import { MANAGER_SCORE_TABLE, managerScoreToday } from '@/systems/managerScore/managerScore';
import { roundOf } from '@/match/legendsCup/legendsCupModel';
import { useTrackScreen } from '@/progression/trackEvent';

/** Hero — asset real do repositório (mesmo do antigo HomeHeroLegacy). */
const HERO_IMAGE = '/hero-legacy-full.png';

/** Card compacto do rail — rail amarelo 3px à esquerda (Legacy Tech). */
function RailCard({
  label,
  children,
  accent = true,
}: {
  label: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'border border-l-[3px] border-[var(--color-border)] bg-dark-gray p-4 transition-all',
        accent ? 'border-l-neon-yellow' : 'border-l-white/15',
      )}
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      <p
        className="font-display font-black uppercase text-white/55"
        style={{ fontSize: '10px', letterSpacing: '0.28em' }}
      >
        {label}
      </p>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

/** Header compacto de seção — rail + label Agency (copy mínima). */
function SectionLabel({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span aria-hidden className="w-1 h-4 bg-neon-yellow" />
      <h2
        className="font-display font-black uppercase text-white"
        style={{ fontSize: '11px', letterSpacing: '0.26em' }}
      >
        {text}
      </h2>
    </div>
  );
}

export function Home() {
  useTrackScreen('screen_home');
  const dispatch = useGameDispatch();
  const navigate = useNavigate();
  const finance = useGameStore((s) => s.finance);
  const inbox = useGameStore((s) => s.inbox);
  const club = useGameStore((s) => s.club);

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

  /** Treino PRONTO pra concluir (plano rodando com endAt vencido). */
  const trainingReadyCount = useMemo(
    () =>
      (trainingPlans ?? []).filter(
        (p) => p.status === 'running' && new Date(p.endAt).getTime() <= nowMs,
      ).length,
    [trainingPlans, nowMs],
  );

  /** Ações que pontuam — pontos direto da tabela oficial, nunca hardcode. */
  const scoreActions = useMemo(
    () => [
      {
        key: 'treino',
        label: 'Treino',
        points: MANAGER_SCORE_TABLE.treino_concluido,
        icon: Dumbbell,
        to: '/clube/treino' as const,
        badge: trainingReadyCount > 0 ? 'Concluir' : null,
      },
      {
        key: 'mercado',
        label: 'Mercado',
        points: MANAGER_SCORE_TABLE.compra_jogador,
        icon: ArrowRightLeft,
        to: '/mercado/transfer' as const,
        badge: null,
      },
      {
        key: 'amistoso',
        label: 'Amistoso',
        points: MANAGER_SCORE_TABLE.vitoria_amistosa,
        icon: Zap,
        to: null,
        badge: null,
      },
      {
        key: 'legends',
        label: 'Legends',
        points: MANAGER_SCORE_TABLE.compra_legend,
        icon: Crown,
        to: '/legends-cup' as const,
        badge: null,
      },
    ],
    [trainingReadyCount],
  );

  const top5 = rankedEntries.slice(0, 5);
  const meInTop5 = top5.some((r) => r.isMe);
  const myEntry = myRankIdx >= 0 ? rankedEntries[myRankIdx] : null;

  return (
    <div className="w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden">
      <div className="w-full min-w-0 mx-auto max-w-6xl flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:items-start">

        {/* ── A · HERO — cockpit do manager ─────────────────────────────── */}
        <section
          aria-label="Cockpit do manager"
          className="relative overflow-hidden border border-[var(--color-border)] lg:col-start-1 lg:row-start-1"
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          {/* Fundo: fallback token-only + imagem + overlay de contraste */}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-dark-gray to-deep-black" />
          {heroImgOk && (
            <img
              src={HERO_IMAGE}
              alt=""
              aria-hidden
              draggable={false}
              onError={() => setHeroImgOk(false)}
              className="absolute inset-0 h-full w-full object-cover object-top opacity-70"
            />
          )}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-deep-black via-deep-black/70 to-transparent" />

          <div className="relative px-5 sm:px-8 py-8 sm:py-10 flex flex-col items-start gap-1">
            {/* Eyebrow */}
            <span aria-hidden className="block h-px w-8 bg-neon-yellow/55 mb-1.5" />
            <span
              className="font-display font-black uppercase text-neon-yellow"
              style={{ fontSize: '10px', letterSpacing: '0.32em' }}
            >
              Olefoot · {club.name}
            </span>

            {/* Saudação */}
            <p className="mt-3 font-display font-bold uppercase text-white/65" style={{ fontSize: '12px', letterSpacing: '0.24em' }}>
              Olá,
            </p>
            <p
              className="italic text-white leading-[0.95]"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 700,
                fontSize: 'clamp(28px, 5vw, 40px)',
                letterSpacing: '-0.02em',
              }}
            >
              {managerFirstName}
            </p>

            {/* Pontuação do manager */}
            <div className="mt-3 flex items-end gap-3 flex-wrap">
              <p
                className="italic text-neon-yellow leading-none tabular-nums"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontWeight: 700,
                  fontSize: 'clamp(48px, 9vw, 72px)',
                  letterSpacing: '-0.03em',
                }}
              >
                {scoreTotal.toLocaleString('pt-BR')}
              </p>
              {scoreToday > 0 ? (
                <span
                  className="mb-1.5 inline-flex items-center px-2 py-0.5 font-display font-black uppercase tabular-nums"
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.22em',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-success)',
                    background: 'rgba(34,197,94,0.12)',
                    border: '1px solid rgba(34,197,94,0.35)',
                  }}
                >
                  +{scoreToday.toLocaleString('pt-BR')} hoje
                </span>
              ) : (
                <span className="mb-1.5 text-white/55 text-[12px]" style={{ fontFamily: 'var(--font-sans)' }}>
                  Toda ação pontua.
                </span>
              )}
            </div>
            {myRank ? (
              <p
                className="text-white/65 uppercase tabular-nums"
                style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.22em', fontWeight: 600 }}
              >
                Posição #{myRank} no mundo
              </p>
            ) : null}

            <span aria-hidden className="block w-12 h-[3px] bg-neon-yellow mt-3" />

            {/* CTA dominante — única ação amarela da surface */}
            <Link
              to="/legends-cup"
              className="mt-4 inline-flex min-h-[44px] items-center bg-neon-yellow text-black px-6 py-3 font-display font-black uppercase hover:bg-white active:scale-[0.98] transition-all"
              style={{
                fontSize: '13px',
                letterSpacing: '0.24em',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 8px 24px rgba(253,225,0,0.18)',
              }}
            >
              Desafie as lendas
            </Link>
          </div>
        </section>

        {/* ── B · RAIL — loops do clube ─────────────────────────────────── */}
        <aside
          aria-label="Painel do clube"
          className="flex flex-col gap-3 lg:col-start-2 lg:row-start-1 lg:row-span-2"
        >
          {/* Próxima rodada — Liga Global */}
          <RailCard label="Próxima rodada">
            {nextGlobal ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display font-bold uppercase text-white" style={{ fontSize: '13px', letterSpacing: '0.08em' }}>
                    vs {nextGlobal.opponentName}
                  </p>
                  <p
                    className="mt-0.5 italic text-neon-yellow tabular-nums leading-none"
                    style={{ fontFamily: 'var(--font-serif-hero)', fontWeight: 700, fontSize: '22px', letterSpacing: '-0.02em' }}
                  >
                    {nextRoundLabel}
                  </p>
                </div>
                <Link
                  to="/competicao/standings"
                  className="inline-flex min-h-[44px] items-center gap-1 shrink-0 text-white/55 hover:text-neon-yellow transition-colors font-display font-bold uppercase"
                  style={{ fontSize: '10px', letterSpacing: '0.22em' }}
                >
                  Ver liga
                  <ChevronRight className="w-4 h-4" aria-hidden />
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-white/55 text-[12px]" style={{ fontFamily: 'var(--font-sans)' }}>
                  Sem rodada agendada.
                </p>
                <Link
                  to="/competicao/standings"
                  className="inline-flex min-h-[44px] items-center gap-1 shrink-0 text-white/55 hover:text-neon-yellow transition-colors font-display font-bold uppercase"
                  style={{ fontSize: '10px', letterSpacing: '0.22em' }}
                >
                  Ver liga
                  <ChevronRight className="w-4 h-4" aria-hidden />
                </Link>
              </div>
            )}
          </RailCard>

          {/* Legends Cup — torneio */}
          <RailCard label="Legends Cup">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center bg-neon-yellow/10 border border-neon-yellow/35 text-neon-yellow"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  <Trophy className="w-5 h-5" aria-hidden />
                </span>
                <p
                  className="truncate italic text-white"
                  style={{ fontFamily: 'var(--font-serif-hero)', fontWeight: 700, fontSize: '17px', letterSpacing: '-0.02em' }}
                >
                  {cupActive ? cupPhaseLabel : 'As lendas esperam'}
                </p>
              </div>
              <Link
                to="/legends-cup"
                className="inline-flex min-h-[44px] shrink-0 items-center bg-neon-yellow text-black px-4 font-display font-black uppercase hover:bg-white active:scale-[0.98] transition-all"
                style={{ fontSize: '11px', letterSpacing: '0.22em', borderRadius: 'var(--radius-sm)' }}
              >
                {cupActive ? 'Continuar' : 'Começar'}
              </Link>
            </div>
          </RailCard>

          {/* Carteira */}
          <RailCard label="Carteira">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center bg-deep-black/60 border border-[var(--color-border)] text-white/65"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  <Wallet className="w-5 h-5" aria-hidden />
                </span>
                <p
                  className="italic text-white tabular-nums leading-none"
                  style={{ fontFamily: 'var(--font-serif-hero)', fontWeight: 700, fontSize: '22px', letterSpacing: '-0.02em' }}
                >
                  {formatExp(finance.ole)}
                  <span className="ml-1.5 not-italic font-display font-bold uppercase text-white/45" style={{ fontSize: '10px', letterSpacing: '0.2em' }}>
                    EXP
                  </span>
                </p>
              </div>
              <Link
                to="/wallet"
                className="inline-flex min-h-[44px] items-center gap-1 shrink-0 text-white/55 hover:text-neon-yellow transition-colors font-display font-bold uppercase"
                style={{ fontSize: '10px', letterSpacing: '0.22em' }}
              >
                Abrir
                <ChevronRight className="w-4 h-4" aria-hidden />
              </Link>
            </div>
          </RailCard>
        </aside>

        {/* ── Coluna principal ──────────────────────────────────────────── */}
        <div className="min-w-0 flex flex-col gap-6 lg:col-start-1 lg:row-start-2">

          {/* C · Ações que pontuam */}
          <section aria-label="Ações que pontuam">
            <SectionLabel text="Ações que pontuam" />
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {scoreActions.map((a) => {
                const Icon = a.icon;
                const inner = (
                  <>
                    <div className="flex items-center justify-between w-full">
                      <Icon className="w-4 h-4 text-white/65" aria-hidden />
                      {a.badge ? (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 font-display font-black uppercase"
                          style={{
                            fontSize: '9px',
                            letterSpacing: '0.18em',
                            borderRadius: 'var(--radius-sm)',
                            color: '#0D0D0D',
                            background: 'var(--color-warning)',
                          }}
                        >
                          {a.badge}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-baseline justify-between w-full gap-2">
                      <span className="font-display font-black uppercase text-white" style={{ fontSize: '11px', letterSpacing: '0.18em' }}>
                        {a.label}
                      </span>
                      <span
                        className="italic text-neon-yellow tabular-nums"
                        style={{ fontFamily: 'var(--font-serif-hero)', fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em' }}
                      >
                        +{a.points}
                      </span>
                    </div>
                  </>
                );
                const chipClass = cn(
                  'flex min-h-[64px] min-w-[150px] flex-1 flex-col items-start justify-between p-3 text-left',
                  'border border-l-[3px] border-[var(--color-border)] bg-dark-gray transition-all',
                  a.badge ? 'border-l-[var(--color-warning)]' : 'border-l-neon-yellow',
                  'hover:border-neon-yellow/40 hover:-translate-y-0.5 active:scale-[0.98]',
                );
                return a.to ? (
                  <Link key={a.key} to={a.to} className={chipClass} style={{ borderRadius: 'var(--radius-md)' }}>
                    {inner}
                  </Link>
                ) : (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setAmistosoOpen(true)}
                    className={chipClass}
                    style={{ borderRadius: 'var(--radius-md)' }}
                  >
                    {inner}
                  </button>
                );
              })}
            </div>
          </section>

          {/* D · Ranking */}
          <section aria-label="Ranking">
            <SectionLabel text="Ranking" />
            <div
              className="border border-[var(--color-border)] bg-dark-gray overflow-hidden"
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              {top5.length === 0 ? (
                <p className="p-4 text-white/55 text-[12px]" style={{ fontFamily: 'var(--font-sans)' }}>
                  A liga ainda carrega.
                </p>
              ) : (
                <ul className="divide-y divide-white/5">
                  {top5.map((r, i) => (
                    <li
                      key={r.entryId}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 min-h-[44px]',
                        r.isMe && 'border-l-[3px] border-l-neon-yellow bg-neon-yellow/[0.05]',
                      )}
                    >
                      <span className="w-6 shrink-0 font-display font-black text-white/45 tabular-nums" style={{ fontSize: '11px' }}>
                        {i + 1}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate font-display font-bold uppercase',
                          r.isMe ? 'text-neon-yellow' : 'text-white',
                        )}
                        style={{ fontSize: '12px', letterSpacing: '0.08em' }}
                      >
                        {r.team}
                      </span>
                      <span
                        className="shrink-0 italic text-white tabular-nums"
                        style={{ fontFamily: 'var(--font-serif-hero)', fontWeight: 700, fontSize: '17px', letterSpacing: '-0.02em' }}
                      >
                        {r.points.toLocaleString('pt-BR')}
                      </span>
                    </li>
                  ))}
                  {!meInTop5 && myEntry && myRank ? (
                    <li className="flex items-center gap-3 px-4 py-2.5 min-h-[44px] border-l-[3px] border-l-neon-yellow bg-neon-yellow/[0.05]">
                      <span className="w-6 shrink-0 font-display font-black text-white/45 tabular-nums" style={{ fontSize: '11px' }}>
                        {myRank}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-display font-bold uppercase text-neon-yellow" style={{ fontSize: '12px', letterSpacing: '0.08em' }}>
                        Você
                      </span>
                      <span
                        className="shrink-0 italic text-white tabular-nums"
                        style={{ fontFamily: 'var(--font-serif-hero)', fontWeight: 700, fontSize: '17px', letterSpacing: '-0.02em' }}
                      >
                        {myEntry.points.toLocaleString('pt-BR')}
                      </span>
                    </li>
                  ) : null}
                </ul>
              )}
              <div className="border-t border-white/5 px-4 py-2">
                <Link
                  to="/competicao/ranking"
                  className="inline-flex min-h-[44px] items-center gap-1 text-white/55 hover:text-neon-yellow transition-colors font-display font-bold uppercase"
                  style={{ fontSize: '10px', letterSpacing: '0.22em' }}
                >
                  Ranking completo
                  <ChevronRight className="w-4 h-4" aria-hidden />
                </Link>
              </div>
            </div>
          </section>

          {/* E · Mercado agora */}
          <section aria-label="Mercado agora">
            <SectionLabel text="Mercado agora" />
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

          {/* F · Radar — banners condicionais com ação/claim */}
          <section aria-label="Radar" className="flex flex-col gap-2.5">
            <SectionLabel text="Radar" />
            <AbsenceBanner />
            <LoginBonusWidget />
            <PassiveIncomeWidget />
            <CoroaDoDiaBanner />
            <DesafioDiarioBanner />
            <LigaOleBanner />
          </section>
        </div>
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
