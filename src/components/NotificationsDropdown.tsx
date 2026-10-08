import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, ChevronRight, Trophy, Users, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Hashtag } from '@/components/ui';
import { useGameDispatch, useGameStore } from '@/game/store';
import {
  isHiddenFromHomeInboxFeed,
  type InboxCategory,
  type InboxItem,
  type InboxMessageType,
} from '@/game/inboxTypes';
import { useNotificationsSync } from '@/hooks/useNotificationsSync';
import type { NotificationRow } from '@/supabase/notifications';
import { L, LOCALE } from '@/i18n/L';

/** Rótulo de tela da categoria (o valor `category` continua em PT). */
const CATEGORY_TAG: Record<InboxCategory, string> = {
  PLANTEL: L('plantel', 'squad'),
  TREINO: L('treino', 'training'),
  STAFF: 'staff',
  FINANCEIRO: L('financeiro', 'finance'),
  CLUBE: L('clube', 'club'),
  COMPETIÇÃO: L('competição', 'competition'),
  MISSÃO: L('missão', 'mission'),
  TORCIDA: L('torcida', 'fans'),
  EMPRESA: L('empresa', 'company'),
  CONTA: L('conta', 'account'),
  RANKING: 'ranking',
  DESAFIOS: L('desafios', 'challenges'),
};

const VALID_CATEGORIES: InboxCategory[] = [
  'PLANTEL',
  'TREINO',
  'STAFF',
  'FINANCEIRO',
  'CLUBE',
  'COMPETIÇÃO',
  'MISSÃO',
  'TORCIDA',
  'EMPRESA',
  'CONTA',
];

function notificationRowToInbox(row: NotificationRow): InboxItem {
  const upper = row.category.toUpperCase();
  const category: InboxCategory = (VALID_CATEGORIES as string[]).includes(upper)
    ? (upper as InboxCategory)
    : 'CONTA';
  const created = new Date(row.created_at);
  return {
    id: `srv:${row.id}`,
    messageType: 'COMPANY_ANNOUNCEMENT' as InboxMessageType,
    category,
    tag: category,
    title: row.title,
    body: row.message ?? undefined,
    timeLabel: created.toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' }),
    read: row.read,
    deepLink: row.link ?? undefined,
    colorClass: 'text-rua',
  };
}

interface NotificationItemProps {
  key?: import("react").Key;
  notification: InboxItem;
  onClose: () => void;
}

function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const getIcon = () => {
    switch (notification.category) {
      case 'COMPETIÇÃO':
        return <Trophy className="h-5 w-5 text-rua" strokeWidth={2} />;
      case 'PLANTEL':
        return <Users className="h-5 w-5 text-papel" strokeWidth={2} />;
      case 'TREINO':
        return <TrendingUp className="h-5 w-5 text-alta" strokeWidth={2} />;
      case 'STAFF':
        return <AlertCircle className="h-5 w-5 text-rua" strokeWidth={2} />;
      case 'TORCIDA':
        return <CheckCircle className="h-5 w-5 text-alta" strokeWidth={2} />;
      default:
        return <Bell className="h-5 w-5 text-suave" strokeWidth={2} />;
    }
  };

  const getLink = () => {
    if (notification.deepLink) return notification.deepLink;

    switch (notification.category) {
      case 'COMPETIÇÃO':
        return '/competicao';
      case 'PLANTEL':
        return '/clube/elenco';
      case 'TREINO':
        return '/clube/treino';
      case 'STAFF':
        return '/clube/staff';
      case 'TORCIDA':
        return '/';
      default:
        return '/';
    }
  };

  return (
    <Link
      to={getLink()}
      onClick={onClose}
      className={cn(
        'group relative flex items-start gap-3 p-4 transition-colors cursor-pointer border-b border-linha hover:bg-linha',
        notification.read ? 'opacity-70' : '',
      )}
    >
      {/* Indicador de não lido */}
      {!notification.read && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-rua" aria-hidden />
      )}

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <p className="mb-1 font-voz text-[20px] leading-[1.05] text-papel">
          {notification.title}
        </p>
        <p className="text-xs text-mudo leading-snug line-clamp-2 mb-1.5">
          {notification.body}
        </p>
        <Hashtag className="text-mudo">#{CATEGORY_TAG[notification.category] ?? notification.category.toLowerCase()}</Hashtag>
      </div>

      {/* Seta */}
      <ChevronRight className="h-5 w-5 text-mudo group-hover:text-papel transition-colors shrink-0" />
    </Link>
  );
}

export function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inbox = useGameStore((s) => s.inbox);
  const dispatch = useGameDispatch();

  const mergeRows = useCallback(
    (rows: NotificationRow[]) => {
      for (const r of rows.slice().reverse()) {
        dispatch({ type: 'INBOX_PREPEND', item: notificationRowToInbox(r) });
      }
    },
    [dispatch],
  );
  const mergeOne = useCallback(
    (row: NotificationRow) => dispatch({ type: 'INBOX_PREPEND', item: notificationRowToInbox(row) }),
    [dispatch],
  );

  useNotificationsSync({ onNotifications: mergeRows, onIncoming: mergeOne });

  // Filtra notificações visíveis
  const notifications = inbox
    .filter((item) => !isHiddenFromHomeInboxFeed(item))
    .slice(0, 10);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão de notificações */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative flex h-10 w-10 items-center justify-center border bg-nav transition-colors',
          isOpen
            ? 'border-papel text-papel'
            : 'border-linha text-papel hover:border-papel hover:text-papel',
        )}
        aria-label={L('Notificações', 'Notifications')}
      >
        <Bell className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2.25} />

        {/* Badge de não lidas */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center bg-rua px-1 font-prova text-[10px] font-bold text-asfalto-27">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown retangular simples */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90]"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            {/* Box de notificações */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto top-16 sm:top-full sm:mt-3 w-auto sm:w-[420px] sm:max-w-[calc(100vw-2rem)] flex flex-col border-t-[5px] border-rua bg-concreto z-[100] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-linha px-5 py-3 bg-nav">
                <h3 className="font-impact text-[22px] uppercase leading-[1.1] text-papel">
                  {L('Notificações', 'Notifications')} {unreadCount > 0 && `(${unreadCount})`}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-mudo hover:text-papel transition-colors"
                  aria-label={L('Fechar', 'Close')}
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>

              {/* Lista de notificações */}
              <div className="max-h-[360px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                    <Bell className="h-10 w-10 text-mudo mb-2" strokeWidth={1.5} />
                    <p className="font-voz text-[22px] leading-none text-papel">{L('Sem notificações', 'No notifications')}</p>
                  </div>
                ) : (
                  notifications.slice(0, 5).map((notification, i) => (
                    <NotificationItem
                      key={`${notification.category}-${i}`}
                      notification={notification}
                      onClose={() => setIsOpen(false)}
                    />
                  ))
                )}
              </div>

              {/* Footer */}
              {notifications.length > 5 && (
                <div className="border-t border-linha bg-nav">
                  <Link
                    to="/"
                    onClick={() => setIsOpen(false)}
                    className="ole-num block w-full py-3 text-center text-[12px] uppercase text-mudo hover:text-papel transition-colors"
                  >
                    {L('Ver todas', 'View all')} ({notifications.length})
                  </Link>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
