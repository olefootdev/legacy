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
  /** Descendentes ATIVOS abaixo dele — a "equipe" dele. Não inclui ele mesmo. */
  legSize: number;
  /** true se esta equipe está entre as 2 maiores (as que valem pros marcos). */
  countsForMilestones: boolean;
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
    leg_size?: number | string | null;
    counts_for_milestones?: boolean | null;
  }) => ({
    id: row.id,
    displayName: row.display_name ?? null,
    clubName: row.club_name ?? null,
    clubShort: row.club_short ?? null,
    createdAt: row.created_at,
    expLifetimeEarned: Number(row.exp_lifetime_earned ?? 0),
    legSize: Number(row.leg_size ?? 0),
    countsForMilestones: Boolean(row.counts_for_milestones),
  }));
}

export interface NetworkStatus {
  /** Indicados diretos que já jogaram. Régua do marco 1. */
  directsActive: number;
  /** Indicados diretos no total, ativos ou não. */
  directsTotal: number;
  /** Soma das 2 maiores equipes — régua dos marcos 10/25/50/100. */
  qualifyingCount: number;
  /** Nº de pernas. A regra futura do Plano de Carreira exige 4 (equipe D). */
  legsTotal: number;
}

const EMPTY_STATUS: NetworkStatus = {
  directsActive: 0,
  directsTotal: 0,
  qualifyingCount: 0,
  legsTotal: 0,
};

/** Estado da rede pros marcos. Ver src/systems/network/milestones.ts pra regra. */
export async function getMyNetworkStatus(): Promise<NetworkStatus> {
  const sb = getSupabase();
  if (!sb) return EMPTY_STATUS;
  const { data, error } = await sb.rpc('get_my_network_status');
  if (error) {
    console.warn('[referrals] getMyNetworkStatus:', error.message);
    return EMPTY_STATUS;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return EMPTY_STATUS;
  return {
    directsActive: Number(row.directs_active ?? 0),
    directsTotal: Number(row.directs_total ?? 0),
    qualifyingCount: Number(row.qualifying_count ?? 0),
    legsTotal: Number(row.legs_total ?? 0),
  };
}

/** Marcos já resgatados (targets). */
export async function fetchClaimedMilestones(): Promise<number[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('network_milestone_claims')
    .select('milestone');
  if (error || !Array.isArray(data)) return [];
  return data.map((r) => Number((r as { milestone: number }).milestone));
}

export type ClaimMilestoneResult =
  | { ok: true; exp: number }
  | { ok: false; error: string };

/**
 * Resgata um marco. O servidor decide o valor (`network_milestone_exp`) e credita
 * via `wallet_credits` — o cliente só chama `applyPendingCredits()` depois.
 *
 * Isso conserta a fragilidade do sistema antigo, onde o RPC marcava resgatado e o
 * crédito era client-side: se o dispatch falhasse, o EXP sumia. Agora o crédito
 * fica pendente no banco e é reaplicado no próximo boot.
 */
export async function claimNetworkMilestone(target: number): Promise<ClaimMilestoneResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Serviço indisponível.' };
  const { data, error } = await sb.rpc('claim_network_milestone', { p_milestone: target });
  if (error) {
    const m = error.message || '';
    if (m.includes('MILESTONE_NOT_REACHED')) return { ok: false, error: 'Você ainda não atingiu este marco.' };
    if (m.includes('ALREADY_CLAIMED')) return { ok: false, error: 'Este marco já foi resgatado.' };
    if (m.includes('INVALID_MILESTONE')) return { ok: false, error: 'Marco inválido.' };
    if (m.includes('NOT_AUTHENTICATED')) return { ok: false, error: 'Faça login novamente.' };
    console.warn('[referrals] claimNetworkMilestone:', m);
    return { ok: false, error: 'Não foi possível resgatar agora.' };
  }
  return { ok: true, exp: Number(data ?? 0) };
}

/**
 * Sincroniza o lifetime EXP local com o profile do servidor.
 * Server-side é monotônico: nunca regride. Idempotente — chamar várias vezes
 * com o mesmo valor é seguro.
 *
 * NÃO REMOVER: `profiles.exp_lifetime_earned` é o que define "indicado ativo" —
 * usado pelos marcos de rede E pelo gate de ≥5 indicados do sorteio de craque.
 * O trigger de comissão que lia esse delta foi removido em 2026-07-17.
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
