/**
 * Cliente do sistema de referral (Supabase).
 *
 * Fluxo:
 * — `fetchMyReferralCode()`: lê o código persistido no profile do usuário.
 *   Cada profile recebe um código único 8 chars no signup (trigger
 *   `profiles_set_referral_code`).
 * — `fetchMyReferrals()`: lista profiles que se cadastraram com este código,
 *   via RPC `get_my_referrals` (SECURITY DEFINER + autenticação obrigatória).
 *
 * Os RPCs ficam autoritativos. O `wallet.myReferralCode` (localStorage)
 * passa a ser apenas cache do servidor — sincronizado via persistence.
 */
import { getSupabase } from './client';

export interface ReferredProfile {
  id: string;
  displayName: string | null;
  clubName: string | null;
  clubShort: string | null;
  createdAt: string;
}

export async function fetchMyReferralCode(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_my_referral_code');
  if (error) {
    console.warn('[referrals] fetchMyReferralCode:', error.message);
    return null;
  }
  return typeof data === 'string' ? data : null;
}

export async function fetchMyReferrals(): Promise<ReferredProfile[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('get_my_referrals');
  if (error) {
    console.warn('[referrals] fetchMyReferrals:', error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.map((row: {
    id: string;
    display_name: string | null;
    club_name: string | null;
    club_short: string | null;
    created_at: string;
  }) => ({
    id: row.id,
    displayName: row.display_name ?? null,
    clubName: row.club_name ?? null,
    clubShort: row.club_short ?? null,
    createdAt: row.created_at,
  }));
}
