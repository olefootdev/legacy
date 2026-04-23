import { getSupabase } from '@/supabase/client';

export type AdminBroadcastRow = {
  id: string;
  title: string;
  body: string;
  category: string;
  deep_link: string | null;
  audience: string;
  active: boolean;
  created_at: string;
  created_by: string | null;
  expires_at: string | null;
};

export type AdminBroadcastStatsRow = {
  id: string;
  title: string;
  category: string;
  created_at: string;
  active: boolean;
  deliveries: number;
};

export async function sendAdminBroadcast(input: {
  title: string;
  body: string;
  category?: string;
  deepLink?: string | null;
  expiresAt?: string | null;
}): Promise<AdminBroadcastRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('admin_send_broadcast', {
    p_title: input.title,
    p_body: input.body,
    p_category: input.category ?? 'CONTA',
    p_deep_link: input.deepLink ?? null,
    p_expires_at: input.expiresAt ?? null,
  });
  if (error) {
    console.error('[adminBroadcasts] send:', error.message);
    return null;
  }
  return (Array.isArray(data) ? data[0] : data) as AdminBroadcastRow | null;
}

export async function consumeBroadcasts(): Promise<AdminBroadcastRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('consume_broadcasts');
  if (error) {
    console.warn('[adminBroadcasts] consume:', error.message);
    return [];
  }
  return (data ?? []) as AdminBroadcastRow[];
}

export async function fetchBroadcastStats(limit = 50): Promise<AdminBroadcastStatsRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('admin_broadcast_stats', { p_limit: limit });
  if (error) {
    console.warn('[adminBroadcasts] stats:', error.message);
    return [];
  }
  return (data ?? []) as AdminBroadcastStatsRow[];
}

export async function deactivateBroadcast(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb
    .from('admin_broadcasts')
    .update({ active: false })
    .eq('id', id);
  if (error) {
    console.error('[adminBroadcasts] deactivate:', error.message);
    return false;
  }
  return true;
}
