import type { LiveMatchSnapshot } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';

/** Jogos de contrato padrão do catálogo Genesis (amistosos + oficiais). */
export const GENESIS_CATALOG_DEFAULT_MATCHES = 70;

/** Opções de duração (jogos) para talentos criados pelo manager na Academia OLE. */
export const MANAGER_PROSPECT_CONTRACT_GAMES = [10, 70, 150, 250] as const;
export type ManagerProspectContractGames = (typeof MANAGER_PROSPECT_CONTRACT_GAMES)[number];

/**
 * Prémio em EXP pelo tempo de contrato vs. base 10 jogos (soma ao custo base da Academia).
 * Valores calibrados para cobrar mais por contratos mais longos.
 */
export const MANAGER_CONTRACT_PREMIUM_EXP: Record<ManagerProspectContractGames, number> = {
  10: 0,
  70: 120_000,
  150: 320_000,
  250: 520_000,
};

export function managerProspectContractPremiumExp(tier: ManagerProspectContractGames): number {
  return MANAGER_CONTRACT_PREMIUM_EXP[tier] ?? 0;
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

/** Saves antigos: Genesis sem campos de contrato → 70 jogos + id de catálogo. */
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
