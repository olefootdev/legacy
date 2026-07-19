import { getSupabase } from '@/supabase/client';
import { overallFromAttributes } from '@/entities/player';
import type { PlayerEntity } from '@/entities/types';
import { resolvePersistClubId } from '@/supabase/matchPersistence';

/** Listagem de Academia OLE de OUTRO manager, visível no marketplace. */
export interface OtherManagerListing {
  listingId: string;
  sellerClubId: string;
  gamePlayerId: string;
  priceExp: number;
  mintOverall: number;
  listedAtIso: string;
  player: PlayerEntity;
}

/**
 * Snapshot persistido em `academy_managers.player_snapshot` — campos usados pelo
 * motor / `PlayerEntity`; versão para evolução do schema sem quebrar leitores.
 */
function portraitForRemoteRow(url: string | undefined): string | null | undefined {
  const u = url?.trim();
  if (!u) return undefined;
  if (u.startsWith('data:')) return null;
  return u;
}

export function academyMotorSnapshotFromPlayer(pl: PlayerEntity): Record<string, unknown> {
  const mintOverall = pl.mintOverall ?? overallFromAttributes(pl.attrs, pl.pos);
  const portraitUrl = portraitForRemoteRow(pl.portraitUrl);
  const portraitTokenUrl = portraitForRemoteRow(pl.portraitTokenUrl);
  return {
    schemaVersion: 1,
    id: pl.id,
    num: pl.num,
    name: pl.name,
    pos: pl.pos,
    archetype: pl.archetype,
    zone: pl.zone,
    behavior: pl.behavior,
    attrs: { ...pl.attrs },
    fatigue: pl.fatigue,
    injuryRisk: pl.injuryRisk,
    evolutionXp: pl.evolutionXp,
    outForMatches: pl.outForMatches,
    portraitUrl,
    portraitTokenUrl,
    marketValueBroCents: pl.marketValueBroCents,
    marketValueExp: pl.marketValueExp,
    country: pl.country,
    strongFoot: pl.strongFoot,
    creatorType: pl.creatorType,
    rarity: pl.rarity,
    collectionId: pl.collectionId,
    cardSupply: pl.cardSupply,
    bio: pl.bio,
    listedOnMarket: pl.listedOnMarket,
    managerCreated: pl.managerCreated,
    age: pl.age,
    mintOverall,
    evolutionRate: pl.evolutionRate,
    contractMatchesRemaining: pl.contractMatchesRemaining,
    contractMatchesIncluded: pl.contractMatchesIncluded,
    contractIsLifetime: pl.contractIsLifetime,
    contractExpired: pl.contractExpired,
    genesisCatalogId: pl.genesisCatalogId,
  };
}

function portraitUrlForColumns(url: string | undefined): { card: string | null; token: string | null } {
  const u = url?.trim();
  if (!u) return { card: null, token: null };
  const max = 8000;
  if (u.length > max) return { card: null, token: null };
  if (!/^https?:\/\//i.test(u)) return { card: null, token: null };
  return { card: u, token: null };
}

export type RegisterAcademyManagerListingResult =
  | { ok: true }
  | { ok: false; reason: 'no_client' | 'no_club' | 'request_error'; message?: string };

export async function registerAcademyManagerListing(input: {
  localClubId: string;
  listingId: string;
  gamePlayerId: string;
  artRequestId: string;
  priceExp: number;
  listedAtIso: string;
  player: PlayerEntity;
}): Promise<RegisterAcademyManagerListingResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: 'no_client' };
  const clubId = await resolvePersistClubId(sb, input.localClubId);
  if (!clubId) return { ok: false, reason: 'no_club' };

  const merged: PlayerEntity = {
    ...input.player,
    portraitUrl: input.player.portraitUrl?.trim() || input.player.portraitUrl,
    listedOnMarket: true,
  };
  const snapshot = academyMotorSnapshotFromPlayer(merged);
  const mintOverall = Math.round(Number(snapshot.mintOverall)) || overallFromAttributes(merged.attrs, merged.pos);
  const { card, token } = portraitUrlForColumns(merged.portraitUrl);

  try {
    const { error } = await sb.from('academy_managers').insert({
      club_id: clubId,
      listing_id: input.listingId,
      game_player_id: input.gamePlayerId,
      art_request_id: input.artRequestId,
      price_exp: input.priceExp,
      listed_at: input.listedAtIso,
      listed_on_market: true,
      mint_overall: Math.min(99, Math.max(0, mintOverall)),
      player_snapshot: snapshot,
      portrait_public_url: card,
      portrait_token_public_url: token,
    } as never);
    if (error) return { ok: false, reason: 'request_error', message: error.message };
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: 'request_error', message };
  }
}

/**
 * Lê listagens de Academia OLE de OUTROS managers (não o próprio).
 * Filtra listed_on_market=true e exclui club_id do próprio comprador.
 * Reconstrói PlayerEntity a partir do JSON em player_snapshot.
 */
export async function fetchOtherManagerListings(myClubId: string | null): Promise<OtherManagerListing[]> {
  const sb = getSupabase();
  if (!sb) return [];
  let query = sb
    .from('academy_managers')
    .select('listing_id, club_id, game_player_id, price_exp, mint_overall, listed_at, player_snapshot')
    .eq('listed_on_market', true)
    .order('listed_at', { ascending: false })
    .limit(100);
  if (myClubId) query = query.neq('club_id', myClubId);
  const { data, error } = await query;
  if (error) {
    console.warn('[academyManagers] fetchOtherManagerListings:', error.message);
    return [];
  }
  const rows = (data ?? []) as Array<{
    listing_id: string;
    club_id: string;
    game_player_id: string;
    price_exp: number;
    mint_overall: number;
    listed_at: string;
    player_snapshot: PlayerEntity;
  }>;
  return rows.map((r) => ({
    listingId: r.listing_id,
    sellerClubId: r.club_id,
    gamePlayerId: r.game_player_id,
    priceExp: Number(r.price_exp),
    mintOverall: Number(r.mint_overall),
    listedAtIso: r.listed_at,
    player: r.player_snapshot,
  }));
}
