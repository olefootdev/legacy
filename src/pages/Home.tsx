import { motion, AnimatePresence } from 'motion/react';
import { Zap, ChevronRight, Activity, Search, Star, Trophy, X, UserPlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatExp, FRIENDLY_CHALLENGE_BRO_FEE_RATE, friendlyChallengeBroFeeCents } from '@/systems/economy';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '@/supabase/client';
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
import type { PastResult, PlayerEntity } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';
import { isHiddenFromHomeInboxFeed, type InboxItem } from '@/game/inboxTypes';
import {
  buildHomeRankingPreview,
  filterOpponentRankingMatches,
  getFullRankingEntries,
  type RankingEntry,
} from '@/ranking/worldRanking';
import { useRankingFavorites } from '@/ranking/useRankingFavorites';
import { playerPortraitSrc } from '@/lib/playerPortrait';
import { MatchdayHero } from '@/components/matchday/MatchdayHero';
import { useTrackScreen } from '@/progression/trackEvent';

const HOME_NOTIF_VISIBLE_COUNT = 5;

/** Abas fixas da HOME — alinhadas ao pedido (não mostrar só categorias que já existem no inbox). */
type HomeNotifTab = 'ALL' | 'STAFF' | 'TORCIDA' | 'JOGADORES' | 'COMPETIÇÃO';

const HOME_NOTIF_TABS: { key: HomeNotifTab; label: string }[] = [
  { key: 'ALL', label: 'Todos' },
  { key: 'STAFF', label: 'Staff' },
  { key: 'TORCIDA', label: 'Torcida' },
  { key: 'JOGADORES', label: 'Jogadores' },
  { key: 'COMPETIÇÃO', label: 'Competição' },
];

function inboxMatchesHomeNotifTab(item: InboxItem, tab: HomeNotifTab): boolean {
  if (tab === 'ALL') return true;
  if (tab === 'STAFF') return item.category === 'STAFF';
  if (tab === 'TORCIDA') return item.category === 'TORCIDA';
  if (tab === 'JOGADORES') return item.category === 'PLANTEL' || item.category === 'TREINO';
  if (tab === 'COMPETIÇÃO') return item.category === 'COMPETIÇÃO';
  return true;
}

function InboxBodyText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const nodes: ReactNode[] = [];
    const re = /\*\*(.+?)\*\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) {
        nodes.push(<span key={`t-${k++}`}>{text.slice(last, m.index)}</span>);
      }
      nodes.push(
        <strong key={`b-${k++}`} className="font-semibold text-white">
          {m[1]}
        </strong>,
      );
      last = re.lastIndex;
    }
    if (last < text.length) {
      nodes.push(<span key={`t-${k++}`}>{text.slice(last)}</span>);
    }
    return nodes.length ? nodes : text;
  }, [text]);
  return <p className="text-xs text-gray-400 mt-1 leading-relaxed">{parts}</p>;
}

function pickHighlightFromRoster(players: Record<string, PlayerEntity>): PlayerEntity | null {
  const list = Object.values(players);
  const outfield = list.filter((p) => p.pos.toUpperCase() !== 'GOL');
  const candidates = outfield.length ? outfield : list;
  if (!candidates.length) return null;
  let best = candidates[0]!;
  let bestOvr = overallFromAttributes(best.attrs);
  for (const p of candidates) {
    const o = overallFromAttributes(p.attrs);
    if (o > bestOvr) {
      best = p;
      bestOvr = o;
    }
  }
  return best;
}

function starsForOvr(ovr: number): number {
  return Math.max(1, Math.min(5, Math.round(ovr / 20)));
}

function resultOutcomeMeta(result: PastResult['result']) {
  switch (result) {
    case 'win':
      return {
        label: 'V',
        sub: 'Vitória',
        bar: 'bg-emerald-400',
        pill: 'text-emerald-300',
        side: 'bg-emerald-500/15 border-emerald-400/25',
      };
    case 'draw':
      return {
        label: 'E',
        sub: 'Empate',
        bar: 'bg-amber-400',
        pill: 'text-amber-200',
        side: 'bg-amber-500/12 border-amber-400/20',
      };
    case 'loss':
      return {
        label: 'D',
        sub: 'Derrota',
        bar: 'bg-red-500',
        pill: 'text-red-300',
        side: 'bg-red-500/12 border-red-500/25',
      };
  }
}

export function Home() {
  useTrackScreen('screen_home');
  const dispatch = useGameDispatch();
  const navigate = useNavigate();
  const finance = useGameStore((s) => s.finance);
  const crowd = useGameStore((s) => s.crowd);
  const results = useGameStore((s) => s.results);
  const inbox = useGameStore((s) => s.inbox);
  const fixture = useGameStore((s) => s.nextFixture);
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);

  const homeHighlightBest = useMemo(() => pickHighlightFromRoster(players), [players]);
  const homeHighlight = useMemo(() => {
    if (!homeHighlightBest) {
      return {
        id: '',
        name: '—',
        ovr: 70,
        imageSrc: 'https://picsum.photos/seed/home-placeholder/400/520',
      };
    }
    const ovr = homeHighlightBest.mintOverall ?? overallFromAttributes(homeHighlightBest.attrs);
    return {
      id: homeHighlightBest.id,
      name: homeHighlightBest.name,
      ovr,
      imageSrc: playerPortraitSrc(
        { name: homeHighlightBest.name, portraitUrl: homeHighlightBest.portraitUrl },
        400,
        520,
      ),
    };
  }, [homeHighlightBest]);

  // awayHighlight removido — destaque agora é único (homeHighlight) no padrão
  // /matchday/preview com número OVR gigante decorativo. Se voltar a precisar
  // do duo casa × visitante, recuperar via git history.
  const roundedSupport = Math.max(0, Math.min(100, Math.round(crowd.supportPercent * 2) / 2));
  const supportLabel = roundedSupport.toLocaleString('pt-BR', {
    minimumFractionDigits: Number.isInteger(roundedSupport) ? 0 : 1,
    maximumFractionDigits: 1,
  });
  const [searchTeam, setSearchTeam] = useState('');
  const { favorites, toggleFavorite } = useRankingFavorites();
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
  const [notifTab, setNotifTab] = useState<HomeNotifTab>('ALL');
  const [notifShowAll, setNotifShowAll] = useState(false);
  const notificacoesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotifShowAll(false);
  }, [notifTab]);

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

  const homeFeedInbox = useMemo(
    () => inbox.filter((i) => !isHiddenFromHomeInboxFeed(i)),
    [inbox],
  );

  const filteredInbox = useMemo(
    () => homeFeedInbox.filter((i) => inboxMatchesHomeNotifTab(i, notifTab)),
    [homeFeedInbox, notifTab],
  );

  const inboxPanelList = useMemo(
    () => (notifShowAll ? filteredInbox : filteredInbox.slice(0, HOME_NOTIF_VISIBLE_COUNT)),
    [filteredInbox, notifShowAll],
  );

  const scrollToNotificacoes = () => {
    notificacoesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

  const fullSorted = useMemo(
    () => getFullRankingEntries(club.name, finance.ole, club.id),
    [club.name, finance.ole, club.id],
  );

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

  const ranking = useMemo(
    () => buildHomeRankingPreview(fullSorted, searchTeam, favorites),
    [fullSorted, searchTeam, favorites],
  );

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-8">
      {/* Header Mobile */}
      <div className="mb-6 flex min-w-0 items-center justify-between gap-2 md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <img
            src="/test-pitch/olefoot-logo-game.svg"
            alt="Olefoot"
            className="h-8 min-[360px]:h-9 w-auto shrink-0"
          />
        </div>
        <Link
          to="/wallet"
          className="flex max-w-[min(100%,11rem)] shrink-0 items-center gap-2 border border-white/10 bg-panel px-2 py-1.5 min-[360px]:px-3"
        >
          <span className="truncate text-xs font-display font-bold tracking-wider text-neon-yellow min-[360px]:text-sm">
            {formatExp(finance.ole)} EXP
          </span>
        </Link>
      </div>

      {/* HERO PRINCIPAL — Matchday Hero do ÚLTIMO JOGO (placar real + MVP) */}
      <section
        aria-label="Último jogo"
        className="-mx-3 -mt-3 sm:-mx-4 sm:-mt-4 lg:-mx-8 lg:-mt-8 mb-6"
      >
        {(() => {
          const last5 = results.slice(0, 5);
          const wins = last5.filter((r) => r.result === 'win').length;
          const draws = last5.filter((r) => r.result === 'draw').length;
          const losses = last5.filter((r) => r.result === 'loss').length;
          const lastMatch = results[0];
          const homeShort = (club.shortName ?? club.name).slice(0, 3).toUpperCase();

          // Sem histórico → estado "antes da estreia" (coerente com o tema
          // do hero: ÚLTIMA partida; aqui não houve nenhuma ainda).
          if (!lastMatch) {
            return (
              <MatchdayHero
                data={{
                  competition: 'Pré-temporada · sem jogos',
                  statusPrimary: 'Estreia',
                  statusSecondary: 'Aguardando',
                  statusVariant: 'preview',
                  home: {
                    short: homeShort,
                    name: club.name,
                    score: 0,
                    sublabel: 'Pronto para entrar em campo',
                  },
                  away: {
                    short: '—',
                    name: 'Adversário',
                    score: 0,
                    sublabel: 'Sem partida disputada',
                  },
                  stats: [
                    { label: 'Vitórias', value: '0' },
                    { label: 'Empates', value: '0' },
                    { label: 'Derrotas', value: '0' },
                    { label: 'Apoio', value: `${Math.round(roundedSupport)}%` },
                    { label: 'Forma', value: '—' },
                  ],
                  highlight: {
                    name: homeHighlight.name,
                    number: homeHighlight.ovr,
                    quote: `OVR ${homeHighlight.ovr} · ${starsForOvr(homeHighlight.ovr)} estrelas. Pronto para a primeira partida.`,
                    photoUrl: homeHighlight.imageSrc,
                  },
                  actions: [
                    { label: 'Ver elenco', href: '/team', variant: 'primary' },
                    { label: 'Treinar', href: '/team/treino', variant: 'outline' },
                  ],
                  topLeft: { label: 'Olefoot' },
                  scrollCueTargetId: 'home-below-fold',
                }}
              />
            );
          }

          // ── Modo RESULTADO (último jogo) ────────────────────────────
          const awayShort = lastMatch.away.slice(0, 3).toUpperCase();
          const formStr =
            last5.length > 0
              ? last5
                  .map((r) =>
                    r.result === 'win' ? 'V' : r.result === 'draw' ? 'E' : 'D',
                  )
                  .join(' ')
              : '—';

          // MVP do scout (se persistido) — senão cai no homeHighlight do plantel.
          const mvp = lastMatch.scoutMvp;
          const mvpEntity = mvp ? players[mvp.playerId] : null;
          const mvpOvr = mvpEntity
            ? mvpEntity.mintOverall ?? overallFromAttributes(mvpEntity.attrs)
            : homeHighlight.ovr;
          const mvpName = mvp?.name ?? homeHighlight.name;
          const mvpQuote = mvp?.headline ?? `OVR ${mvpOvr} · jogador de impacto.`;
          const mvpPhoto = mvpEntity
            ? playerPortraitSrc(
                { name: mvpEntity.name, portraitUrl: mvpEntity.portraitUrl },
                400,
                520,
              )
            : homeHighlight.imageSrc;

          return (
            <MatchdayHero
              data={{
                competition: lastMatch.status || 'Último jogo',
                statusPrimary: 'Final',
                statusSecondary:
                  lastMatch.result === 'win'
                    ? 'Vitória'
                    : lastMatch.result === 'draw'
                      ? 'Empate'
                      : 'Derrota',
                statusVariant: 'preview',
                home: {
                  short: homeShort,
                  name: lastMatch.home || club.name,
                  score: lastMatch.scoreHome,
                  form: { v: wins, e: draws, d: losses },
                },
                away: {
                  short: awayShort,
                  name: lastMatch.away,
                  score: lastMatch.scoreAway,
                },
                stats: [
                  { label: 'Vitórias', value: String(wins) },
                  { label: 'Empates', value: String(draws) },
                  { label: 'Derrotas', value: String(losses) },
                  { label: 'Apoio', value: `${Math.round(roundedSupport)}%` },
                  { label: 'Forma', value: formStr },
                ],
                highlight: {
                  name: mvpName,
                  number: mvpOvr,
                  quote: mvpQuote,
                  photoUrl: mvpPhoto,
                },
                actions: [
                  { label: 'Ver postgame', href: '/postgame', variant: 'primary' },
                  { label: 'Histórico', href: '/wallet', variant: 'outline' },
                ],
                topLeft: { label: 'Olefoot' },
                scrollCueTargetId: 'home-below-fold',
              }}
            />
          );
        })()}
      </section>

      {/* PRÓXIMA PARTIDA — banner enxuto: brasões + iniciais + 2 ações */}
      {fixture?.opponent ? (
        <section
          aria-label="Próxima partida"
          className="mb-8 bg-[var(--color-card)] border border-white/8 border-l-4 border-l-neon-yellow rounded-sm overflow-hidden"
        >
          <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5">
            <div
              className="flex items-center justify-start gap-3 mb-3 uppercase tracking-[0.35em] text-[10px] font-medium text-neon-yellow"
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              <span aria-hidden className="h-px w-6 bg-neon-yellow/40" />
              <span>Próxima partida · {fixture.kickoffLabel}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Duelo: [crest] CLB vs [crest] OPP */}
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-[2.5px] border-neon-yellow bg-deep-black grid place-items-center shrink-0">
                  <span className="font-display font-black uppercase text-neon-yellow text-[11px] sm:text-[13px] tracking-[0.06em]">
                    {(club.shortName ?? club.name).slice(0, 3).toUpperCase()}
                  </span>
                </div>
                <span
                  className="text-white/70 leading-none select-none"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontStyle: 'italic',
                    fontSize: 'clamp(20px, 3vw, 32px)',
                  }}
                >
                  vs
                </span>
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-[2.5px] border-white/40 bg-deep-black grid place-items-center shrink-0">
                  <span className="font-display font-black uppercase text-white text-[11px] sm:text-[13px] tracking-[0.06em]">
                    {(fixture.opponent.shortName ?? fixture.opponent.name)
                      .slice(0, 3)
                      .toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 ml-1 sm:ml-2">
                  <p className="font-display font-black uppercase text-white text-[14px] sm:text-[18px] tracking-tight leading-tight truncate">
                    {fixture.opponent.name}
                  </p>
                  <p className="font-display font-bold uppercase tracking-[0.18em] text-[10px] sm:text-[11px] text-white/55 truncate">
                    {fixture.competition} · {fixture.venue}
                  </p>
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-2 sm:gap-3 shrink-0">
                <Link
                  to="/match/quick"
                  className="bg-neon-yellow text-black hover:bg-white px-4 py-2.5 font-display font-bold uppercase tracking-[0.18em] text-[11px] sm:text-[12px] transition-colors rounded-sm shadow-[0_4px_12px_rgba(253,225,0,0.25)]"
                >
                  Partida rápida
                </Link>
                <Link
                  to="/team"
                  className="bg-black border border-white/15 text-white px-4 py-2.5 font-display font-bold uppercase tracking-[0.18em] text-[11px] sm:text-[12px] hover:border-neon-yellow hover:text-neon-yellow transition-colors rounded-sm"
                >
                  Ver táticas
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div id="home-below-fold" className="grid grid-cols-1 md:grid-cols-3 gap-6 scroll-mt-4">
        {/* Torcidômetro - Industrial Style */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="sports-panel panel-accent p-6"
        >
          <div className="flex justify-between items-end mb-4">
            <div>
              <h3 className="font-display font-bold text-xl text-neon-yellow uppercase tracking-[0.2em]">Apoio da Torcida</h3>
              <div className="text-4xl font-display font-black text-white mt-1">{supportLabel}<span className="text-2xl text-neon-yellow">%</span></div>
            </div>
            <Activity className="w-8 h-8 text-neon-yellow opacity-50 mb-1" />
          </div>
          <div className="h-2 bg-dark-gray overflow-hidden relative skew-x-[-10deg]">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${roundedSupport}%` }}
              transition={{ duration: 1, delay: 0.5 }}
              className="absolute top-0 left-0 h-full bg-neon-yellow"
            />
          </div>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-4">Status: {crowd.moodLabel}</p>
        </motion.div>

        {/* Últimos resultados — alinhado ao bloco industrial da grelha (Torcidômetro / Amistoso) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="sports-panel panel-accent p-0 overflow-hidden flex flex-col min-h-[300px]"
        >
          <div className="flex justify-between items-end gap-3 px-6 pt-6 pb-4 border-b border-white/10">
            <div className="min-w-0">
              <h3 className="font-display font-bold text-xl text-neon-yellow uppercase tracking-[0.2em]">Últimos resultados</h3>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">
                {results.length > 0
                  ? `${Math.min(5, results.length)} últimos · o teu percurso`
                  : 'Histórico vazio'}
              </p>
            </div>
            <Trophy className="w-8 h-8 text-neon-yellow opacity-50 shrink-0 mb-0.5" />
          </div>

          <div className="px-6 py-4 flex-1 flex flex-col gap-2">
            {results.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-white/10 bg-dark-gray/40">
                <p className="text-sm font-display font-bold text-gray-300 uppercase tracking-wider">Sem jogos ainda</p>
                <p className="text-[11px] text-gray-600 mt-2 max-w-[220px] leading-relaxed">
                  Entra em campo — os placares aparecem aqui com estilo de painel desportivo.
                </p>
              </div>
            ) : (
              results.slice(0, 5).map((match, i) => {
                const meta = resultOutcomeMeta(match.result);
                const isUsHome = match.home === club.name;
                const isUsAway = match.away === club.name;
                return (
                  <motion.div
                    key={`${match.home}-${match.away}-${match.scoreHome}-${match.scoreAway}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.06 + i * 0.05, type: 'spring', stiffness: 380, damping: 28 }}
                    className={cn(
                      'group relative flex overflow-hidden border border-white/10 bg-dark-gray',
                      'hover:border-neon-yellow/30 transition-colors duration-200',
                    )}
                  >
                    <div className={cn('w-1 shrink-0', meta.bar)} aria-hidden />
                    <div className="flex-1 flex items-stretch min-w-0">
                      <div className="flex-1 min-w-0 py-2.5 pl-3 pr-1 flex flex-col justify-center items-end text-right">
                        <span
                          className={cn(
                            'font-display font-bold text-[11px] sm:text-xs uppercase tracking-wide truncate w-full',
                            isUsHome ? 'text-neon-yellow' : 'text-gray-400 group-hover:text-gray-300',
                          )}
                        >
                          {match.home}
                        </span>
                        {isUsHome ? (
                          <span className="text-[9px] font-black text-neon-yellow/70 uppercase tracking-widest mt-0.5">
                            Casa
                          </span>
                        ) : null}
                      </div>
                      <div className="shrink-0 flex flex-col items-center justify-center px-2 sm:px-3 border-x border-white/10 bg-black/40">
                        <div className="flex items-center gap-1.5 font-display font-black tabular-nums leading-none">
                          <span className="text-lg sm:text-xl text-white">{match.scoreHome}</span>
                          <span className="text-neon-yellow text-sm sm:text-base pb-0.5">:</span>
                          <span className="text-lg sm:text-xl text-white">{match.scoreAway}</span>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-600 mt-1">
                          {match.status}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 py-2.5 pr-3 pl-1 flex flex-col justify-center items-start text-left">
                        <span
                          className={cn(
                            'font-display font-bold text-[11px] sm:text-xs uppercase tracking-wide truncate w-full',
                            isUsAway ? 'text-neon-yellow' : 'text-gray-400 group-hover:text-gray-300',
                          )}
                        >
                          {match.away}
                        </span>
                        {isUsAway ? (
                          <span className="text-[9px] font-black text-neon-yellow/70 uppercase tracking-widest mt-0.5">
                            Fora
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div
                      className={cn(
                        'shrink-0 w-[3.25rem] sm:w-14 flex flex-col items-center justify-center border-l border-white/10',
                        meta.side,
                      )}
                    >
                      <span className={cn('font-display font-black text-xl sm:text-2xl leading-none', meta.pill)}>
                        {meta.label}
                      </span>
                      <span className={cn('hidden sm:block text-[8px] font-bold uppercase tracking-wider mt-1 opacity-90', meta.pill)}>
                        {meta.sub}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          <div className="px-6 pb-6 pt-2">
            <button
              type="button"
              onClick={scrollToNotificacoes}
              className="w-full py-2.5 border border-white/10 bg-dark-gray text-[10px] font-display font-bold uppercase tracking-widest text-gray-400 hover:text-neon-yellow hover:border-neon-yellow/25 transition-colors"
            >
              Ver notificações ↓
            </button>
          </div>
        </motion.div>

        {/* Create Game */}
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={() => setAmistosoOpen(true)}
          className="sports-panel p-6 flex flex-col justify-center items-center text-center cursor-pointer hover:border-neon-yellow transition-colors group w-full"
        >
          <div className="w-16 h-16 bg-dark-gray border border-white/10 flex items-center justify-center mb-4 -skew-x-6 group-hover:bg-neon-yellow transition-colors">
            <Zap className="w-8 h-8 text-white group-hover:text-black skew-x-6 transition-colors" />
          </div>
          <h3 className="font-display font-bold text-2xl uppercase tracking-wider">Amistoso</h3>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Desafie Rivais</p>
        </motion.button>
      </div>

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
                                <span className="shrink-0 text-[10px] text-gray-500">{formatExp(row.exp)} EXP</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
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

      {/* Ranking + Notificações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking OLE */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="sports-panel p-0"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-dark-gray p-4">
            <h3 className="min-w-0 truncate font-display text-lg font-bold uppercase tracking-wider min-[390px]:text-xl">
              Ranking OLE
            </h3>
            <span className="shrink-0 text-right text-[10px] font-bold uppercase tracking-wider text-neon-yellow min-[390px]:text-xs">
              Top 10 por EXP
            </span>
          </div>
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchTeam}
                onChange={(e) => setSearchTeam(e.target.value)}
                placeholder="Buscar por nome do time"
                className="w-full bg-black/40 border border-white/10 rounded px-9 py-2 text-sm"
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-2">Os 5 primeiros são sempre os líderes do ranking mundial.</p>
          </div>
          <div className="divide-y divide-white/5">
            {ranking.map((row) => (
              <div key={`${row.team}-${row.rank}`} className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors">
                <div className={cn(
                  'w-8 h-8 flex items-center justify-center text-xs font-display font-black rounded',
                  row.rank <= 3 ? 'bg-neon-yellow text-black' : 'bg-white/10 text-white',
                )}>
                  {row.rank <= 3 ? <Trophy className="w-4 h-4" /> : `#${row.rank}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-display font-bold truncate', row.isMe ? 'text-neon-yellow' : 'text-white')}>
                    {row.team} {row.isMe ? '(Você)' : ''}
                  </div>
                  <div className="text-[10px] text-gray-500">{formatExp(row.exp)} EXP</div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFavorite(row.team)}
                  className={cn(
                    'p-1.5 rounded border',
                    favorites.has(row.team) ? 'border-neon-yellow text-neon-yellow' : 'border-white/10 text-gray-500',
                  )}
                >
                  <Star className={cn('w-4 h-4', favorites.has(row.team) && 'fill-neon-yellow')} />
                </button>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-white/10 bg-black/20">
            <Link
              to="/ranking"
              className="flex w-full items-center justify-center gap-2 py-3 rounded-sm border border-neon-yellow/40 bg-neon-yellow/10 text-neon-yellow font-display font-black uppercase text-sm tracking-wider hover:bg-neon-yellow/20 transition-colors"
            >
              Ver ranking completo
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

        {/* Notificações — inbox operacional (não placares) */}
        <motion.div
          ref={notificacoesRef}
          id="notificacoes"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="sports-panel p-0 scroll-mt-24"
        >
          <div className="bg-dark-gray p-4 border-b border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
              <div>
                <h3 className="font-display font-bold text-xl uppercase tracking-[0.2em] text-neon-yellow">Notificações</h3>
                <p className="text-[10px] text-gray-500 mt-1 max-w-md">
                  Staff, torcida, jogadores e competição. Placares e histórico de jogos ficam na liga e no histórico de partidas.
                </p>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {HOME_NOTIF_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setNotifTab(key)}
                  className={cn(
                    'px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-wider border transition-colors',
                    notifTab === key
                      ? 'border-neon-yellow text-neon-yellow bg-neon-yellow/10'
                      : 'border-white/10 text-gray-400 hover:border-white/20',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {filteredInbox.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500 space-y-2">
                <p>Nada nesta categoria na HOME.</p>
                <p className="text-[11px] text-gray-600 max-w-sm mx-auto leading-relaxed">
                  Recompensas de EXP e relatórios de staff após cada partida não aparecem aqui — ficam registados na carteira e no fluxo do plantel; o desfecho desportivo está no histórico de jogos.
                </p>
              </div>
            ) : (
              <>
                {inboxPanelList.map((news) => (
                  <div
                    key={news.id}
                    className={cn(
                      'flex items-start gap-4 p-4 hover:bg-white/5 transition-colors',
                      news.read && 'opacity-70',
                      news.kind === 'friend_invite' && 'border-l-2 border-fuchsia-500/70 bg-fuchsia-500/[0.06]',
                    )}
                  >
                    <div className="text-gray-500 font-display font-bold text-sm w-12 text-right shrink-0 pt-0.5">
                      {news.timeLabel}
                    </div>
                    <div className="w-1 min-h-[2.5rem] bg-dark-gray relative shrink-0 rounded-sm">
                      <div className={cn('absolute inset-0', news.colorClass.replace('text-', 'bg-'))} style={{ opacity: 0.5 }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className={cn('text-[10px] font-bold uppercase tracking-widest', news.colorClass)}>{news.tag}</span>
                        {news.advisorLabel ? (
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">{news.advisorLabel}</span>
                        ) : null}
                      </div>
                      <h4 className="font-bold text-md mt-0.5">{news.title}</h4>
                      {news.body ? <InboxBodyText text={news.body} /> : null}
                      {news.deepLink && news.kind !== 'friend_invite' ? (
                        <Link
                          to={news.deepLink}
                          className="inline-flex items-center gap-1 mt-2 text-[10px] font-display font-bold uppercase tracking-wider text-neon-yellow/90 hover:text-neon-yellow"
                        >
                          Abrir
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : null}
                      {news.kind === 'friend_invite' && (
                        <Link
                          to="/profile#rede-manager"
                          className="inline-flex items-center gap-1 mt-2 text-[10px] font-display font-bold uppercase tracking-wider text-neon-yellow hover:text-neon-yellow/80"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Ver solicitações no perfil
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
                {filteredInbox.length > HOME_NOTIF_VISIBLE_COUNT && (
                  <div className="p-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-black/20">
                    <p className="text-[11px] text-gray-500">
                      A mostrar {notifShowAll ? filteredInbox.length : HOME_NOTIF_VISIBLE_COUNT} de {filteredInbox.length}{' '}
                      nesta categoria.
                    </p>
                    <button
                      type="button"
                      onClick={() => setNotifShowAll((v) => !v)}
                      className="text-[10px] font-display font-bold uppercase tracking-widest text-neon-yellow hover:text-white transition-colors inline-flex items-center gap-1"
                    >
                      {notifShowAll ? (
                        <>
                          Mostrar menos
                          <ChevronRight className="w-3.5 h-3.5 rotate-[-90deg]" />
                        </>
                      ) : (
                        <>
                          Ler tudo
                          <ChevronRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
