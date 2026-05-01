import { getSupabase } from '@/supabase/client';
import { createPlayer, overallFromAttributes } from '@/entities/player';
import type {
  PlayerArchetype,
  PlayerAttributes,
  PlayerBehavior,
  PlayerCreatorType,
  PlayerEntity,
  PlayerRarity,
  PlayerStrongFoot,
  TacticalZone,
} from '@/entities/types';
import type { MockAuctionPlayer } from '@/transfer/mockAuctionPlayer';
import {
  contractFieldsFromGenesisCatalogRow,
  genesisListingPriceExpFromMintOverall,
} from '@/playerContracts/playerContracts';

const GENESIS_CARD_ID_BASE = 7_000_000;

function supabasePublicUrl(): string | undefined {
  const raw = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const u = raw?.trim();
  return u ? u.replace(/\/$/, '') : undefined;
}

function cacheBuster(updatedAt?: string | null): string {
  if (updatedAt) return `?v=${new Date(updatedAt).getTime() || Date.now()}`;
  return '';
}

export function genesisPortraitImageUrl(row: {
  portrait_public_url?: string | null;
  portrait_storage_path?: string | null;
  updated_at?: string | null;
}): string | undefined {
  const direct = row.portrait_public_url?.trim();
  if (direct) return direct;
  const path = row.portrait_storage_path?.trim();
  if (!path) return undefined;
  const base = supabasePublicUrl();
  if (!base) return undefined;
  return `${base}/storage/v1/object/public/genesis-player-portraits/${path.replace(/^\//, '')}${cacheBuster(row.updated_at)}`;
}

export function genesisTokenImageUrl(row: {
  portrait_token_public_url?: string | null;
  portrait_storage_path?: string | null;
  updated_at?: string | null;
}): string | undefined {
  const tokenDirect = row.portrait_token_public_url?.trim();
  if (tokenDirect) return tokenDirect;
  const cardPath = row.portrait_storage_path?.trim();
  if (!cardPath) return undefined;
  const base = supabasePublicUrl();
  if (!base) return undefined;
  const tokenPath = cardPath.replace(/-card\./, '-token.');
  if (tokenPath === cardPath) return undefined;
  return `${base}/storage/v1/object/public/genesis-player-portraits/${tokenPath.replace(/^\//, '')}${cacheBuster(row.updated_at)}`;
}

export type GenesisMarketPlayerRow = {
  id: string;
  kit_number: number;
  name: string;
  pos: string;
  pos_original: string | null;
  archetype: string;
  zone: string;
  behavior: string;
  attributes: Record<string, number>;
  fatigue: number;
  injury_risk: number;
  evolution_xp: number;
  out_for_matches: number;
  market_value_bro_cents: number;
  /** Valor de mercado em EXP (substitui `market_value_bro_cents` na UI e na entidade). */
  market_value_exp?: number;
  price_bro_cents: number;
  /** Preço de compra em EXP (substitui uso de `price_bro_cents` na UI). */
  price_exp?: number;
  contract_matches_included?: number;
  contract_is_lifetime?: boolean;
  country: string | null;
  age: number | null;
  strong_foot: string | null;
  creator_label: string | null;
  rarity_label: string | null;
  bio: string | null;
  listed_on_market: boolean;
  admin_market_tag: string | null;
  mint_overall: number | null;
  evolution_rate: number | null;
  collection_id: string | null;
  card_supply: number | null;
  spirit_notes: string | null;
  portrait_storage_path: string | null;
  portrait_public_url: string | null;
  portrait_token_public_url: string | null;
  portrait_media_refs: Record<string, unknown> | null;
  updated_at: string | null;
};

function attrsFromRow(attributes: Record<string, unknown> | null | undefined): PlayerAttributes {
  const a = attributes && typeof attributes === 'object' ? attributes : {};
  const num = (k: keyof PlayerAttributes, d: number) => {
    const v = a[k as string];
    return typeof v === 'number' && Number.isFinite(v) ? v : d;
  };
  return {
    passe: num('passe', 70),
    marcacao: num('marcacao', 70),
    velocidade: num('velocidade', 70),
    drible: num('drible', 70),
    finalizacao: num('finalizacao', 70),
    fisico: num('fisico', 70),
    tatico: num('tatico', 70),
    mentalidade: num('mentalidade', 70),
    confianca: num('confianca', 70),
    fairPlay: num('fairPlay', 70),
  };
}

const GENESIS_ARCHETYPE: Record<string, PlayerArchetype> = {
  profissional: 'profissional',
  novo_talento: 'novo_talento',
  lenda: 'lenda',
  meme: 'meme',
  ai_plus: 'ai_plus',
};

const GENESIS_ZONE: Record<string, TacticalZone> = {
  defesa: 'defesa',
  meio: 'meio',
  ataque: 'ataque',
  lateral_esq: 'lateral_esq',
  lateral_dir: 'lateral_dir',
  gol: 'gol',
};

const GENESIS_BEHAVIOR: Record<string, PlayerBehavior> = {
  equilibrado: 'equilibrado',
  ofensivo: 'ofensivo',
  defensivo: 'defensivo',
  criativo: 'criativo',
};

function genesisRarityLabelToPlayerRarity(label: string | null | undefined): PlayerRarity | undefined {
  if (!label?.trim()) return undefined;
  const u = label.trim().toLowerCase();
  const map: Record<string, PlayerRarity> = {
    basic: 'normal',
    rare: 'raro',
    'ultra rare': 'ultra_raro',
    silver: 'prata',
    gold: 'ouro',
    retro: 'epico',
    academy: 'normal',
    legend: 'epico',
    classic: 'premium',
    next: 'premium',
    epic: 'epico',
  };
  return map[u] ?? 'normal';
}

function genesisCreatorLabelToType(label: string | null | undefined): PlayerCreatorType | undefined {
  const t = label?.trim().toLowerCase();
  if (!t) return undefined;
  if (t === 'genesis') return 'olefoot';
  if (t === 'campeao') return 'campeao';
  if (t === 'amador') return 'amador';
  if (t === 'lenda') return 'lenda';
  if (t === 'novo_talento' || t === 'novo talento') return 'novo_talento';
  return 'olefoot';
}

/**
 * Atributos e metadados vêm do Supabase; conserva progressão local (fadiga, XP, lesão)
 * quando o id coincide.
 */
export function mergeGenesisRowWithSavedPlayer(
  row: GenesisMarketPlayerRow,
  saved: PlayerEntity | undefined,
): PlayerEntity {
  const fresh = genesisRowToPlayerEntity(row);
  if (!saved || saved.id !== fresh.id) return fresh;
  return {
    ...fresh,
    fatigue: saved.fatigue,
    injuryRisk: saved.injuryRisk,
    evolutionXp: saved.evolutionXp,
    outForMatches: saved.outForMatches,
    contractMatchesRemaining: saved.contractMatchesRemaining ?? fresh.contractMatchesRemaining,
    contractMatchesIncluded: saved.contractMatchesIncluded ?? fresh.contractMatchesIncluded,
    contractIsLifetime: saved.contractIsLifetime ?? fresh.contractIsLifetime,
    contractExpired: saved.contractExpired ?? fresh.contractExpired,
    genesisCatalogId: saved.genesisCatalogId ?? fresh.genesisCatalogId,
    // Admin market controls sempre vêm do Supabase (fresh), não do save local
    listedOnMarket: fresh.listedOnMarket,
    adminMarketTag: fresh.adminMarketTag,
  };
}

/** Converte uma linha do catálogo em entidade de jogo (motor + GameSpirit). */
export function genesisRowToPlayerEntity(row: GenesisMarketPlayerRow): PlayerEntity {
  const attrs = attrsFromRow(row.attributes);
  const archRaw = row.archetype?.trim().toLowerCase() ?? '';
  const archetype = GENESIS_ARCHETYPE[archRaw] ?? 'profissional';
  const zone = GENESIS_ZONE[row.zone?.trim().toLowerCase() ?? ''] ?? undefined;
  const behavior = GENESIS_BEHAVIOR[row.behavior?.trim().toLowerCase() ?? ''] ?? 'equilibrado';
  const sf = row.strong_foot?.trim().toLowerCase();
  const strongFoot: PlayerStrongFoot | undefined =
    sf === 'right' || sf === 'left' || sf === 'both' ? sf : undefined;
  const portraitUrl = genesisPortraitImageUrl(row);
  const portraitTokenUrl = genesisTokenImageUrl(row);
  const evo =
    row.evolution_rate != null && Number.isFinite(row.evolution_rate)
      ? Number(row.evolution_rate) / 100
      : undefined;
  const contract = contractFieldsFromGenesisCatalogRow(row);
  const mintOvr =
    row.mint_overall != null && Number.isFinite(row.mint_overall) ? Math.round(row.mint_overall) : undefined;
  const ovrForPricing = mintOvr ?? overallFromAttributes(attrs);
  const marketExp =
    row.market_value_exp != null && Number.isFinite(row.market_value_exp) && row.market_value_exp > 0
      ? Math.round(row.market_value_exp)
      : genesisListingPriceExpFromMintOverall(ovrForPricing);
  return createPlayer({
    id: `genesis-${row.id}`,
    num: row.kit_number,
    name: row.name.trim(),
    pos: row.pos.trim(),
    zone,
    archetype,
    behavior,
    attrs,
    fatigue: row.fatigue,
    injuryRisk: row.injury_risk,
    evolutionXp: row.evolution_xp,
    outForMatches: row.out_for_matches,
    portraitUrl,
    portraitTokenUrl,
    marketValueExp: marketExp,
    country: row.country?.trim() || undefined,
    strongFoot,
    creatorType: genesisCreatorLabelToType(row.creator_label),
    rarity: genesisRarityLabelToPlayerRarity(row.rarity_label),
    collectionId: row.collection_id?.trim() || undefined,
    cardSupply: row.card_supply != null && Number.isFinite(row.card_supply) ? Math.floor(row.card_supply) : undefined,
    bio: row.bio?.trim() || undefined,
    listedOnMarket: row.listed_on_market === true,
    adminMarketTag: (row as any).admin_market_tag?.trim() || undefined,
    age: row.age != null && Number.isFinite(row.age) ? Math.round(row.age) : undefined,
    mintOverall: mintOvr,
    evolutionRate: evo,
    ...contract,
  });
}

/**
 * Divide o catálogo em dois plantéis com goleiros em ambos (metade dos GOL + metade do campo cada).
 */
export function splitGenesisRowsIntoTwoBalancedSquads(rows: GenesisMarketPlayerRow[]): {
  homeRows: GenesisMarketPlayerRow[];
  awayRows: GenesisMarketPlayerRow[];
} {
  const sorted = [...rows].sort((a, b) => a.kit_number - b.kit_number);
  const gks = sorted.filter((r) => r.pos?.toUpperCase() === 'GOL');
  const field = sorted.filter((r) => r.pos?.toUpperCase() !== 'GOL');
  const halfGk = Math.ceil(gks.length / 2) || 0;
  const homeG = gks.slice(0, halfGk);
  const awayG = gks.slice(halfGk);
  const halfField = Math.floor(field.length / 2);
  const homeF = field.slice(0, halfField);
  const awayF = field.slice(halfField);
  return { homeRows: [...homeF, ...homeG], awayRows: [...awayF, ...awayG] };
}

export async function fetchGenesisMarketPlayerRowsOrdered(): Promise<GenesisMarketPlayerRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('genesis_market_players')
    .select('*')
    .order('kit_number', { ascending: true });
  if (error) {
    console.warn('[genesisMarket] fetch rows:', error.message);
    return [];
  }
  return (data ?? []) as GenesisMarketPlayerRow[];
}

export function genesisRowToAuctionCard(row: GenesisMarketPlayerRow, ordinal: number): MockAuctionPlayer {
  const attrs = attrsFromRow(row.attributes);
  const ovr =
    row.mint_overall != null && Number.isFinite(row.mint_overall)
      ? Math.round(row.mint_overall)
      : overallFromAttributes(attrs);
  const style = ovr >= 68 ? 'white' : ovr >= 60 ? 'neon-yellow' : 'gray-400';
  const category: MockAuctionPlayer['category'] = ovr >= 70 ? 'gold' : ovr >= 65 ? 'silver' : 'bronze';
  const ageLabel = row.age != null ? String(row.age) : '—';
  const priceExp =
    row.price_exp != null && Number.isFinite(row.price_exp) && row.price_exp > 0
      ? Math.round(row.price_exp)
      : genesisListingPriceExpFromMintOverall(ovr);
  const portraitSrc = genesisPortraitImageUrl(row);
  return {
    id: GENESIS_CARD_ID_BASE + ordinal,
    name: row.name,
    pos: row.pos,
    nat: row.country?.trim() || '—',
    ovr,
    style,
    category,
    pac: attrs.velocidade,
    sho: attrs.finalizacao,
    pas: attrs.passe,
    dri: attrs.drible,
    def: attrs.marcacao,
    phy: attrs.fisico,
    auctionCurrency: 'EXP',
    currentBid: priceExp,
    buyNow: priceExp,
    timeLeft: '23:59:59',
    history: [{ year: ageLabel, club: 'Genesis OLE', apps: 0, goals: 0 }],
    bio: (row.bio ?? '').trim().slice(0, 250) || 'Carta oficial OLEFOOT Genesis.',
    marketKind: 'genesis',
    genesisCatalogId: row.id,
    portraitSrc,
    mintOverall: ovr,
    listingPriceExp: priceExp,
  };
}

export async function fetchGenesisMarketAuctionCards(): Promise<MockAuctionPlayer[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('genesis_market_players')
    .select('*')
    .eq('listed_on_market', true)
    .order('mint_overall', { ascending: false, nullsFirst: false });
  if (error) {
    console.warn('[genesisMarket] fetch:', error.message);
    return [];
  }
  const rows = (data ?? []) as GenesisMarketPlayerRow[];
  return rows.map((r, i) => genesisRowToAuctionCard(r, i));
}

/** Entidades de jogo indexadas por id de catálogo (GEN-001) para compra no reducer. */
export async function fetchListedGenesisEntitiesByCatalogId(): Promise<Record<string, PlayerEntity>> {
  const sb = getSupabase();
  if (!sb) return {};
  const { data, error } = await sb
    .from('genesis_market_players')
    .select('*')
    .eq('listed_on_market', true);
  if (error) {
    console.warn('[genesisMarket] fetch entities:', error.message);
    return {};
  }
  const rows = (data ?? []) as GenesisMarketPlayerRow[];
  const out: Record<string, PlayerEntity> = {};
  for (const r of rows) {
    out[r.id] = genesisRowToPlayerEntity(r);
  }
  return out;
}

