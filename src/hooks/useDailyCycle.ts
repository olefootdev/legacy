/**
 * useDailyCycle
 *
 * Deriva o estado do Ciclo Diário (Coroa do Dia) a partir do estado hidratado
 * da Liga Global (globalLeagueMVP) + fetches do bracket e das coroas.
 *
 *   • qualifying → "Corrida do Dia": ranking por daily_points, com o corte do
 *     top N (maior potência de 2 ≤ teto) que vai ao mata-mata às 19h BRT.
 *   • knockout   → bracket do mata-mata (rounds daily_ko).
 *   • crowned    → campeão do dia definido.
 *
 * Selector + fetch isolado: não muda o store. A Edge Function é a autoridade.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useGameStore } from '@/game/store';
import type { GlobalTeam, DailyKnockoutRound, DailyCrown } from '@/match/globalLeagueMVP';
import { loadDailyKnockoutFromSupabase, loadRecentCrowns } from '@/supabase/globalLeague';

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

function brtHour(nowMs: number): number {
  return new Date(nowMs - BRT_OFFSET_MS).getUTCHours();
}

/** ms até a próxima ocorrência de `hour` BRT (0 se já passou hoje). */
function msUntilBrtHour(nowMs: number, hour: number): number {
  const brt = new Date(nowMs - BRT_OFFSET_MS);
  const target = new Date(brt);
  target.setUTCHours(hour, 0, 0, 0);
  const diff = target.getTime() - brt.getTime();
  return diff > 0 ? diff : 0;
}

function largestPowerOfTwoAtMost(n: number): number {
  if (n < 2) return 0;
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

function rankDaily(teams: GlobalTeam[]): GlobalTeam[] {
  return [...teams].sort((a, b) => {
    const ap = a.dailyPoints ?? 0, bp = b.dailyPoints ?? 0;
    if (bp !== ap) return bp - ap;
    const ad = a.dailyGoalDifference ?? 0, bd = b.dailyGoalDifference ?? 0;
    if (bd !== ad) return bd - ad;
    const af = a.dailyGoalsFor ?? 0, bf = b.dailyGoalsFor ?? 0;
    if (bf !== af) return bf - af;
    if (b.overall !== a.overall) return b.overall - a.overall;
    return a.clubName.localeCompare(b.clubName);
  });
}

export interface DailyStandingRow {
  rank: number;
  team: GlobalTeam;
  isMe: boolean;
}

export interface DailyCycleView {
  phase: 'qualifying' | 'knockout' | 'crowned';
  qualifyHour: number;
  /** Ranking do dia (só quem jogou ao menos 1 partida). */
  standings: DailyStandingRow[];
  /** Tamanho do bracket que se forma com os qualificados atuais. */
  cutSize: number;
  myTeam: GlobalTeam | null;
  myRank: number | null;
  /** Meu time está dentro do corte (top N) agora? */
  inCut: boolean;
  /** Quantas posições faltam pro corte (se fora). null se dentro/sem time. */
  distanceToCut: number | null;
  /** ms até o corte das 19h BRT (só em qualifying). */
  msToCut: number;
  bracket: DailyKnockoutRound[];
  recentCrowns: DailyCrown[];
  todayCrown: DailyCrown | null;
  loading: boolean;
  refresh: () => void;
}

export function useDailyCycle(): DailyCycleView {
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const club = useGameStore((s) => s.club);

  const [bracket, setBracket] = useState<DailyKnockoutRound[]>([]);
  const [recentCrowns, setRecentCrowns] = useState<DailyCrown[]>([]);
  const [loading, setLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  // Relógio leve para countdown (atualiza a cada 30s).
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const phase = globalLeagueMVP?.dailyPhase ?? 'qualifying';
  const dailyKoSeasonId = globalLeagueMVP?.dailyKoSeasonId;
  const qualifyHour = globalLeagueMVP?.dailyQualifyHour ?? 19;
  const koMaxSize = globalLeagueMVP?.dailyKoMaxSize ?? 32;

  // Busca bracket (knockout/crowned) e coroas recentes.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      const [crowns, br] = await Promise.all([
        loadRecentCrowns(3),
        dailyKoSeasonId && (phase === 'knockout' || phase === 'crowned')
          ? loadDailyKnockoutFromSupabase(dailyKoSeasonId)
          : Promise.resolve([] as DailyKnockoutRound[]),
      ]);
      if (cancelled) return;
      setRecentCrowns(crowns);
      setBracket(br);
      setLoading(false);
    }
    run();
    return () => { cancelled = true; };
  }, [dailyKoSeasonId, phase, refreshTick]);

  // Re-fetch periódico do bracket enquanto há mata-mata vivo.
  useEffect(() => {
    if (phase !== 'knockout') return;
    const id = setInterval(() => setRefreshTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [phase]);

  const managerId = managerProfile?.email ?? club?.id;

  return useMemo(() => {
    const teams = globalLeagueMVP?.teams ?? [];
    const played = teams.filter((t) => (t.dailyMatchesPlayed ?? 0) > 0);
    const ranked = rankDaily(played);
    const cutSize = Math.min(largestPowerOfTwoAtMost(ranked.length), koMaxSize);

    const myTeam = managerId ? teams.find((t) => t.managerId === managerId) ?? null : null;
    const standings: DailyStandingRow[] = ranked.map((team, i) => ({
      rank: i + 1,
      team,
      isMe: !!myTeam && team.id === myTeam.id,
    }));
    const myRank = myTeam ? (standings.find((s) => s.isMe)?.rank ?? null) : null;
    const inCut = myRank != null && cutSize >= 2 && myRank <= cutSize;
    const distanceToCut =
      myRank != null && cutSize >= 2 && myRank > cutSize ? myRank - cutSize : null;

    const todayCrown = recentCrowns[0] ?? null;

    return {
      phase,
      qualifyHour,
      standings,
      cutSize,
      myTeam,
      myRank,
      inCut,
      distanceToCut,
      msToCut: msUntilBrtHour(nowMs, qualifyHour),
      bracket,
      recentCrowns,
      todayCrown,
      loading,
      refresh,
    };
  }, [globalLeagueMVP, managerId, phase, qualifyHour, koMaxSize, bracket, recentCrowns, nowMs, loading, refresh]);
}
