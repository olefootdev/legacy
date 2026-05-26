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
  /** Quanto EXP este indicado já acumulou no jogo (snapshot do server). */
  expLifetimeEarned: number;
  /** Quanto o referrer já recebeu de comissão (5%) sobre esse indicado. */
  commissionEarned: number;
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
    exp_lifetime_earned?: number | string | null;
    commission_earned?: number | string | null;
  }) => ({
    id: row.id,
    displayName: row.display_name ?? null,
    clubName: row.club_name ?? null,
    clubShort: row.club_short ?? null,
    createdAt: row.created_at,
    expLifetimeEarned: Number(row.exp_lifetime_earned ?? 0),
    commissionEarned: Number(row.commission_earned ?? 0),
  }));
}

/**
 * Sincroniza o lifetime EXP local com o profile do servidor.
 * Server-side é monotônico: nunca regride. Idempotente — chamar várias vezes
 * com o mesmo valor é seguro.
 *
 * O trigger `profiles_referral_exp_commission_trg` detecta o delta e cria
 * a comissão de 5% pro referrer (se existir).
 */
export async function syncMyExpLifetime(amount: number): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  if (!Number.isFinite(amount) || amount < 0) return;
  const { error } = await sb.rpc('sync_my_exp_lifetime', { p_amount: Math.floor(amount) });
  if (error) {
    console.warn('[referrals] syncMyExpLifetime:', error.message);
  }
}
