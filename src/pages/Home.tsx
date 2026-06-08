import { motion, AnimatePresence } from 'motion/react';
import { Zap, ChevronRight, Activity, Search, Star, X, UserPlus, TrendingUp, Heart } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatExp, FRIENDLY_CHALLENGE_BRO_FEE_RATE, friendlyChallengeBroFeeCents } from '@/systems/economy';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '@/supabase/client';
import { useNextGlobalFixture } from '@/hooks/useNextGlobalFixture';
import { useCrowdSupport } from '@/hooks/useCrowdSupport';
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
import { makeInboxItem } from '@/game/inboxItem';
import { DashboardGrid, DashboardSection } from '@/components/dashboard';
import { matchdayHomeCrestUrl } from '@/settings/matchdayCrest';
import { computeCareerTier } from '@/systems/careerTiers';
import { MarketActivityFeed } from '@/market/MarketActivityFeed';
import { fetchMarketActivities } from '@/supabase/marketActivities';
import type { MarketActivity } from '@/market/socialTrade';
import { HomeManagerFeed } from '@/components/home/HomeManagerFeed';
import { SquadNewsCard } from '@/components/home/SquadNewsCard';
import { MatchPredictionPanel } from '@/components/match/MatchPredictionPanel';
import { simulateMatchN } from '@/match/matchMonteCarlo';
import { computeMatchContextModifiers } from '@/match/contextFactors';
import { selectEffectiveTeamStrength } from '@/match/availabilityReport';
import { LegacyRoundBanner } from '@/components/home/LegacyRoundBanner';
import { HomeHeroLegacy } from '@/components/home/HomeHeroLegacy';
import { MatchdayHero } from '@/components/matchday/MatchdayHero';
import { AbsenceBanner } from '@/components/olefoot-python-mode/AbsenceBanner';
import { LoginBonusWidget } from '@/components/olefoot-python-mode/LoginBonusWidget';
import { EngagementBadge } from '@/components/EngagementBadge';
import { PassiveIncomeWidget } from '@/components/PassiveIncomeWidget';
import { DailyChallengesCard } from '@/components/match/DailyChallengesCard';
import { DailyCycleWidget } from '@/components/matchglobal/DailyCycleWidget';
import { shouldResetDailyChallenges } from '@/game/dailyChallenges';
import { shouldRefreshChallenges } from '@/match/quickStreakChallenges';
import { fetchMyPendingPvpResults, claimPvpMatchResult } from '@/supabase/pvpMatches';

/**
 * DEV mode: quando faltam dados reais (save fresco, sem fixture com crest,
 * sem histórico), mostra o MOCK editorial pra reconstrução visual ficar
 * "viva". Em produção, o fallback ESTREIA limpo é exibido.
 */
const HOME_HERO_DEV_MOCK = import.meta.env.DEV;
/**
 * Brasões usados só em DEV pra preview do hero/banner.
 * Origem: api-sports media (mesmo CDN que o save real consome via
 * src/settings/brazilianClubs.ts — Flamengo id=127, Palmeiras id=121).
 */
const DEV_HOME_CREST = 'https://media.api-sports.io/football/teams/127.png';
const DEV_AWAY_CREST = 'https://media.api-sports.io/football/teams/121.png';
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
  const crowd = useCrowdSupport();
  const results = useGameStore((s) => s.results);
  const inbox = useGameStore((s) => s.inbox);
  const fixture = useGameStore((s) => s.nextFixture);
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);
  const playerHealth = useGameStore((s) => s.playerHealth);

  // Próxima partida real da Global League — sobrepõe o fixture estático (TITANS mock)
  const nextGlobal = useNextGlobalFixture();
  /** Sprint C — Fase A: dados extras pro mini-painel manager. */
  const playerSeasonLedger = useGameStore((s) => s.playerSeasonLedger);
  const formGlobal = useGameStore((s) => s.form);
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const localLeagues = useGameStore((s) => s.localLeagues);
  const homeCrestUrl = useGameStore((s) => matchdayHomeCrestUrl(s.userSettings));
  const awayCrestUrl = useGameStore(
    (s) => s.nextFixture.opponent.supporterCrestUrl?.trim() ?? null,
  );
  const dailyChallenges = useGameStore((s) => s.dailyChallenges);
  const streakChallenges = useGameStore((s) => s.streakChallenges);

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

  const homeHighlightBest = useMemo(() => pickHighlightFromRoster(players), [players]);
  /**
   * Sprint C — Fase A: highlight expandido com inteligência manager.
   * Gols/assistências do ledger, forma recente do team, delta OVR vs mintOverall,
   * tag dinâmica baseada em performance, CTA contextual.
   */
  const homeHighlight = useMemo(() => {
    if (!homeHighlightBest) {
      return {
        id: '',
        name: '—',
        ovr: 70,
        position: undefined as string | undefined,
        imageSrc: 'https://picsum.photos/seed/home-placeholder/400/520',
        goalsSeason: undefined as number | undefined,
        assistsSeason: undefined as number | undefined,
        mvpsSeason: undefined as number | undefined,
        recentForm: undefined as Array<'W' | 'D' | 'L'> | undefined,
        deltaOvr: undefined as number | undefined,
        tag: undefined as string | undefined,
      };
    }
    const currentOvr = overallFromAttributes(homeHighlightBest.attrs);
    const mintOvr = homeHighlightBest.mintOverall ?? currentOvr;
    const deltaOvr = currentOvr - mintOvr;

    const ledger = playerSeasonLedger?.[homeHighlightBest.id];
    const goalsSeason = ledger?.goals ?? 0;
    const assistsSeason = ledger?.assists ?? 0;
    const matchesPlayed = ledger?.matchesPlayed ?? 0;
    // MVPs da temporada — conta resultados onde o scoutMvp.playerId bate com o destaque
    const mvpsSeason = (results ?? []).filter(
      (r) => r.scoutMvp?.playerId === homeHighlightBest.id,
    ).length;

    // Forma recente do TIME (últimos 5) — proxy para forma do jogador
    // (até termos forma individual no ledger).
    const recentForm: Array<'W' | 'D' | 'L'> = (formGlobal ?? [])
      .slice(0, 5)
      .map((f) => (f === 'W' || f === 'D' || f === 'L' ? f : 'D'));

    // Tag dinâmica
    let tag: string | undefined;
    if (matchesPlayed === 0) {
      tag = 'Promessa';
    } else if (goalsSeason >= 5) {
      tag = 'Artilheiro';
    } else if (goalsSeason + assistsSeason >= 5) {
      tag = 'Em forma';
    } else if (deltaOvr >= 5) {
      tag = 'Em ascensão';
    } else if (currentOvr >= 80) {
      tag = 'Maestro';
    } else {
      tag = 'Joia do plantel';
    }

    return {
      id: homeHighlightBest.id,
      name: homeHighlightBest.name,
      position: homeHighlightBest.pos,
      ovr: currentOvr,
      imageSrc: playerPortraitSrc(
        { name: homeHighlightBest.name, portraitUrl: homeHighlightBest.portraitUrl },
        400,
        520,
      ),
      goalsSeason,
      assistsSeason,
      mvpsSeason,
      recentForm: recentForm.length > 0 ? recentForm : undefined,
      deltaOvr,
      tag,
    };
  }, [homeHighlightBest, playerSeasonLedger, formGlobal, results]);

  // awayHighlight removido — destaque agora é único (homeHighlight) no padrão
  // /matchday/preview com número OVR gigante decorativo. Se voltar a precisar
  // do duo casa × visitante, recuperar via git history.
  const roundedSupport = Math.max(0, Math.min(100, Math.round(crowd.supportPercent * 2) / 2));

  /**
   * Sprint C Fase D: 4 tiles cinemáticos do mini-painel manager.
   * Tile #2 mostra POSIÇÃO no ranking global em vez de saldo BRO/EXP.
   */
  const managerStatTiles = useMemo(() => {
    const squadSize = Object.keys(players).length;
    const ovrXi = (() => {
      const ovrs = Object.values(players)
        .map((p) => overallFromAttributes(p.attrs))
        .sort((a, b) => b - a)
        .slice(0, 11);
      if (!ovrs.length) return 0;
      return Math.round(ovrs.reduce((s, o) => s + o, 0) / ovrs.length);
    })();

    // Sprint C Fase D: posição global do manager (1-based) — calcula localmente
    // pra evitar circular dep com fullSorted que é declarado depois.
    const allRanked = getFullRankingEntries(club.name, finance.ole, club.id);
    const myRankIdx = allRanked.findIndex((r) => r.isMe);
    const myRank = myRankIdx >= 0 ? myRankIdx + 1 : null;
    const totalManagers = allRanked.length;

    const last5 = (formGlobal ?? []).slice(0, 5);
    const formStr = last5.length === 0 ? '—' : last5.join('');

    let ligaValue = 'Aguarda';
    let ligaTone: 'accent' | 'success' | 'warning' | 'muted' = 'muted';
    if (globalLeagueMVP) {
      if (globalLeagueMVP.status === 'waiting_teams') {
        ligaValue = `${globalLeagueMVP.teams.length}/${globalLeagueMVP.minTeamsRequired}`;
        ligaTone = 'accent';
      } else if (globalLeagueMVP.status === 'playoffs') {
        ligaValue = 'Playoffs';
        ligaTone = 'warning';
      } else if (globalLeagueMVP.status === 'active') {
        ligaValue = 'Em curso';
        ligaTone = 'success';
      } else {
        ligaValue = 'Encerrada';
      }
    }

    return [
      {
        label: `Plantel · OVR ${ovrXi || '—'}`,
        value: String(squadSize),
        href: '/clube/elenco',
        tone: 'accent' as const,
      },
      {
        label: totalManagers > 0 ? `Ranking · de ${totalManagers}` : 'Ranking Global',
        value: myRank ? `#${myRank}` : '—',
        href: '/competicao/ranking',
        tone: 'accent' as const,
      },
      {
        label: 'Forma · 5J',
        value: formStr,
        href: '/competicao/calendario',
        tone: 'accent' as const,
      },
      {
        label: 'Liga Global',
        value: ligaValue,
        href: '/competicao/ligas',
        tone: ligaTone,
      },
      {
        label: 'Liga Classic',
        value: localLeagues?.classic?.points
          ? `${localLeagues.classic.points} pts`
          : '0 pts',
        href: '/ligas-locais',
        tone: 'accent' as const,
      },
      {
        label: 'Fast Liga',
        value: localLeagues?.fast?.points
          ? `${localLeagues.fast.points} pts`
          : '0 pts',
        href: '/ligas-locais',
        tone: 'accent' as const,
      },
    ];
  }, [players, club.name, club.id, finance.ole, formGlobal, globalLeagueMVP, localLeagues]);

  /** Sprint C Fase F: sem CTAs no destaque (visual mais limpo). */
  const highlightCtas = useMemo(
    () => ({ primary: undefined, secondary: undefined }),
    [],
  );

  // Fase 1 — Predição V/E/D pra próxima partida. Seed estável (a partir do
  // opponentId ou fixture id) pra manager ver MESMA leitura ao reabrir Home.
  const nextMatchPrediction = useMemo(() => {
    const opponentOvr = nextGlobal?.opponentOverall ?? fixture?.opponent?.strength;
    const opponentId = nextGlobal
      ? `g_${nextGlobal.fixture?.id ?? `${nextGlobal.opponentName}_${nextGlobal.roundNumber}`}`
      : fixture?.opponent?.id;
    if (!opponentOvr || !opponentId || opponentId === 'placeholder-opponent' || opponentId === 'no-opponent-available') {
      return null;
    }
    const effective = selectEffectiveTeamStrength({ players, health: playerHealth });
    if (effective.startersCounted === 0) return null;
    const isHome = nextGlobal ? nextGlobal.isHome : true;
    const mods = computeMatchContextModifiers({
      isHome,
      effectiveTeamStrength: effective,
    });
    const seed = Array.from(opponentId).reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 11);
    return simulateMatchN({
      homeTeamOvr: effective.effectiveOverall,
      awayTeamOvr: opponentOvr,
      contextModifiers: mods,
      effectiveHomeStrength: effective,
      homeRoster: Object.values(players),
      n: 800,
      seed,
    });
  }, [nextGlobal, fixture?.opponent?.id, fixture?.opponent?.strength, players, playerHealth]);

  /**
   * Sprint C — Fase B: contexto smart do hero (eyebrow + status).
   * Eyebrow muda dependendo de: tier, próximo jogo, último resultado, streak.
   * Status compacto reflete o estado atual em 1-2 palavras.
   */
  const heroContext = useMemo(() => {
    const tier = computeCareerTier(finance.expLifetimeEarned ?? finance.ole ?? 0);
    const expCompact = formatExp(finance.ole);
    const lastMatch = results[0];
    const last5 = (formGlobal ?? []).slice(0, 5);

    // Streak detection (consecutivas)
    const streakWins = (() => {
      let n = 0;
      for (const f of last5) {
        if (f === 'W') n += 1;
        else break;
      }
      return n;
    })();
    const streakLosses = (() => {
      let n = 0;
      for (const f of last5) {
        if (f === 'L') n += 1;
        else break;
      }
      return n;
    })();

    // Próximo jogo iminente?
    const nowMs = Date.now();
    const nextKickoffMs = fixture?.opponent?.shortName
      ? null /* fixture sem timestamp aqui — placeholder */
      : null;

    let eyebrow: string;
    let statusPrimary: string;
    let statusSecondary: string;

    if (!lastMatch && (results.length === 0)) {
      // Estreia: foco em identidade + saldo
      eyebrow = `OLE FC · TIER ${tier.id} ${tier.name.toUpperCase()} · ${expCompact} EXP`;
      statusPrimary = 'Estreia';
      statusSecondary = 'Aguarda 1º jogo';
    } else if (streakWins >= 3) {
      eyebrow = `OLE FC · ${streakWins} VITÓRIAS SEGUIDAS · ${expCompact} EXP`;
      statusPrimary = 'Invencível';
      statusSecondary = `${streakWins} jogos`;
    } else if (streakLosses >= 2) {
      eyebrow = `OLE FC · RECONSTRUÇÃO · ${expCompact} EXP`;
      statusPrimary = 'Reconstruir';
      statusSecondary = 'a partir de hoje';
    } else if (lastMatch?.result === 'win') {
      eyebrow = `OLE FC · ÚLTIMO JOGO: VITÓRIA ${lastMatch.scoreHome}-${lastMatch.scoreAway} · ${expCompact} EXP`;
      statusPrimary = 'Vitória';
      statusSecondary = 'na última';
    } else if (lastMatch?.result === 'loss') {
      eyebrow = `OLE FC · TIER ${tier.id} ${tier.name.toUpperCase()} · PRÓXIMO DESAFIO`;
      statusPrimary = 'Resposta';
      statusSecondary = 'no próximo jogo';
    } else {
      eyebrow = `OLE FC · TIER ${tier.id} ${tier.name.toUpperCase()} · ${expCompact} EXP`;
      statusPrimary = lastMatch ? 'Final' : 'Próximo';
      statusSecondary = lastMatch
        ? lastMatch.result === 'draw'
          ? 'Empate'
          : 'Resultado'
        : 'em preparação';
    }

    void nextKickoffMs;
    void nowMs;

    return { eyebrow, statusPrimary, statusSecondary };
  }, [finance.ole, finance.expLifetimeEarned, results, formGlobal, fixture]);
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

  // Atividades reais do mercado — feed público do Supabase
  const [marketActivities, setMarketActivities] = useState<MarketActivity[]>([]);
  useEffect(() => {
    void fetchMarketActivities(10).then(setMarketActivities);
  }, []);

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

  const scrollToMarketFeed = () => {
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
    <div className="w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden">
      <div className="w-full min-w-0 mx-auto space-y-6 sm:space-y-8 max-w-6xl xl:max-w-none">
      {/* HERO PRINCIPAL — editorial hero-legacy-full + news ticker + saudação manager */}
      <section
        aria-label="Hero do manager"
        className="-mx-3 -mt-3 sm:-mx-4 sm:-mt-4 lg:-mx-8 lg:-mt-8 mb-6"
      >
        <HomeHeroLegacy scrollCueTargetId="home-below-fold" />
      </section>

      {/* OLEFOOT PYTHON MODE — alerta de ausência + bonus de login + desafios diários */}
      <section aria-label="Estado do clube" className="space-y-2.5">
        <AbsenceBanner />
        <DailyCycleWidget />
        <LoginBonusWidget />
        <EngagementBadge />
        <PassiveIncomeWidget />
        {dailyChallenges && dailyChallenges.challenges.length > 0 && (
          <DailyChallengesCard
            challenges={dailyChallenges.challenges}
            onClaimReward={(challengeId) =>
              dispatch({ type: 'CLAIM_CHALLENGE_REWARD', challengeId })
            }
            compact
          />
        )}
      </section>

      {/* HERO LEGADO — temporariamente desabilitado pelo HomeHeroLegacy. */}
      {false && (
        <section
          aria-label="Último jogo (legado)"
          className="hidden"
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
                  competition: heroContext.eyebrow,
                  statusPrimary: heroContext.statusPrimary,
                  statusSecondary: heroContext.statusSecondary,
                  statusVariant: 'preview',
                  solidYellow: true,
                  home: {
                    short: homeShort,
                    name: club.name,
                    score: 0,
                    crestUrl: homeCrestUrl ?? (HOME_HERO_DEV_MOCK ? DEV_HOME_CREST : null),
                  },
                  away: {
                    short: '—',
                    name: 'Adversário',
                    score: 0,
                    crestUrl: HOME_HERO_DEV_MOCK ? DEV_AWAY_CREST : null,
                  },
                  stats: managerStatTiles,
                  highlight: {
                    name: homeHighlight.name,
                    number: homeHighlight.ovr,
                    quote: `OVR ${homeHighlight.ovr} · ${starsForOvr(homeHighlight.ovr)} estrelas. Pronto para a primeira partida.`,
                    photoUrl: homeHighlight.imageSrc,
                    position: homeHighlight.position,
                    tag: homeHighlight.tag,
                    goalsSeason: homeHighlight.goalsSeason,
                    assistsSeason: homeHighlight.assistsSeason,
                    mvpsSeason: homeHighlight.mvpsSeason,
                    recentForm: homeHighlight.recentForm,
                    deltaOvr: homeHighlight.deltaOvr,
                    ctaPrimary: highlightCtas.primary,
                    ctaSecondary: highlightCtas.secondary,
                  },
                  actions: [],
                  topLeft: { label: 'Olefoot' },
                  scrollCueTargetId: 'home-below-fold',
                }}
              />
            );
          }

          // ── Modo RESULTADO (último jogo) ────────────────────────────
          const awayShort = lastMatch.away.slice(0, 3).toUpperCase();

          // Calcular ranking e variação percentual
          const currentRanking = 1; // TODO: pegar do sistema de ranking real
          const previousRanking = 1; // TODO: pegar do histórico de ranking
          const rankingChange = previousRanking > 0
            ? Math.round(((previousRanking - currentRanking) / previousRanking) * 100)
            : 0;
          const rankingChangeStr = rankingChange > 0
            ? `+${rankingChange}%`
            : rankingChange < 0
              ? `${rankingChange}%`
              : '0%';

          // MVP do scout (se persistido) — senão cai no homeHighlight do plantel.
          const mvp = lastMatch.scoutMvp;
          // Ignora MVP se for o fallback 'Equipe' (sem playerId válido)
          const isValidMvp = mvp && mvp.playerId && mvp.name !== 'Equipe';
          const mvpEntity = isValidMvp ? players[mvp.playerId] : null;
          const mvpOvr = mvpEntity
            ? mvpEntity.mintOverall ?? overallFromAttributes(mvpEntity.attrs)
            : homeHighlight.ovr;
          const mvpName = isValidMvp ? mvp.name : homeHighlight.name;
          const mvpQuote = isValidMvp ? mvp.headline : `OVR ${mvpOvr} · jogador de impacto.`;
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
                competition: heroContext.eyebrow,
                statusPrimary: heroContext.statusPrimary,
                statusSecondary: heroContext.statusSecondary,
                statusVariant: 'preview',
                solidYellow: true,
                home: {
                  short: homeShort,
                  name: lastMatch.home || club.name,
                  score: lastMatch.scoreHome,
                  crestUrl: homeCrestUrl ?? (HOME_HERO_DEV_MOCK ? DEV_HOME_CREST : null),
                },
                away: {
                  short: awayShort,
                  name: lastMatch.away,
                  score: lastMatch.scoreAway,
                  crestUrl: awayCrestUrl ?? (HOME_HERO_DEV_MOCK ? DEV_AWAY_CREST : null),
                },
                stats: managerStatTiles,
                highlight: {
                  name: mvpName,
                  number: mvpOvr,
                  quote: mvpQuote,
                  photoUrl: mvpPhoto,
                  position: mvpEntity?.pos ?? homeHighlight.position,
                  tag: homeHighlight.tag,
                  goalsSeason: homeHighlight.goalsSeason,
                  assistsSeason: homeHighlight.assistsSeason,
                  mvpsSeason: homeHighlight.mvpsSeason,
                  recentForm: homeHighlight.recentForm,
                  deltaOvr: homeHighlight.deltaOvr,
                  ctaPrimary: highlightCtas.primary,
                  ctaSecondary: highlightCtas.secondary,
                },
                actions: [],
                topLeft: { label: 'Olefoot' },
                scrollCueTargetId: 'home-below-fold',
              }}
            />
          );
        })()}
        </section>
      )}

      {/* Liga LEGACY — banner adaptativo (AO VIVO ou countdown) — topo do fold */}
      <div id="home-below-fold">
        <LegacyRoundBanner />
      </div>

      <DashboardGrid>
      {/* PRÓXIMA PARTIDA — wide
          Prioridade: Global League real > fixture estático (TITANS mock) */}
      {(nextGlobal || fixture?.opponent) ? (() => {
        // Dados resolvidos: Global League tem prioridade sobre o mock estático
        const isGlobal = !!nextGlobal;
        const kickoffLabel = isGlobal
          ? (() => {
              const d = new Date(nextGlobal.scheduledKickoffMs);
              const today = new Date();
              const isToday = d.toDateString() === today.toDateString();
              const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              return isToday ? `Hoje, ${timeStr}` : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${timeStr}`;
            })()
          : fixture.kickoffLabel;
        const opponentShort = isGlobal
          ? nextGlobal.opponentShort
          : (fixture.opponent.shortName ?? fixture.opponent.name).slice(0, 3).toUpperCase();
        const opponentName = isGlobal ? nextGlobal.opponentName : fixture.opponent.name;
        const competitionLabel = isGlobal
          ? (nextGlobal.roundType === 'playoff'
              ? `Liga Global · Playoffs Rd ${nextGlobal.roundNumber}`
              : `Liga Global · Rodada ${nextGlobal.roundNumber}${nextGlobal.division !== 'playoff' ? ` · Div ${nextGlobal.division}` : ''}`)
          : `${fixture.competition} · ${fixture.venue}`;
        const homeShort = isGlobal
          ? (nextGlobal.isHome ? club.shortName ?? club.name.slice(0, 3) : nextGlobal.opponentShort)
          : (club.shortName ?? club.name).slice(0, 3);
        const awayShort = isGlobal
          ? (nextGlobal.isHome ? nextGlobal.opponentShort : club.shortName ?? club.name.slice(0, 3))
          : opponentShort;
        const renderHomeCrest = isGlobal
          ? (nextGlobal.isHome ? (homeCrestUrl ?? (HOME_HERO_DEV_MOCK ? DEV_HOME_CREST : null)) : null)
          : (homeCrestUrl ?? (HOME_HERO_DEV_MOCK ? DEV_HOME_CREST : null));
        const renderAwayCrest = isGlobal
          ? (nextGlobal.isHome ? null : (homeCrestUrl ?? (HOME_HERO_DEV_MOCK ? DEV_HOME_CREST : null)))
          : (awayCrestUrl ?? (HOME_HERO_DEV_MOCK ? DEV_AWAY_CREST : null));
        const ctaLink = isGlobal ? '/match/global' : '/match/quick';
        const ctaLabel = isGlobal ? 'Ver Liga Global' : 'Partida rápida';

        return (
          <DashboardSection
            size="wide"
            ariaLabel="Próxima partida"
            className="bg-[var(--color-card)] border border-white/8 border-l-4 border-l-neon-yellow rounded-sm overflow-hidden"
          >
            <div className="w-full max-w-full min-w-0 px-3 sm:px-6 md:px-8 py-5 sm:py-7 flex flex-col items-center text-center gap-4">
              {/* Eyebrow */}
              <div className="ole-eyebrow !text-neon-yellow" style={{ fontFamily: 'var(--font-ui)' }}>
                <span>Próxima partida · {kickoffLabel}</span>
              </div>

              {/* Duelo: [crest/sigla] CASA × VISITANTE [crest/sigla] */}
              <div className="flex items-center justify-center gap-3 sm:gap-4 md:gap-6 w-full max-w-full min-w-0">
                {renderHomeCrest ? (
                  <img src={renderHomeCrest} alt={club.name}
                    className="w-14 h-14 sm:w-16 sm:h-16 object-contain shrink-0"
                    referrerPolicy="no-referrer" draggable={false} />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-[2.5px] border-neon-yellow bg-deep-black grid place-items-center shrink-0">
                    <span className="font-display font-black uppercase text-neon-yellow text-[12px] sm:text-[14px] tracking-[0.06em]">
                      {homeShort.slice(0, 3).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-neon-yellow/85 leading-none select-none"
                  style={{ fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic',
                    fontSize: 'clamp(28px, 4.5vw, 44px)', letterSpacing: '-0.04em', transform: 'translateY(-0.04em)' }}>
                  ×
                </span>
                {renderAwayCrest ? (
                  <img src={renderAwayCrest} alt={opponentName}
                    className="w-14 h-14 sm:w-16 sm:h-16 object-contain shrink-0"
                    referrerPolicy="no-referrer" draggable={false} />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-[2.5px] border-white/40 bg-deep-black grid place-items-center shrink-0">
                    <span className="font-display font-black uppercase text-white text-[12px] sm:text-[14px] tracking-[0.06em]">
                      {awayShort.slice(0, 3).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Liga + contexto */}
              <p className="text-white/55 uppercase"
                style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.22em', fontWeight: 600 }}>
                {competitionLabel}
              </p>

              {/* OVR adversário (só Global League) */}
              {isGlobal && (
                <p className="text-white/40 text-xs font-mono">
                  OVR adversário: <span className="text-neon-yellow font-bold">{nextGlobal.opponentOverall}</span>
                </p>
              )}

              {/* Penalidades ativas do time do manager */}
              {isGlobal && (nextGlobal.injuryRoundsRemaining > 0 || nextGlobal.suspensionRoundsRemaining > 0 || nextGlobal.yellowCardCount > 0) && (
                <div className="flex flex-wrap justify-center gap-2 text-[10px] font-mono">
                  {nextGlobal.suspensionRoundsRemaining > 0 && (
                    <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
                      🚫 Suspenso {nextGlobal.suspensionRoundsRemaining} rod.
                    </span>
                  )}
                  {nextGlobal.injuryRoundsRemaining > 0 && (
                    <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">
                      🚑 Lesão {nextGlobal.injuryRoundsRemaining} rod. ({nextGlobal.injuryModifier} OVR)
                    </span>
                  )}
                  {nextGlobal.yellowCardCount > 0 && nextGlobal.yellowCardCount < 3 && (
                    <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">
                      🟡 {nextGlobal.yellowCardCount}/3 amarelos
                    </span>
                  )}
                </div>
              )}

              {/* Fase 1 — Predição V/E/D compacta (acima das ações) */}
              {nextMatchPrediction ? (
                <div className="w-full max-w-[480px]">
                  <MatchPredictionPanel
                    result={nextMatchPrediction}
                    homeName={homeShort}
                    awayName={awayShort}
                    compact
                  />
                </div>
              ) : null}

              {/* Ações */}
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3 pt-1">
                <Link to={ctaLink}
                  className="bg-neon-yellow text-black hover:bg-white px-5 py-2.5 font-display font-bold uppercase tracking-[0.2em] text-[11px] sm:text-[12px] transition-colors shadow-[0_4px_12px_rgba(253,225,0,0.25)]"
                  style={{ borderRadius: 'var(--radius-sm)' }}>
                  {ctaLabel}
                </Link>
                <Link to="/team"
                  className="bg-deep-black border border-[var(--color-border)] text-white px-5 py-2.5 font-display font-bold uppercase tracking-[0.2em] text-[11px] sm:text-[12px] hover:border-neon-yellow/60 hover:text-neon-yellow transition-colors"
                  style={{ borderRadius: 'var(--radius-sm)' }}>
                  Ver táticas
                </Link>
              </div>
            </div>
          </DashboardSection>
        );
      })() : null}

      </DashboardGrid>

      {/* Mini-painel inteligente do manager (Sprint C Fase B) */}
      <HomeManagerFeed
        players={players}
        highlightId={homeHighlight.id}
        highlightName={homeHighlight.name}
        highlightPosition={homeHighlight.position}
        expLifetimeEarned={finance.expLifetimeEarned ?? finance.ole ?? 0}
      />

      {/* Novidades do elenco — Fase 2 acesa (selectStatusFeed) */}
      <SquadNewsCard />

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

      {/* Atividades do Mercado — Sprint C Fase G: editorial direto no fundo, sem card cinza */}
      <motion.section
        ref={notificacoesRef}
        id="market-feed"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="scroll-mt-24 mt-2 sm:mt-4 px-4 sm:px-6 lg:px-8"
        aria-label="Atividades do Mercado"
      >
        {/* Header editorial — eyebrow + MORET headline + régua + subtitle + CTAs */}
        <header className="flex flex-col items-start gap-3 mb-5 sm:mb-6">
          <span
            className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            OLE Football · Comunidade
          </span>
          <h2 className="leading-[0.95]">
            <span
              className="block font-bold uppercase text-white"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)',
                letterSpacing: '0.005em',
              }}
            >
              Atividades
            </span>
            <span
              className="block italic text-neon-yellow mt-0.5"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              do mercado
            </span>
          </h2>
          <span aria-hidden className="block w-12 h-[3px] bg-neon-yellow mt-1" />
          <p
            className="text-white/55 max-w-md"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              lineHeight: 1.5,
            }}
          >
            Compras, vendas e leilões recentes — movimentações dos outros managers e clubes IA.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Link
              to="/manager/mensagens"
              className="inline-flex items-center rounded-[var(--radius-pill)] border border-neon-yellow/40 bg-neon-yellow/10 px-4 py-2 font-display text-[10px] font-black uppercase tracking-[0.22em] text-neon-yellow transition-all hover:bg-neon-yellow/20"
            >
              Ver mensagens
            </Link>
            <Link
              to="/transfer"
              className="inline-flex items-center rounded-[var(--radius-pill)] border border-white/15 bg-white/[0.03] px-4 py-2 font-display text-[10px] font-black uppercase tracking-[0.22em] text-white/75 transition-all hover:border-white/30 hover:text-white"
            >
              Ir para Mercado
            </Link>
          </div>
        </header>

        {/* Feed de atividades — cards já têm fundo próprio, ficam soltos no dark */}
        <MarketActivityFeed activities={marketActivities} maxVisible={5} />
      </motion.section>

      {/* Apoio da Torcida — rodapé da Home, fundo cinza escuro com acento amarelo */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        aria-label="Apoio da torcida"
        className="relative isolate overflow-hidden mt-6 sm:mt-8"
      >
        <div className="px-5 sm:px-8 py-6 sm:py-7 flex flex-col items-center text-center gap-4">
          <div
            className="inline-flex items-center gap-3 text-white"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            <span aria-hidden className="h-px w-8 bg-white/25" />
            <span className="uppercase font-semibold" style={{ fontSize: '10px', letterSpacing: '0.22em' }}>
              Apoio da torcida
            </span>
            <span aria-hidden className="h-px w-8 bg-white/25" />
          </div>
          <p
            className="italic text-neon-yellow leading-none tabular-nums"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontWeight: 700,
              fontSize: 'clamp(2.75rem, 7vw, 4.25rem)',
              letterSpacing: '-0.03em',
            }}
          >
            {supportLabel}
            <span
              className="ml-1 text-neon-yellow/55 not-italic"
              style={{ fontFamily: 'var(--font-display)', fontSize: '0.55em' }}
            >
              %
            </span>
          </p>
          <div
            className="w-full max-w-md h-2 bg-white/10 overflow-hidden relative"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${roundedSupport}%` }}
              transition={{ duration: 1, delay: 0.5 }}
              className="absolute top-0 left-0 h-full"
              style={{
                background:
                  'linear-gradient(90deg, var(--color-neon-yellow-dark) 0%, var(--color-neon-yellow) 100%)',
              }}
            />
          </div>
          <p
            className="text-white uppercase"
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '11px',
              letterSpacing: '0.22em',
              fontWeight: 700,
            }}
          >
            {crowd.moodLabel}
          </p>
        </div>
      </motion.section>
      </div>
    </div>
  );
}
