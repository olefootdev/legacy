/**
 * Persistence helpers para a tabela `notifications`.
 * Backing store do NotificationBell e do feed de inbox no servidor.
 */
import { getSupabase } from './client';
import type { Database } from './database.types';

export type NotificationRow = Database['public']['Tables']['notifications']['Row'];
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];

export async function fetchNotifications(opts?: {
  limit?: number;
  unreadOnly?: boolean;
}): Promise<NotificationRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  let q = sb
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.unreadOnly) q = q.eq('read', false);
  const { data, error } = await q;
  if (error) {
    console.warn('[notifications] fetch failed', error);
    return [];
  }
  return data ?? [];
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data, error } = await sb.rpc('mark_notification_read', { p_notification_id: id });
  if (error) {
    console.warn('[notifications] markRead failed', error);
    return false;
  }
  return Boolean(data);
}

export async function markAllNotificationsRead(): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const { data, error } = await sb.rpc('mark_all_notifications_read');
  if (error) {
    console.warn('[notifications] markAllRead failed', error);
    return 0;
  }
  return data ?? 0;
}

export async function deleteNotification(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from('notifications').delete().eq('id', id);
  if (error) {
    console.warn('[notifications] delete failed', error);
    return false;
  }
  return true;
}
