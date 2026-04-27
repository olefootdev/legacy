/**
 * Sincroniza `notifications` (Supabase) → estado local de inbox.
 * Pull on mount + realtime via supabase channel.
 */
import { useEffect } from 'react';
import { getSupabase } from '@/supabase/client';
import { fetchNotifications, type NotificationRow } from '@/supabase/notifications';

export interface UseNotificationsSyncOptions {
  enabled?: boolean;
  onNotifications?: (rows: NotificationRow[]) => void;
  onIncoming?: (row: NotificationRow) => void;
}

export function useNotificationsSync({
  enabled = true,
  onNotifications,
  onIncoming,
}: UseNotificationsSyncOptions = {}) {
  useEffect(() => {
    if (!enabled) return;
    const sb = getSupabase();
    if (!sb) return;

    let active = true;

    fetchNotifications({ limit: 50 }).then((rows) => {
      if (active) onNotifications?.(rows);
    });

    const channel = sb
      .channel('notifications:self')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          if (!active) return;
          onIncoming?.(payload.new as NotificationRow);
        },
      )
      .subscribe();

    return () => {
      active = false;
      sb.removeChannel(channel);
    };
  }, [enabled, onNotifications, onIncoming]);
}
