/**
 * Persistence helpers para `beta_testers`.
 * Waitlist público + RPCs admin (invite/approve/revoke) + redeem do tester.
 */
import { getSupabase } from './client';
import type { Database } from './database.types';

export type BetaTesterRow = Database['public']['Tables']['beta_testers']['Row'];
export type BetaStatus = 'pending' | 'approved' | 'rejected' | 'active' | 'revoked';

/** Inserção pública na waitlist (anon ou authenticated). */
export async function joinWaitlist(
  email: string,
  source = 'landing',
): Promise<BetaTesterRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('beta_testers')
    .insert({
      email: email.toLowerCase().trim(),
      status: 'pending',
      source,
    })
    .select()
    .single();
  if (error) {
    console.warn('[betaTesters] joinWaitlist failed', error);
    return null;
  }
  return data;
}

/** Tester resgata invite_code → status active e linka user_id. */
export async function redeemInvite(inviteCode: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data, error } = await sb.rpc('redeem_beta_invite', { p_invite_code: inviteCode });
  if (error) {
    console.warn('[betaTesters] redeem failed', error);
    return false;
  }
  return Boolean(data);
}

/** Status do tester atual (linked ao auth.uid). */
export async function fetchMyBetaStatus(): Promise<BetaTesterRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: userData } = await sb.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return null;
  const { data, error } = await sb
    .from('beta_testers')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) {
    console.warn('[betaTesters] fetchMyBetaStatus failed', error);
    return null;
  }
  return data;
}

// ─── Admin RPCs ───────────────────────────────────────────────────────────

export async function adminInviteBetaTester(
  email: string,
  notes?: string,
): Promise<{ id: string; email: string; invite_code: string } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('admin_invite_beta_tester', {
    p_email: email,
    p_source: 'admin',
    p_notes: notes ?? null,
  });
  if (error) {
    console.warn('[betaTesters] adminInvite failed', error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

export async function adminApproveBetaTester(
  testerId: string,
  notes?: string,
): Promise<{ id: string; email: string; invite_code: string } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('admin_approve_beta_tester', {
    p_tester_id: testerId,
    p_notes: notes ?? null,
  });
  if (error) {
    console.warn('[betaTesters] adminApprove failed', error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

export async function adminRevokeBetaAccess(
  testerId: string,
  reason?: string,
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data, error } = await sb.rpc('admin_revoke_beta_access', {
    p_tester_id: testerId,
    p_reason: reason ?? null,
  });
  if (error) {
    console.warn('[betaTesters] adminRevoke failed', error);
    return false;
  }
  return Boolean(data);
}

export async function adminListBetaTesters(status?: BetaStatus): Promise<BetaTesterRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  let q = sb.from('beta_testers').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) {
    console.warn('[betaTesters] adminList failed', error);
    return [];
  }
  return data ?? [];
}
