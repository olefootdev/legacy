/**
 * Premium Cards — concessões de card ao manager (tabela `premium_card_grants`).
 *
 * Morava dentro de `hodlLocks.ts` até 2026-07-16, quando o HODL foi removido
 * junto com o OLEXP. Os cards em si NÃO eram do HODL — sobrevivem via
 * `career_bonus` e `admin`. As fontes `hodl_lock` / `hodl_lottery` continuam
 * aparecendo em grants ANTIGOS já gravados no banco; por isso `source` é string
 * aberta e a UI só exibe o rótulo.
 */

import { getSupabase } from '@/supabase/client';

export interface PremiumCardGrant {
  id: string;
  cardTier: 'premium' | 'rare' | 'legendary';
  source: string;
  cardMetadata: Record<string, unknown>;
  grantedAt: string;
  redeemedAt: string | null;
}

export async function fetchMyPremiumCards(onlyPending = true): Promise<PremiumCardGrant[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb.rpc('get_my_premium_cards', {
    p_only_pending: onlyPending,
  });
  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    cardTier: (row.card_tier ?? 'premium') as 'premium' | 'rare' | 'legendary',
    source: row.source as string,
    cardMetadata: (row.card_metadata ?? {}) as Record<string, unknown>,
    grantedAt: row.granted_at as string,
    redeemedAt: (row.redeemed_at ?? null) as string | null,
  }));
}

export async function redeemPremiumCard(cardId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { data, error } = await sb.rpc('redeem_premium_card', {
    p_card_id: cardId,
  });
  if (error) return false;
  return Boolean(data);
}
