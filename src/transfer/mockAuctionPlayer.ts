import type { AuctionCurrency } from '@/economy/model';
import type { MemorableTrophyId } from '@/trophies/memorableCatalog';

/** Leilão mock + Academia OLE + catálogo Genesis (Supabase). */
export interface MockAuctionPlayer {
  id: number;
  name: string;
  pos: string;
  nat: string;
  ovr: number;
  style: string;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  auctionCurrency: AuctionCurrency;
  /** EXP: pontos inteiros. BRO: centavos de BRO (como `broCents` na carteira). */
  currentBid: number;
  buyNow: number;
  timeLeft: string;
  history: { year: string; club: string; apps: number; goals: number }[];
  category?: 'gold' | 'silver' | 'bronze';
  bio?: string;
  memorableTrophyIds?: MemorableTrophyId[];
  marketKind?: 'mock' | 'manager_own' | 'manager_npc' | 'genesis';
  managerListingId?: string;
  managerPlayerId?: string;
  /** Catálogo `genesis_market_players.id` (ex. GEN-001). */
  genesisCatalogId?: string;
  /** URL pública do retrato (Storage ou campo `portrait_public_url`). */
  portraitSrc?: string;
  /** Mint OVR no catálogo (validação de preço EXP na compra Genesis). */
  mintOverall?: number;
  /** Preço listado em EXP (catálogo Genesis). */
  listingPriceExp?: number;
}
