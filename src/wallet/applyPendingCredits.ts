import { getSupabase } from '@/supabase/client';
import { dispatchGame } from '@/game/store';

/**
 * Reivindica créditos BRO/EXP pendentes via RPC server-side e aplica ao
 * estado do jogo. Chama-se no arranque do app, após a sessão Supabase estar
 * disponível.
 *
 * A soma e o marcar-como-aplicado acontecem atomicamente em
 * `claim_pending_wallet_credits()` (trava as linhas, soma, marca applied_at
 * na mesma transação) — o cliente nunca mais lê/escreve `wallet_credits`
 * diretamente. Ver migration 20260918220000_wallet_credits_claim_rpc.sql.
 */
export async function applyPendingCredits(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { data, error } = await sb.rpc('claim_pending_wallet_credits');
  if (error) {
    console.warn('[applyPendingCredits] claim_pending_wallet_credits:', error.message);
    return;
  }

  const row = Array.isArray(data) ? data[0] : data;
  const totalCents = Number(row?.bro_cents_total ?? 0);
  const totalExp = Number(row?.exp_amount_total ?? 0);
  if (totalCents === 0 && totalExp === 0) return;

  dispatchGame({
    type: 'ADMIN_GRANT_RESOURCES',
    broCentsDelta: totalCents,
    earnedExp: totalExp > 0 ? totalExp : undefined,
  });
}
