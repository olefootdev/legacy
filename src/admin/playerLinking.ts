import { getSupabase } from '@/supabase/client';

export type PlayerLinkTable = 'genesis_market_players' | 'legacy_players';

export type SplitEntryKind = 'player' | 'facilitator' | 'olefoot';

export interface PaymentSplitEntry {
  kind: SplitEntryKind;
  /** Usuário beneficiário (null pra entrada 'olefoot' ou quando sem user vinculado). */
  user_id: string | null;
  label: string;
  percent: number;
}

export const DEFAULT_SPLIT: PaymentSplitEntry[] = [
  { kind: 'player', user_id: null, label: 'Jogador', percent: 50 },
  { kind: 'facilitator', user_id: null, label: 'Facilitador', percent: 10 },
  { kind: 'olefoot', user_id: null, label: 'Olefoot', percent: 40 },
];

export function splitTotal(split: PaymentSplitEntry[]): number {
  return Math.round(split.reduce((acc, e) => acc + (Number(e.percent) || 0), 0) * 100) / 100;
}

export function isSplitValid(split: PaymentSplitEntry[]): boolean {
  if (!Array.isArray(split) || split.length === 0) return false;
  const total = splitTotal(split);
  return Math.abs(total - 100) < 0.01;
}

export async function adminSavePlayerLink(params: {
  table: PlayerLinkTable;
  playerId: string;
  beneficiaryUserId: string | null;
  split: PaymentSplitEntry[];
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Supabase não configurado.' };
  const { error } = await sb.rpc('admin_update_player_link', {
    p_table: params.table,
    p_player_id: params.playerId,
    p_beneficiary_user_id: params.beneficiaryUserId,
    p_payment_split: params.split,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Vincula o beneficiário por E-MAIL (auth.users) — funciona pra lenda que só
 * existe via login mágico da PLAYERVIP (sem row em profiles). Grava
 * beneficiary_user_id + injeta o id na fatia 'player' do split.
 * Retorna o user_id resolvido, ou erro amigável se o e-mail não tem conta.
 */
export async function adminLinkPlayerByEmail(params: {
  table: PlayerLinkTable;
  playerId: string;
  email: string;
  split: PaymentSplitEntry[];
}): Promise<{ ok: boolean; userId?: string; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Supabase não configurado.' };
  const { data, error } = await sb.rpc('admin_link_player_by_email', {
    p_table: params.table,
    p_player_id: params.playerId,
    p_email: params.email.trim(),
    p_payment_split: params.split,
  });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('email_sem_conta')) {
      return { ok: false, error: 'Esse e-mail ainda não tem conta. Peça pra lenda entrar uma vez em /playervip.' };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, userId: data as string };
}

export interface LinkedCardRow {
  source: 'genesis' | 'legacy';
  id: string;
  name: string;
  pos: string;
  rarity_label: string;
  portrait_public_url: string;
  price_bro_cents: number;
  listed_on_market: boolean;
  beneficiary_user_id: string | null;
  payment_split: PaymentSplitEntry[] | null;
}

export async function getMyLinkedCards(): Promise<LinkedCardRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('get_my_linked_cards');
  if (error) {
    console.warn('[playerLinking] get_my_linked_cards:', error.message);
    return [];
  }
  return (data ?? []) as LinkedCardRow[];
}
