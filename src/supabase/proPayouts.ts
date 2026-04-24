import { getSupabase } from '@/supabase/client';

export interface ProSummary {
  balance_exp: number;
  total_sales: number;
  last_sale_at: string | null;
}

export interface ProPayoutRow {
  id: number;
  player_id: string;
  player_name: string | null;
  split_kind: 'player' | 'facilitator' | 'olefoot' | string;
  percent: number;
  amount_exp: number;
  created_at: string;
}

export async function getMyProSummary(): Promise<ProSummary | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_my_pro_summary');
  if (error) {
    console.warn('[proPayouts] summary:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { balance_exp: 0, total_sales: 0, last_sale_at: null };
  return {
    balance_exp: Number(row.balance_exp ?? 0),
    total_sales: Number(row.total_sales ?? 0),
    last_sale_at: row.last_sale_at ?? null,
  };
}

export async function getMyProPayouts(limit = 50): Promise<ProPayoutRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('get_my_pro_payouts', { p_limit: limit });
  if (error) {
    console.warn('[proPayouts] payouts:', error.message);
    return [];
  }
  return (data ?? []) as ProPayoutRow[];
}

/** Subscribe realtime a novos payouts do usuário. Retorna cleanup. */
export function subscribeMyProPayouts(
  userId: string,
  onInsert: (row: ProPayoutRow) => void,
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb
    .channel(`pro_payouts:${userId}`)
    .on(
      'postgres_changes' as unknown as 'system',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'pro_payouts',
        filter: `user_id=eq.${userId}`,
      } as unknown as Record<string, never>,
      (payload: { new: ProPayoutRow }) => {
        onInsert(payload.new);
      },
    )
    .subscribe();
  return () => {
    try { sb.removeChannel(channel); } catch { /* noop */ }
  };
}
