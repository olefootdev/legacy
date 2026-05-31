import { getSupabase } from '@/supabase/client';

const STORAGE_KEY = 'olefoot.legacy-v1-toast-shown';

export interface LegacyOlefootClaim {
  /** true se o usuário já tinha resgatado antes (nada novo a mostrar) */
  alreadyClaimed: boolean;
  /** saldo humano (ex.: "116130125.17740472"); null se usuário não tem registro */
  balanceHuman: string | null;
  /** true se acabou de creditar agora (primeiro login pós-import) */
  isFirstClaim: boolean;
}

/**
 * Resgata automaticamente o crédito OLEFOOT herdado do v1 (snapshot BSC).
 * Idempotente: o RPC marca credited_at e retorna alreadyClaimed=true nas vezes seguintes.
 * Retorna `isFirstClaim=true` apenas no primeiro login do usuário migrado.
 */
export async function applyLegacyOlefootCredit(): Promise<LegacyOlefootClaim> {
  const sb = getSupabase();
  if (!sb) return { alreadyClaimed: false, balanceHuman: null, isFirstClaim: false };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { alreadyClaimed: false, balanceHuman: null, isFirstClaim: false };

  const { data, error } = await sb.rpc('claim_legacy_olefoot_credit');
  if (error) {
    console.warn('claim_legacy_olefoot_credit falhou:', error.message);
    return { alreadyClaimed: false, balanceHuman: null, isFirstClaim: false };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.out_balance_human == null) {
    return { alreadyClaimed: false, balanceHuman: null, isFirstClaim: false };
  }
  const alreadyClaimed = Boolean(row.already_claimed);
  const balanceHuman = String(row.out_balance_human);
  return {
    alreadyClaimed,
    balanceHuman,
    isFirstClaim: !alreadyClaimed,
  };
}

export function hasShownLegacyToast(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markLegacyToastShown(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}
