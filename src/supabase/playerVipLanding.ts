/**
 * PLAYERVIP LANDING — vitrine pública por handle (game.olefoot.com/playervip/<handle>).
 *
 * Lê o RPC público `get_playervip_landing` (SECURITY DEFINER, sem e-mail).
 * Sem sessão: é uma página aberta que qualquer um pode ver e compartilhar.
 */
import { getSupabase } from './client';

export interface LandingCard {
  id: string;
  name: string;
  club: string | null;
  phase: string | null;
  portrait: string | null;
  narrativeTitle: string | null;
  tagline: string | null;
  currency: string;
  priceCents: number;
  mintOverall: number | null;
  attributes: Record<string, number> | null;
  yearStart: number | null;
  yearEnd: number | null;
}

export interface PlayerVipLandingData {
  handle: string;
  displayName: string;
  headline: string | null;
  referralCode: string | null;
  collectionId: string | null;
  cards: LandingCard[];
}

export async function fetchPlayerVipLanding(handle: string): Promise<PlayerVipLandingData | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_playervip_landing', { p_handle: handle });
  if (error) {
    console.warn('[playerVipLanding]', error.message);
    return null;
  }
  if (!data) return null;
  const d = data as Record<string, unknown>;
  const rawCards = Array.isArray(d.cards) ? (d.cards as Record<string, unknown>[]) : [];
  return {
    handle: String(d.handle ?? handle),
    displayName: String(d.displayName ?? ''),
    headline: (d.headline as string) ?? null,
    referralCode: (d.referralCode as string) ?? null,
    collectionId: (d.collectionId as string) ?? null,
    cards: rawCards.map((c) => ({
      id: String(c.id),
      name: String(c.name ?? ''),
      club: (c.club as string) ?? null,
      phase: (c.phase as string) ?? null,
      portrait: (c.portrait as string) ?? null,
      narrativeTitle: (c.narrativeTitle as string) ?? null,
      tagline: (c.tagline as string) ?? null,
      currency: String(c.currency ?? 'USDT'),
      priceCents: Number(c.priceCents ?? 0),
      mintOverall: c.mintOverall != null ? Number(c.mintOverall) : null,
      attributes: (c.attributes as Record<string, number>) ?? null,
      yearStart: c.yearStart != null ? Number(c.yearStart) : null,
      yearEnd: c.yearEnd != null ? Number(c.yearEnd) : null,
    })),
  };
}
