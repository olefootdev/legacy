import { dispatchGame } from '@/game/store';
import { makeInboxItem } from '@/game/inboxItem';
import type { InboxCategory } from '@/game/inboxTypes';
import { consumeBroadcasts } from '@/supabase/adminBroadcasts';

const VALID_CATEGORIES: InboxCategory[] = [
  'PLANTEL', 'TREINO', 'STAFF', 'FINANCEIRO', 'CLUBE',
  'COMPETIÇÃO', 'MISSÃO', 'TORCIDA', 'EMPRESA', 'CONTA',
];

function toCategory(raw: string): InboxCategory {
  const u = (raw ?? '').trim().toUpperCase();
  return (VALID_CATEGORIES as string[]).includes(u) ? (u as InboxCategory) : 'CONTA';
}

/**
 * Consome broadcasts pendentes do servidor (RPC `consume_broadcasts`), empurra cada um
 * pro inbox local e marca entrega — idempotente pelo server side (PK broadcast_id,user_id).
 */
export async function syncAdminBroadcasts(): Promise<number> {
  try {
    const rows = await consumeBroadcasts();
    if (rows.length === 0) return 0;
    for (const r of rows) {
      const item = makeInboxItem(
        `admin-broadcast-${r.id}`,
        'ADMIN_BROADCAST',
        toCategory(r.category),
        r.title,
        {
          body: r.body,
          deepLink: r.deep_link ?? undefined,
          timeLabel: new Date(r.created_at).toLocaleString('pt-BR'),
        },
      );
      dispatchGame({ type: 'INBOX_PREPEND', item });
    }
    return rows.length;
  } catch (err) {
    console.warn('[broadcastConsumer] sync failed:', err);
    return 0;
  }
}
