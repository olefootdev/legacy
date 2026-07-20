/**
 * Monta o elenco adversário de cada fase do LEGENDS CUP.
 *
 * REGRA (fundador): entra o MELHOR card das 3 fases de cada lenda. Guardamos a
 * escolha por `collection_id`, não por id de card — assim, quando uma lenda
 * ganhar uma fase nova ou um card mais forte, o time do Cup acompanha sozinho.
 *
 * As lendas não cobrem 11 posições (no Playoff são 2 atacantes, 1 meia e 1
 * lateral — sem goleiro e sem zaga). O resto é preenchido com Genesis, e o
 * preenchimento é DETERMINÍSTICO por seed: a mesma campanha enfrenta sempre o
 * mesmo time, senão o manager recarrega a página até cair um adversário fraco.
 */
import type { PlayerEntity, OpponentStub } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';
import {
  fetchListedLegacyPlayerRows,
  legacyRowToPlayerEntity,
  type LegacyPlayerRow,
} from '@/supabase/legacyPlayers';
import {
  fetchGenesisMarketPlayerRowsOrdered,
  genesisRowToPlayerEntity,
} from '@/supabase/genesisMarket';
import {
  LEGENDS_CUP_SQUADS,
  LEGENDS_CUP_OPPONENT_NAME,
  SQUAD_SIZE,
  roundOf,
} from './legendsCupModel';

/** Formação-alvo: quantos de cada posição um time precisa ter. */
const TARGET_SHAPE: Array<{ pos: string; count: number }> = [
  { pos: 'GOL', count: 1 },
  { pos: 'ZAG', count: 2 },
  { pos: 'LD', count: 1 },
  { pos: 'LE', count: 1 },
  { pos: 'VOL', count: 2 },
  { pos: 'MEI', count: 1 },
  { pos: 'PD', count: 1 },
  { pos: 'ATA', count: 2 },
];

function rngFor(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * O melhor card (maior OVR) de cada coleção presente no mercado.
 *
 * O OVR não vem cru da row — é `legacyRowToPlayerEntity` quem o calcula, já
 * ponderado POR POSIÇÃO. Comparar por outro caminho traria de volta o bug em
 * que zagueiro parecia mais fraco que atacante mediano.
 */
export function bestCardPerCollection(rows: LegacyPlayerRow[]): Map<string, PlayerEntity> {
  const best = new Map<string, PlayerEntity>();
  const bestOvr = new Map<string, number>();
  for (const r of rows) {
    const col = r.collection_id;
    if (!col) continue;
    const entity = legacyRowToPlayerEntity(r);
    const ovr = overallFromAttributes(entity.attrs, entity.pos);
    if (ovr > (bestOvr.get(col) ?? -1)) {
      bestOvr.set(col, ovr);
      best.set(col, entity);
    }
  }
  return best;
}

export interface LegendsCupOpponent {
  stub: OpponentStub;
  /** As lendas que entram em campo nesta fase — usado na tela de "quem você enfrenta". */
  legends: PlayerEntity[];
}

/**
 * Monta o adversário da fase. Sem lenda (Classificatória) devolve um time só de
 * Genesis; com lenda, as lendas ocupam as posições delas e o Genesis completa.
 */
export async function buildLegendsCupOpponent(
  roundIndex: number,
  seed: string,
): Promise<LegendsCupOpponent> {
  const round = roundOf(roundIndex);
  const collections = LEGENDS_CUP_SQUADS[round];
  const rnd = rngFor(`${seed}:${round}`);

  const [legacyRows, genesisRows] = await Promise.all([
    collections ? fetchListedLegacyPlayerRows() : Promise.resolve([] as LegacyPlayerRow[]),
    fetchGenesisMarketPlayerRowsOrdered(),
  ]);

  // 1. Lendas da fase (melhor card de cada coleção pedida).
  const legends: PlayerEntity[] = [];
  if (collections) {
    const best = bestCardPerCollection(legacyRows);
    for (const col of collections) {
      const card = best.get(col);
      if (card) legends.push(card);
    }
  }

  // 2. Genesis preenche o que falta, respeitando a formação-alvo.
  const need = new Map(TARGET_SHAPE.map((t) => [t.pos, t.count]));
  for (const l of legends) {
    const p = (l.pos ?? '').toUpperCase();
    if (need.has(p)) need.set(p, Math.max(0, (need.get(p) ?? 0) - 1));
  }

  const pool = [...genesisRows].sort(() => rnd() - 0.5).map(genesisRowToPlayerEntity);
  const used = new Set<string>();
  const fill: PlayerEntity[] = [];

  for (const [pos, count] of need) {
    for (let i = 0; i < count; i += 1) {
      const pick =
        pool.find((g) => !used.has(g.id) && (g.pos ?? '').toUpperCase() === pos) ??
        pool.find((g) => !used.has(g.id));
      if (!pick) continue;
      used.add(pick.id);
      fill.push(pick);
    }
  }
  // Se a formação-alvo não fechou 11 (catálogo Genesis curto), completa com quem sobrou.
  while (legends.length + fill.length < SQUAD_SIZE) {
    const extra = pool.find((g) => !used.has(g.id));
    if (!extra) break;
    used.add(extra.id);
    fill.push(extra);
  }

  const squad = [...legends, ...fill].slice(0, SQUAD_SIZE);
  const strength = squad.length
    ? Math.round(squad.reduce((s, p) => s + overallFromAttributes(p.attrs, p.pos), 0) / squad.length)
    : 70;

  const star = [...squad].sort(
    (a, b) => overallFromAttributes(b.attrs, b.pos) - overallFromAttributes(a.attrs, a.pos),
  )[0];

  const name = LEGENDS_CUP_OPPONENT_NAME[round];
  return {
    legends,
    stub: {
      id: `legendscup-${round.toLowerCase().replace(/[^a-z]/g, '')}`,
      name,
      shortName: name.slice(0, 3).toUpperCase(),
      strength,
      genesisAwayPlayers: squad,
      formationScheme: '4-3-3',
      ...(star
        ? { highlightPlayer: { name: star.name, ovr: overallFromAttributes(star.attrs, star.pos) } }
        : {}),
    },
  };
}
