import { getSupabase } from '@/supabase/client';
import { getGameState, dispatchGame } from '@/game/store';

/**
 * Busca créditos BRO pendentes no Supabase e aplica-os ao estado do jogo.
 * Cada crédito é aplicado uma única vez — applied_at marca como processado.
 * Chama-se no arranque do app, após a sessão Supabase estar disponível.
 */
export async function applyPendingCredits(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { data: credits, error } = await sb
    .from('wallet_credits')
    .select('id, bro_cents')
    .eq('user_id', user.id)
    .is('applied_at', null);

  if (error || !credits || credits.length === 0) return;

  const totalCents = credits.reduce((sum, c) => sum + (c.bro_cents as number), 0);

  // Aplica ao estado do jogo (fromServer=true via ADMIN_GRANT_RESOURCES)
  dispatchGame({
    type: 'ADMIN_GRANT_RESOURCES',
    broCentsDelta: totalCents,
  });

  // Marca todos como aplicados
  const ids = credits.map((c) => c.id as string);
  await sb
    .from('wallet_credits')
    .update({ applied_at: new Date().toISOString() })
    .in('id', ids);
}
