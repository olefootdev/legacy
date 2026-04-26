import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, ChevronRight, Trophy, Users, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import { isHiddenFromHomeInboxFeed, type InboxItem } from '@/game/inboxTypes';

interface NotificationItemProps {
  notification: InboxItem;
  onClose: () => void;
}

function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const getIcon = () => {
    switch (notification.category) {
      case 'COMPETIÇÃO':
        return <Trophy className="h-5 w-5 text-neon-yellow" strokeWidth={2} />;
      case 'PLANTEL':
        return <Users className="h-5 w-5 text-blue-400" strokeWidth={2} />;
      case 'TREINO':
        return <TrendingUp className="h-5 w-5 text-green-400" strokeWidth={2} />;
      case 'STAFF':
        return <AlertCircle className="h-5 w-5 text-purple-400" strokeWidth={2} />;
      case 'TORCIDA':
        return <CheckCircle className="h-5 w-5 text-cyan-400" strokeWidth={2} />;
      default:
        return <Bell className="h-5 w-5 text-white/60" strokeWidth={2} />;
    }
  };

  const getLink = () => {
    if (notification.link) return notification.link;

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
        'group relative flex items-start gap-3 p-4 transition-all cursor-pointer border-b border-white/5 hover:bg-white/5',
        notification.read ? 'opacity-70' : '',
      )}
    >
      {/* Indicador de não lido */}
      {!notification.read && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-neon-yellow" aria-hidden />
      )}

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-neon-yellow mb-1 leading-tight">
          {notification.title}
        </p>
        <p className="text-xs text-gray-400 leading-snug line-clamp-2 mb-1.5">
          {notification.body}
        </p>
        <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
          {notification.category}
        </span>
      </div>

      {/* Seta */}
      <ChevronRight className="h-5 w-5 text-gray-600 group-hover:text-neon-yellow transition-colors shrink-0" />
    </Link>
  );
}

export function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inbox = useGameStore((s) => s.inbox);

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
          'relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border transition-all',
          isOpen
            ? 'border-neon-yellow/40 bg-neon-yellow/10 text-neon-yellow'
            : 'border-white/10 bg-white/5 text-white/70 hover:border-neon-yellow/40 hover:bg-neon-yellow/10 hover:text-neon-yellow',
        )}
        aria-label="Notificações"
      >
        <Bell className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2.25} />

        {/* Badge de não lidas */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 font-display text-[9px] font-black text-white">
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
              className="fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto top-16 sm:top-full sm:mt-3 w-auto sm:w-[420px] sm:max-w-[calc(100vw-2rem)] flex flex-col border border-white/10 bg-[#0a0a0a] shadow-2xl z-[100] rounded-lg overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 bg-black/40">
                <h3 className="font-display text-sm font-black uppercase tracking-wider text-white">
                  Notificações {unreadCount > 0 && `(${unreadCount})`}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-white transition-colors"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>

              {/* Lista de notificações */}
              <div className="max-h-[360px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                    <Bell className="h-10 w-10 text-gray-700 mb-2" strokeWidth={1.5} />
                    <p className="text-sm font-bold text-gray-400">Sem notificações</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Você verá suas atualizações aqui
                    </p>
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
                <div className="border-t border-white/10 bg-black/40">
                  <Link
                    to="/"
                    onClick={() => setIsOpen(false)}
                    className="block w-full py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-neon-yellow transition-colors"
                  >
                    Ver todas ({notifications.length})
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
