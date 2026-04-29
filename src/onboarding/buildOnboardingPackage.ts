import { buildDefaultLineup } from '@/entities/lineup';
import type { PlayerEntity } from '@/entities/types';
import {
  mergeGenesisRowWithSavedPlayer,
  type GenesisMarketPlayerRow,
} from '@/supabase/genesisMarket';
import { createSeededRng } from './seededRng';
import {
  draftStarterSquad,
  classifyRarity,
  type RarityTier,
} from './draftStarterSquad';
import { rollStarterExp, type StarterExpTier } from './rollStarterExp';
import { loadOnboardingPool, ONBOARDING_POOL_MIN } from './loadOnboardingPool';
import { buildFallbackOnboardingPool } from './fallbackOnboardingPool';

const WELCOME_CONTRACT_MATCHES = 70;

/** Resultado pronto pra dispatch + UI da cerimônia. */
export interface OnboardingPackage {
  /** Cards revelados na ordem [legendary, epic, rare, basic] — pra animação. */
  readonly revealOrder: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly pos: string;
    readonly tier: RarityTier;
    readonly ovr: number;
    readonly portraitUrl?: string;
  }>;
  /** Top 3 já ordenados (legendary > epic > rare). */
  readonly top3: ReadonlyArray<OnboardingPackage['revealOrder'][number]>;
  /** Tier de EXP sorteado. */
  readonly expTier: StarterExpTier;
  /** Players entity prontos pra dispatch. */
  readonly players: Record<string, PlayerEntity>;
  /** Lineup default. */
  readonly lineup: Record<string, string>;
  /** Quantidade total selecionada (deve ser 25). */
  readonly squadSize: number;
  /** Se foi usado fallback pool — admin alert. */
  readonly usedFallback: boolean;
}

function applyWelcomeContract(entity: PlayerEntity): PlayerEntity {
  return {
    ...entity,
    contractIsLifetime: false,
    contractExpired: false,
    contractMatchesRemaining: WELCOME_CONTRACT_MATCHES,
    contractMatchesIncluded: WELCOME_CONTRACT_MATCHES,
    listedOnMarket: false,
  };
}

function newSeed(): number {
  // 32-bit aleatório, evitando 0 (xorshift trava).
  const r = Math.floor(Math.random() * 0xffffffff) | 0;
  return r === 0 ? 1 : r;
}

/**
 * Carrega pool, sorteia 25 jogadores + EXP, monta `OnboardingPackage`.
 * NÃO dispara dispatch — caller controla quando aplicar (no final da cerimônia).
 *
 * Retorna `null` se nem o Supabase nem o fallback geraram pool válido — caso
 * extremo que quase nunca acontece (apenas se o build do fallback estiver bugado).
 */
export async function buildOnboardingPackage(): Promise<OnboardingPackage | null> {
  let pool = await loadOnboardingPool();
  let usedFallback = false;
  if (!pool || pool.length < ONBOARDING_POOL_MIN) {
    pool = buildFallbackOnboardingPool();
    usedFallback = true;
  }

  const seed = newSeed();
  const rng = createSeededRng(seed);
  const draft = draftStarterSquad(pool, rng);
  if (!draft) return null;

  const expTier = rollStarterExp(rng);

  // Reveal order: do basic (rodapé) ao legendary (clímax).
  const tierOrder: RarityTier[] = ['basic', 'rare', 'epic', 'legendary'];
  const revealRows: GenesisMarketPlayerRow[] = [];
  for (const t of tierOrder) revealRows.push(...draft.byTier[t]);

  const players: Record<string, PlayerEntity> = {};
  const previewByRowId = new Map<string, OnboardingPackage['revealOrder'][number]>();
  for (const row of draft.selected) {
    const pid = `genesis-${row.id}`;
    const entity = applyWelcomeContract(mergeGenesisRowWithSavedPlayer(row, undefined));
    players[pid] = entity;
    previewByRowId.set(row.id, {
      id: pid,
      name: entity.name,
      pos: entity.pos,
      tier: classifyRarity(row.rarity_label),
      ovr: entity.mintOverall ?? 70,
      portraitUrl: entity.portraitUrl,
    });
  }

  const revealOrder = revealRows
    .map((r) => previewByRowId.get(r.id))
    .filter((x): x is OnboardingPackage['revealOrder'][number] => x != null);

  const top3 = draft.top3
    .map((r) => previewByRowId.get(r.id))
    .filter((x): x is OnboardingPackage['revealOrder'][number] => x != null);

  const lineup = buildDefaultLineup(players);

  return {
    revealOrder,
    top3,
    expTier,
    players,
    lineup,
    squadSize: draft.selected.length,
    usedFallback,
  };
}
