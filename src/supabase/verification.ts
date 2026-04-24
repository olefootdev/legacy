import { getSupabase } from '@/supabase/client';

export type VerificationStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';

export interface VerificationAddress {
  international: boolean;
  zip: string;
  street: string;
  number: string;
  complement?: string;
  city: string;
  state: string;
  country: string;
}

export interface VerificationData {
  birthDate: string; // YYYY-MM-DD
  address: VerificationAddress;
  contractAcceptedAt: string; // ISO
}

export interface VerificationStateRow {
  verification_status: VerificationStatus;
  verified: boolean;
  verification_data: VerificationData | null;
  verification_submitted_at: string | null;
  verification_reviewed_at: string | null;
  verification_rejection_reason: string | null;
}

export async function getMyVerification(): Promise<VerificationStateRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_my_verification');
  if (error) {
    console.warn('[verification] get_my_verification:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return (row as VerificationStateRow | undefined) ?? null;
}

export async function submitVerification(payload: VerificationData): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Supabase não configurado.' };
  const { error } = await sb.rpc('submit_verification', { p_data: payload });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface AdminVerificationRow {
  id: string;
  display_name: string | null;
  club_name: string | null;
  verification_status: VerificationStatus;
  verification_data: VerificationData | null;
  verification_submitted_at: string | null;
  verification_reviewed_at: string | null;
  verification_rejection_reason: string | null;
}

export async function adminListVerifications(status: VerificationStatus = 'pending'): Promise<AdminVerificationRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('admin_list_verifications', { p_status: status });
  if (error) {
    console.warn('[verification] admin_list:', error.message);
    return [];
  }
  return (data ?? []) as AdminVerificationRow[];
}

export async function adminSetVerification(userId: string, approved: boolean, reason?: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Supabase não configurado.' };
  const { error } = await sb.rpc('admin_set_verification', {
    p_user_id: userId,
    p_approved: approved,
    p_reason: reason ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** ViaCEP lookup (só BR). */
export async function lookupCepBR(cep: string): Promise<{
  street?: string;
  city?: string;
  state?: string;
  error?: string;
} | null> {
  const cleaned = cep.replace(/\D/g, '');
  if (cleaned.length !== 8) return { error: 'CEP inválido' };
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
    if (!r.ok) return { error: 'Falha no lookup' };
    const j = await r.json();
    if (j.erro) return { error: 'CEP não encontrado' };
    return {
      street: j.logradouro ?? '',
      city: j.localidade ?? '',
      state: j.uf ?? '',
    };
  } catch {
    return { error: 'Sem conexão' };
  }
}
