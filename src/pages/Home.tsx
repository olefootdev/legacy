import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Flame, Search, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatExp } from '@/systems/economy';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { HeroCinematic } from '@/components/home/HeroCinematic';
import { NextMatchCard } from '@/components/home/NextMatchCard';
import { matchdayHomeCrestUrl } from '@/settings/matchdayCrest';
import { localCrestUrl } from '@/settings/crestUrl';
import { LegendsRail, type LegendMini } from '@/components/home/LegendsRail';
import { ManagerDesk } from '@/components/home/ManagerDesk';
import { InheritanceModule } from '@/components/home/InheritanceModule';
import { ManagerOfDay } from '@/components/home/ManagerOfDay';
import { RankingTop10 } from '@/components/home/RankingTop10';
import { LastGlobalChampion } from '@/components/home/LastGlobalChampion';
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
  const favoriteRealTeam = useGameStore((s) => s.userSettings?.favoriteRealTeam ?? null);
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

        {/* Próxima Partida — Liga Global + brasão do coração + countdown ao vivo */}
        <NextMatchCard
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

        {/* Ranking de Clubes — Top 10, aba Geral real */}
        <RankingTop10 top={top10} myRow={myRow} myRank={myRank} />

        {/* Último Campeão da Liga Global — time + manager (dados reais) */}
        <LastGlobalChampion />

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

    </div>
  );
}
