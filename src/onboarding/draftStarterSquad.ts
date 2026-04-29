import type { SeededRng } from './seededRng';

/**
 * Sorteio inicial de plantel (25 jogadores) com cota por raridade.
 *
 * Cotas confirmadas em product review:
 *   15 basic + 6 rare + 3 epic + 1 legendary = 25.
 *
 * Restrição posicional: garante pelo menos 2 GOL no plantel sorteado
 * (titular + reserva).
 *
 * Se o pool de uma raridade for menor que a cota, o algoritmo "downgrade"
 * pega da raridade imediatamente inferior. Se nem assim atingir 25, retorna
 * `null` — o caller decide fallback (mensagem + retry online).
 */
export type RarityTier = 'basic' | 'rare' | 'epic' | 'legendary';

export const STARTER_SQUAD_SIZE = 25;
export const STARTER_MIN_GOL = 2;

export const STARTER_RARITY_QUOTA: Record<RarityTier, number> = {
  basic: 15,
  rare: 6,
  epic: 3,
  legendary: 1,
};

/**
 * Mapeia rótulos do catálogo Genesis (`rarity_label`) para tier abstrato.
 * Mantém compatibilidade com `genesisRarityLabelToPlayerRarity` em
 * `src/supabase/genesisMarket.ts` — os mesmos rótulos são reconhecidos.
 */
export function classifyRarity(label: string | null | undefined): RarityTier {
  const u = (label ?? '').trim().toLowerCase();
  switch (u) {
    case 'epic':
    case 'legend':
    case 'legendary':
    case 'ultra rare':
    case 'ultra_rare':
    case 'mythic':
    case 'mitico':
      return 'legendary';
    case 'gold':
    case 'ouro':
    case 'retro':
    case 'classic':
    case 'next':
    case 'epico':
    case 'champion':
      return 'epic';
    case 'rare':
    case 'raro':
    case 'silver':
    case 'prata':
    case 'premium':
      return 'rare';
    case 'basic':
    case 'normal':
    case 'bronze':
    case 'academy':
    case '':
    default:
      return 'basic';
  }
}

const TIER_ORDER: RarityTier[] = ['legendary', 'epic', 'rare', 'basic'];

/** Linha mínima necessária para sortear. Tipo amplo intencional — qualquer
 * objeto com `id`, `pos` e `rarity_label` serve (Genesis row, mock, etc). */
export interface DraftablePlayerRow {
  id: string;
  pos: string | null | undefined;
  rarity_label?: string | null;
}

export interface DraftStarterSquadResult<T extends DraftablePlayerRow> {
  selected: T[];
  byTier: Record<RarityTier, T[]>;
  /** Top 3 por raridade (legendary > epic > rare > basic) — usado no reveal. */
  top3: T[];
}

function isGoalkeeper(pos: string | null | undefined): boolean {
  const u = (pos ?? '').trim().toUpperCase();
  return u === 'GOL' || u === 'GK' || u === 'GOLEIRO';
}

function tierRank(tier: RarityTier): number {
  // Maior raridade = maior rank — usado para ordenar top 3.
  switch (tier) {
    case 'legendary': return 3;
    case 'epic': return 2;
    case 'rare': return 1;
    case 'basic': return 0;
  }
}

/**
 * Seleciona N entradas aleatórias de uma lista usando o RNG fornecido.
 * Não modifica o array de entrada.
 */
function pickN<T>(rng: SeededRng, pool: ReadonlyArray<T>, n: number): T[] {
  if (n <= 0) return [];
  const copy = [...pool];
  rng.shuffleInPlace(copy);
  return copy.slice(0, n);
}

export function draftStarterSquad<T extends DraftablePlayerRow>(
  pool: ReadonlyArray<T>,
  rng: SeededRng,
): DraftStarterSquadResult<T> | null {
  if (pool.length < STARTER_SQUAD_SIZE) return null;

  // Particiona o pool por tier.
  const byTierPool: Record<RarityTier, T[]> = {
    basic: [],
    rare: [],
    epic: [],
    legendary: [],
  };
  for (const row of pool) {
    byTierPool[classifyRarity(row.rarity_label)].push(row);
  }

  // Sorteia respeitando a cota; se faltar, pega do tier abaixo (downgrade).
  const used = new Set<string>();
  const byTier: Record<RarityTier, T[]> = {
    basic: [],
    rare: [],
    epic: [],
    legendary: [],
  };

  const drawFromTier = (tier: RarityTier, want: number): number => {
    if (want <= 0) return 0;
    const available = byTierPool[tier].filter((r) => !used.has(r.id));
    const taken = pickN(rng, available, Math.min(want, available.length));
    for (const r of taken) {
      used.add(r.id);
      byTier[tier].push(r);
    }
    return taken.length;
  };

  // Passa de cima pra baixo: tenta cota original; se faltou, transfere o débito
  // pra próxima iteração (pool inferior).
  let debt = 0;
  for (const tier of TIER_ORDER) {
    const want = STARTER_RARITY_QUOTA[tier] + debt;
    const got = drawFromTier(tier, want);
    debt = want - got;
  }

  // Se ainda faltam (pool global insuficiente), abortar.
  if (debt > 0) return null;

  let selected: T[] = [
    ...byTier.legendary,
    ...byTier.epic,
    ...byTier.rare,
    ...byTier.basic,
  ];
  if (selected.length !== STARTER_SQUAD_SIZE) return null;

  // Garantia de goleiros: se temos < STARTER_MIN_GOL, troca jogadores comuns
  // (basic) por GOLs disponíveis no pool não-usado.
  const golCount = selected.filter((r) => isGoalkeeper(r.pos)).length;
  if (golCount < STARTER_MIN_GOL) {
    const needGol = STARTER_MIN_GOL - golCount;
    const golCandidates = pool.filter(
      (r) => !used.has(r.id) && isGoalkeeper(r.pos),
    );
    const chosenGol = pickN(rng, golCandidates, Math.min(needGol, golCandidates.length));
    if (chosenGol.length === needGol) {
      // Remove `needGol` basics não-goleiros (mantém raridades altas) para
      // ceder slots aos goleiros novos.
      const removableIdxs: number[] = [];
      for (let i = selected.length - 1; i >= 0 && removableIdxs.length < needGol; i--) {
        const cand = selected[i]!;
        if (
          classifyRarity(cand.rarity_label) === 'basic' &&
          !isGoalkeeper(cand.pos)
        ) {
          removableIdxs.push(i);
        }
      }
      if (removableIdxs.length === needGol) {
        for (const idx of removableIdxs) {
          const removed = selected[idx]!;
          used.delete(removed.id);
          byTier.basic = byTier.basic.filter((r) => r.id !== removed.id);
          selected.splice(idx, 1);
        }
        for (const g of chosenGol) {
          used.add(g.id);
          const t = classifyRarity(g.rarity_label);
          byTier[t].push(g);
          selected.push(g);
        }
      }
    }
    // Se mesmo assim não conseguiu (pool sem goleiros), seguimos com o que tem
    // — UX downstream pode avisar, mas não bloqueamos onboarding.
  }

  // Top 3 por raridade (mais alta primeiro). Empate desempatado por sorteio.
  const sortedByRarity = [...selected].sort((a, b) => {
    const r = tierRank(classifyRarity(b.rarity_label)) - tierRank(classifyRarity(a.rarity_label));
    if (r !== 0) return r;
    return rng.next() - 0.5;
  });
  const top3 = sortedByRarity.slice(0, 3);

  return { selected, byTier, top3 };
}
