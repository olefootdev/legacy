import { useMemo } from 'react';
import { useGameStore } from '@/game/store';
import type { PlayerEntity } from '@/entities/types';
import type { PlayerEvolutionTimelineMap } from '@/team/playerEvolutionTimeline';
import { MEMORABLE_TROPHY_SLOTS, type MemorableTrophyId } from '@/trophies/memorableCatalog';
import type { WatchlistEntry } from './PlayerWatchlist';
import type { TrophyEntry } from './TrophyShowcase';

const SPARK_POINTS = 24;

/**
 * Conversão para OLE — temporária.
 * Hoje o campo de preço é `marketValueExp`. Quando OLE tiver feed próprio,
 * trocar apenas este helper. Fallback de BRO cents também aceito.
 */
function priceOle(p: PlayerEntity): number {
  if (typeof p.marketValueExp === 'number') return p.marketValueExp;
  if (typeof p.marketValueBroCents === 'number') return Math.floor(p.marketValueBroCents / 100);
  return 0;
}

/** Extrai série temporal de preço (em BRO cents → mantém grandeza relativa, OK pra sparkline). */
function pricesFromTimeline(
  timeline: PlayerEvolutionTimelineMap | undefined,
  playerId: string,
): number[] {
  const points = timeline?.[playerId];
  if (!points || points.length < 2) return [];
  const withPrice: number[] = [];
  for (const pt of points) {
    if (typeof pt.marketValueBroCents === 'number') withPrice.push(pt.marketValueBroCents);
  }
  return withPrice.slice(-SPARK_POINTS);
}

/** Variação % entre o primeiro e o último ponto da série. 0 se faltar histórico. */
function changeFromSpark(spark: number[]): number {
  if (spark.length < 2) return 0;
  const first = spark[0];
  const last = spark[spark.length - 1];
  if (first <= 0) return 0;
  return ((last - first) / first) * 100;
}

function ovrOf(p: PlayerEntity): number {
  const a = p.attrs;
  if (!a) return 0;
  const vals = Object.values(a) as number[];
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}

export type SquadValuationData = {
  totalOle: number;
  playerCount: number;
  highest: { name: string; position: string; valueOle: number } | null;
  /** Variação % do valor agregado do plantel — média ponderada pelo valor atual de cada jogador. */
  change24h: number;
  /** Sparkline agregada: top-5 jogadores, séries normalizadas e média posição-a-posição. */
  spark: number[];
};

/** Sparkline agregada do plantel: top-5 mais valiosos, séries normalizadas para [0,100] e mediadas. */
function buildSquadSpark(
  topPlayers: PlayerEntity[],
  timeline: PlayerEvolutionTimelineMap | undefined,
): number[] {
  const series: number[][] = [];
  for (const p of topPlayers) {
    const s = pricesFromTimeline(timeline, p.id);
    if (s.length >= 2) series.push(s);
  }
  if (series.length === 0) return [];
  const normalized = series.map((s) => {
    const min = Math.min(...s);
    const max = Math.max(...s);
    const range = max - min || 1;
    return s.map((v) => ((v - min) / range) * 100);
  });
  const maxLen = Math.max(...normalized.map((s) => s.length));
  const out: number[] = [];
  for (let i = 0; i < maxLen; i++) {
    let sum = 0;
    let count = 0;
    for (const n of normalized) {
      const idx = n.length - maxLen + i;
      if (idx >= 0) {
        sum += n[idx];
        count++;
      }
    }
    if (count > 0) out.push(sum / count);
  }
  return out;
}

/** Soma `marketValueExp` (interpretado como OLE) de todos os jogadores do plantel + destaca o mais valioso + variação real. */
export function useSquadValuation(): SquadValuationData {
  const players = useGameStore((s) => s.players);
  const timeline = useGameStore(
    (s) => (s as { playerEvolutionTimeline?: PlayerEvolutionTimelineMap }).playerEvolutionTimeline,
  );
  return useMemo(() => {
    const list = Object.values(players ?? {});
    let totalOle = 0;
    let highest: PlayerEntity | null = null;
    let highestValue = 0;
    for (const p of list) {
      const v = priceOle(p);
      totalOle += v;
      if (v > highestValue) {
        highest = p;
        highestValue = v;
      }
    }

    // change24h: média ponderada pelo preço atual.
    let weightedChange = 0;
    let totalWeight = 0;
    for (const p of list) {
      const spark = pricesFromTimeline(timeline, p.id);
      const change = changeFromSpark(spark);
      const weight = priceOle(p);
      if (weight > 0 && spark.length >= 2) {
        weightedChange += change * weight;
        totalWeight += weight;
      }
    }
    const change24h = totalWeight > 0 ? weightedChange / totalWeight : 0;

    // Spark: top-5 mais valiosos.
    const top5 = [...list].sort((a, b) => priceOle(b) - priceOle(a)).slice(0, 5);
    const spark = buildSquadSpark(top5, timeline);

    return {
      totalOle,
      playerCount: list.length,
      highest: highest
        ? { name: highest.name, position: highest.pos, valueOle: highestValue }
        : null,
      change24h,
      spark,
    };
  }, [players, timeline]);
}

/**
 * Top N jogadores do plantel ordenados por valor de mercado.
 * Substitui a watchlist mock (Saliba/Wirtz/Palmer).
 * Sparklines ainda mock — quando `playerEvolutionTimeline` for ligado, derivar real.
 */
/**
 * Lê os troféus memoráveis conquistados pelo manager (mem_liga_ole, mem_copa_ole, mem_supercopa_ole)
 * e mapeia pra TrophyEntry consumida pelo TrophyShowcase.
 *
 * Imagem: tenta `/public/trophy-{id}.png` (você dropa o PNG 3D depois);
 * se ausente, TrophyShowcase já renderiza placeholder SVG.
 */
export function useUnlockedTrophies(): TrophyEntry[] {
  const ids = useGameStore(
    (s) =>
      (s as { memorableTrophyUnlockedIds?: string[] }).memorableTrophyUnlockedIds ?? [],
  );
  return useMemo(() => {
    const season = `${new Date().getFullYear()}`;
    const out: TrophyEntry[] = [];
    for (const id of ids) {
      const slot = MEMORABLE_TROPHY_SLOTS.find((s) => s.id === (id as MemorableTrophyId));
      if (!slot) continue;
      out.push({
        id: slot.id,
        imageSrc: `/trophy-${slot.id}.png`,
        leagueName: slot.name,
        season,
        position: 'Campeão',
        note: slot.blurb,
      });
    }
    return out;
  }, [ids]);
}

export function useTopSquadPlayers(limit = 3): WatchlistEntry[] {
  const players = useGameStore((s) => s.players);
  const clubName = useGameStore((s) => s.club?.shortName ?? s.club?.name ?? 'Meu Clube');
  const timeline = useGameStore(
    (s) => (s as { playerEvolutionTimeline?: PlayerEvolutionTimelineMap }).playerEvolutionTimeline,
  );

  return useMemo(() => {
    const list = Object.values(players ?? {});
    const sorted = [...list]
      .filter((p) => priceOle(p) > 0)
      .sort((a, b) => priceOle(b) - priceOle(a))
      .slice(0, limit);

    const sparkFallback = [[0, 0]];

    return sorted.map((p, i) => {
      const realSpark = pricesFromTimeline(timeline, p.id);
      const hasReal = realSpark.length >= 2;
      return {
        id: p.id,
        name: p.name,
        position: p.pos,
        club: clubName,
        ovr: ovrOf(p),
        priceOle: priceOle(p),
        change24h: hasReal ? changeFromSpark(realSpark) : 0,
        spark: hasReal ? realSpark : sparkFallback[i % sparkFallback.length],
      };
    });
  }, [players, clubName, limit, timeline]);
}
