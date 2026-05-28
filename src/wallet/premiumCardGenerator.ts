/**
 * Premium Card Generator
 *
 * Função canônica chamada quando um Premium Card deve ser entregue ao user:
 *   - HODL lock (instant)
 *   - HODL lottery (sorteio diário)
 *   - Career rank bonus (futuro)
 *   - Admin grants (manual)
 *
 * A geração de fato (gravar `premium_cards_grants`) é feita no servidor via
 * RPC create_hodl_lock / process_hodl_daily_tick. Este módulo é o ponto de
 * entrada *cliente* — quem chama recebe o card grant pra exibir confetti +
 * abrir o card no overlay.
 *
 * Para futuras integrações (career, admin) basta chamar `recordCardGrant()`
 * com source apropriado.
 */

import { getSupabase } from '@/supabase/client';
import { fetchMyPremiumCards, type PremiumCardGrant } from './hodlLocks';

export type CardTier = 'premium' | 'rare' | 'legendary';
export type CardSource = 'hodl_lock' | 'hodl_lottery' | 'career_bonus' | 'admin';

export interface CardGrantInput {
  cardTier?: CardTier;
  source: CardSource;
  sourceRef: string;
  metadata?: Record<string, unknown>;
}

/**
 * Registra um novo card grant. Idempotente via (source, source_ref).
 * Para `hodl_lock` e `hodl_lottery`, o servidor já cria — use isto apenas
 * em paths admin/career que precisam do client gerar.
 */
export async function recordCardGrant(input: CardGrantInput): Promise<PremiumCardGrant | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data, error } = await sb
    .from('premium_cards_grants')
    .insert({
      user_id: user.id,
      card_tier: input.cardTier ?? 'premium',
      source: input.source,
      source_ref: input.sourceRef,
      card_metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    cardTier: data.card_tier,
    source: data.source,
    cardMetadata: data.card_metadata ?? {},
    grantedAt: data.granted_at,
    redeemedAt: data.redeemed_at,
  };
}

/** Atalho semântico: já gera com source='hodl_lock' a partir do lockId. */
export async function generatePremiumCardForHodl(lockId: string, metadata?: Record<string, unknown>): Promise<PremiumCardGrant | null> {
  // O servidor já gera via create_hodl_lock RPC. Esta fn é fallback / consulta.
  // Procura o card já criado pelo backend.
  const cards = await fetchMyPremiumCards(false);
  const existing = cards.find((c) => {
    return c.source === 'hodl_lock' && (c.cardMetadata as Record<string, unknown>)?.lock_id === lockId;
  });
  if (existing) return existing;

  return recordCardGrant({
    source: 'hodl_lock',
    sourceRef: lockId,
    metadata,
  });
}
