import type { LiveMatchSnapshot } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';

/** Jogos de contrato padrão do catálogo Genesis (amistosos + oficiais). */
export const GENESIS_CATALOG_DEFAULT_MATCHES = 250;

/** Baseline de contrato aplicado em rehydrate a todos os jogadores não-vitalícios. */
export const CONTRACT_BASELINE_GAMES = 250;

/** Opções de duração (jogos) — interação diária forçada via tier curto. */
export const MANAGER_PROSPECT_CONTRACT_GAMES = [50, 250, 500, 1000] as const;
export type ManagerProspectContractGames = (typeof MANAGER_PROSPECT_CONTRACT_GAMES)[number];

/** Set de validação (idempotência da migração). */
export const VALID_CONTRACT_TIERS = new Set<number>([50, 250, 500, 1000]);

/**
 * Prémio em EXP pelo tempo de contrato vs. base 50 jogos.
 * Calibrado para cobrar mais por contratos mais longos.
 */
export const MANAGER_CONTRACT_PREMIUM_EXP: Record<ManagerProspectContractGames, number> = {
  50: 0,
  250: 180_000,
  500: 420_000,
  1000: 900_000,
};

export function managerProspectContractPremiumExp(tier: ManagerProspectContractGames): number {
  return MANAGER_CONTRACT_PREMIUM_EXP[tier] ?? 0;
}

/**
 * Conversão EXP → OLEFOOT pra renovação contratual.
 *
 * 1 OLEFOOT = 100 EXP equivalente. Calibrado pra:
 *  - Tier 50  (5 OLEFOOT)       — acessível, força interação frequente.
 *  - Tier 250 (~1.805 OLEFOOT)  — mid game.
 *  - Tier 500 (~4.205 OLEFOOT)  — investimento.
 *  - Tier 1000 (~9.005 OLEFOOT) — long-term commitment.
 *
 * Ajustar EXP_PER_OLEFOOT_FOR_RENEWAL pra recalibrar quando OLEFOOT for listada.
 */
export const EXP_PER_OLEFOOT_FOR_RENEWAL = 100;

export function expCostToOlefoot(expCost: number): number {
  if (!Number.isFinite(expCost) || expCost <= 0) return 0;
  return Math.ceil(expCost / EXP_PER_OLEFOOT_FOR_RENEWAL);
}

/**
 * Preço de listagem Genesis em EXP (250k–1M), alinhado ao mint OVR.
 * Escala linear entre OVR 24 e 72 (faixa típica do catálogo), arredondada a 5k EXP.
 */
export function genesisListingPriceExpFromMintOverall(mintOverall: number | null | undefined): number {
  const o = mintOverall != null && Number.isFinite(mintOverall) ? Math.round(mintOverall) : 30;
  const t = (Math.max(24, Math.min(72, o)) - 24) / 48;
  const raw = 250_000 + Math.round(t * (1_000_000 - 250_000));
  return Math.round(raw / 5000) * 5000;
}

export function genesisCatalogIdFromPlayerId(playerId: string): string | undefined {
  if (!playerId.startsWith('genesis-')) return undefined;
  return playerId.slice('genesis-'.length);
}

export type GenesisContractRow = {
  contract_matches_included?: number | null;
  contract_is_lifetime?: boolean | null;
};

/** Campos de contrato ao instanciar jogador a partir do catálogo Supabase. */
export function contractFieldsFromGenesisCatalogRow(
  row: GenesisContractRow & { id: string },
): Pick<PlayerEntity, 'contractMatchesRemaining' | 'contractMatchesIncluded' | 'contractIsLifetime' | 'contractExpired' | 'genesisCatalogId'> {
  if (row.contract_is_lifetime === true) {
    return {
      contractIsLifetime: true,
      contractExpired: false,
      genesisCatalogId: row.id,
    };
  }
  const n = Math.max(1, Math.round(Number(row.contract_matches_included) || GENESIS_CATALOG_DEFAULT_MATCHES));
  return {
    contractMatchesRemaining: n,
    contractMatchesIncluded: n,
    contractIsLifetime: false,
    contractExpired: false,
    genesisCatalogId: row.id,
  };
}

export function contractFieldsForManagerProspectTier(
  tier: ManagerProspectContractGames,
): Pick<PlayerEntity, 'contractMatchesRemaining' | 'contractMatchesIncluded' | 'contractIsLifetime' | 'contractExpired'> {
  return {
    contractMatchesRemaining: tier,
    contractMatchesIncluded: tier,
    contractIsLifetime: false,
    contractExpired: false,
  };
}

export function contractFieldsAdminLifetime(): Pick<
  PlayerEntity,
  'contractMatchesRemaining' | 'contractMatchesIncluded' | 'contractIsLifetime' | 'contractExpired'
> {
  return {
    contractIsLifetime: true,
    contractExpired: false,
  };
}

/** Conta 1 jogo de contrato por jogador da casa presente em `homeStats` (ou em campo). */
export function applyHomeContractsAfterMatch(
  players: Record<string, PlayerEntity>,
  liveMatch: LiveMatchSnapshot,
): Record<string, PlayerEntity> {
  const statIds = Object.keys(liveMatch.homeStats ?? {});
  const ids =
    statIds.length > 0
      ? statIds
      : [...new Set((liveMatch.homePlayers ?? []).map((h) => h.playerId).filter(Boolean))];
  if (ids.length === 0) return players;

  const next = { ...players };
  for (const pid of ids) {
    const p = next[pid];
    if (!p || p.contractIsLifetime === true) continue;
    if (p.contractMatchesRemaining == null) continue;

    const rem = Math.max(0, p.contractMatchesRemaining - 1);
    next[pid] = {
      ...p,
      contractMatchesRemaining: rem,
      contractExpired: rem === 0 ? true : p.contractExpired === true,
    };
  }
  return next;
}

/** Saves antigos: Genesis sem campos de contrato → default + id de catálogo. */
export function hydrateLegacyGenesisContract(player: PlayerEntity): PlayerEntity {
  if (player.contractIsLifetime) return player;
  if (player.contractMatchesRemaining != null || player.contractExpired) return player;
  const cat = genesisCatalogIdFromPlayerId(player.id);
  if (!cat) return player;
  return {
    ...player,
    contractMatchesRemaining: GENESIS_CATALOG_DEFAULT_MATCHES,
    contractMatchesIncluded: GENESIS_CATALOG_DEFAULT_MATCHES,
    genesisCatalogId: cat,
    contractExpired: false,
  };
}

/**
 * Migração one-time: garante que todo jogador não-vitalício esteja num tier válido
 * (50/250/500/1000). Quem está fora do set é resetado para o baseline (250).
 *
 * Idempotente: chamadas subsequentes que já têm tier válido são no-op.
 * Vitalícios são preservados.
 */
export function migrateContractToBaseline250(player: PlayerEntity): PlayerEntity {
  if (player.contractIsLifetime === true) return player;
  const included = player.contractMatchesIncluded;
  if (typeof included === 'number' && VALID_CONTRACT_TIERS.has(included) && player.contractMatchesRemaining != null) {
    return player;
  }
  return {
    ...player,
    contractMatchesRemaining: CONTRACT_BASELINE_GAMES,
    contractMatchesIncluded: CONTRACT_BASELINE_GAMES,
    contractIsLifetime: false,
    contractExpired: false,
  };
}
