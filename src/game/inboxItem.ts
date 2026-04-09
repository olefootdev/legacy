import type { InboxCategory, InboxItem, InboxMessageType } from './inboxTypes';
import { inboxCategoryColorClass, isLegacyPlacarInboxNotification } from './inboxTypes';

export function makeInboxItem(
  id: string,
  messageType: InboxMessageType,
  category: InboxCategory,
  title: string,
  extra?: Partial<Omit<InboxItem, 'id' | 'messageType' | 'category' | 'title'>>,
): InboxItem {
  return {
    ...(extra ?? {}),
    id,
    messageType,
    category,
    title,
    tag: extra?.tag ?? category,
    timeLabel: extra?.timeLabel ?? 'Agora',
    colorClass: extra?.colorClass ?? inboxCategoryColorClass(category),
    read: extra?.read ?? false,
  };
}

/** Converte itens antigos (só tag/title) para o modelo novo. */
export function normalizeInboxItem(raw: unknown): InboxItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : null;
  const title = typeof r.title === 'string' ? r.title : null;
  const tag = typeof r.tag === 'string' ? r.tag : 'CONTA';
  const timeLabel = typeof r.timeLabel === 'string' ? r.timeLabel : '—';
  const colorClass = typeof r.colorClass === 'string' ? r.colorClass : 'text-gray-400';
  if (!id || !title) return null;

  if (typeof r.messageType === 'string' && typeof r.category === 'string') {
    return {
      ...r,
      id,
      messageType: r.messageType as InboxMessageType,
      category: r.category as InboxCategory,
      tag: typeof r.tag === 'string' ? r.tag : (r.category as string),
      title,
      timeLabel,
      colorClass,
    } as InboxItem;
  }

  const legacyTagToCategory = (t: string): InboxCategory => {
    const u = t.toUpperCase();
    if (u.includes('TREINO') || u === 'TÁTICA') return 'TREINO';
    if (u.includes('STAFF') || u === 'MÉDICO') return 'STAFF';
    if (u.includes('FINAN') || u === 'LOJA' || u === 'WALLET' || u === 'OLEXP' || u === 'BRO')
      return 'FINANCEIRO';
    if (u.includes('INFRA') || u.includes('ESTRUTURA')) return 'CLUBE';
    if (u.includes('LIGA') || u === 'PARTIDA') return 'COMPETIÇÃO';
    if (u.includes('AMISTOSO')) return 'FINANCEIRO';
    if (u.includes('AMIGOS') || u.includes('REDE')) return 'CONTA';
    if (u.includes('MERCADO')) return 'PLANTEL';
    if (u.includes('DIRETORIA')) return 'CLUBE';
    return 'CLUBE';
  };

  const cat = legacyTagToCategory(tag);
  let messageType: InboxMessageType = 'COMPANY_ANNOUNCEMENT';
  if (tag === 'PARTIDA' || /Resultado:/i.test(title)) messageType = 'FINANCE_EXP_GAIN';
  else if (tag === 'TREINO' || tag === 'TÁTICA') messageType = 'TRAINING_STARTED';
  else if (tag === 'STAFF') messageType = 'STAFF_LEVEL_UP';
  else if (tag === 'AMIGOS' && r.kind === 'friend_invite') messageType = 'SOCIAL_FRIEND_INVITE';
  else if (tag === 'AMIGOS') messageType = 'SOCIAL_INVITE_SENT';

  return {
    id,
    messageType,
    category: cat,
    tag,
    title,
    timeLabel,
    colorClass,
    kind: r.kind === 'friend_invite' ? 'friend_invite' : r.kind === 'news' ? 'news' : undefined,
    friendRequestId: typeof r.friendRequestId === 'string' ? r.friendRequestId : undefined,
    read: Boolean(r.read),
  };
}

export function hydrateInboxList(raw: unknown): InboxItem[] {
  if (!Array.isArray(raw)) return [];
  const out: InboxItem[] = [];
  for (const x of raw) {
    const n = normalizeInboxItem(x);
    if (n) out.push(n);
  }
  return out;
}

/** Remove entradas legadas que só duplicam placar (não pertencem ao inbox de gestão). */
export function filterLegacyPlacarFromInbox(items: InboxItem[]): InboxItem[] {
  return items.filter((i) => !isLegacyPlacarInboxNotification(i));
}
