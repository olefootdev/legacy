/**
 * ManagerMessages — a Caixa de Entrada real do manager.
 *
 * Lê o inbox de verdade do estado do jogo (state.inbox) — antes era uma lista
 * local `useState([])` que nunca populava (feature morta). Marcar como lida e
 * apagar mexem no estado real via reducer.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, X, Users, Dumbbell, Briefcase, Wallet, Shield, Trophy,
  Target, Megaphone, Building2, UserCog, TrendingUp, Swords,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useGameStore, useGameDispatch } from '@/game/store';
import type { InboxCategory, InboxItem } from '@/game/inboxTypes';
import { BackButton } from '@/components/BackButton';
import { L } from '@/i18n/L';

type MessageFilter = 'all' | 'unread';

const CATEGORY_ICON: Record<InboxCategory, LucideIcon> = {
  PLANTEL: Users,
  TREINO: Dumbbell,
  STAFF: Briefcase,
  FINANCEIRO: Wallet,
  CLUBE: Shield,
  'COMPETIÇÃO': Trophy,
  'MISSÃO': Target,
  TORCIDA: Megaphone,
  EMPRESA: Building2,
  CONTA: UserCog,
  RANKING: TrendingUp,
  DESAFIOS: Swords,
};

export function ManagerMessages() {
  const inbox = useGameStore((s) => s.inbox);
  const dispatch = useGameDispatch();
  const [filter, setFilter] = useState<MessageFilter>('all');

  const filtered = useMemo(
    () => (filter === 'unread' ? inbox.filter((m) => !m.read) : inbox),
    [inbox, filter],
  );
  const unreadCount = useMemo(() => inbox.filter((m) => !m.read).length, [inbox]);

  const markAsRead = (id: string) => dispatch({ type: 'MARK_INBOX_READ', id });
  const markAllAsRead = () => dispatch({ type: 'MARK_ALL_INBOX_READ' });
  const deleteMessage = (id: string) => dispatch({ type: 'DISMISS_INBOX_ITEM', id });

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-6 px-3 pb-10 sm:px-4">
      <BackButton to="/manager" label="Manager" />

      {/* Header — grito em Anton, contagem em spray */}
      <header className="flex min-w-0 items-end justify-between gap-3 border-b-2 border-papel pb-3">
        <div className="min-w-0">
          <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.22em] text-mudo">
            — {L('Central do Manager', 'Manager Hub')}
          </span>
          <h1 className="mt-1 font-impact uppercase leading-[0.9] text-papel" style={{ fontSize: 'clamp(44px, 13vw, 68px)' }}>
            {L('Mensagens', 'Messages')}
          </h1>
        </div>
        {unreadCount > 0 && (
          <span className="flex shrink-0 flex-col items-end gap-1 pb-1">
            <span className="font-spray font-black leading-none text-rua" style={{ fontSize: 'clamp(36px, 11vw, 56px)' }}>
              {unreadCount}
            </span>
            <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.16em] text-mudo">
              {L(`não ${unreadCount === 1 ? 'lida' : 'lidas'}`, 'unread')}
            </span>
          </span>
        )}
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist">
          {[
            { key: 'all' as const, label: L('Todas', 'All') },
            { key: 'unread' as const, label: L('Não lidas', 'Unread') },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'min-h-[40px] border-2 px-3.5 font-prova text-[12px] font-bold uppercase tracking-[0.12em] transition-colors',
                filter === f.key
                  ? 'border-rua bg-rua text-asfalto-27'
                  : 'border-linha text-mudo hover:border-fio hover:text-papel',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="min-h-[40px] font-prova text-[11.5px] font-bold uppercase tracking-[0.14em] text-rua underline decoration-2 underline-offset-4 hover:text-papel"
          >
            {L('Marcar todas como lidas', 'Mark all as read')}
          </button>
        )}
      </div>

      {/* Lista de mensagens */}
      <div className="flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-start gap-3 border-2 border-dashed border-fio px-4 py-5"
            >
              <Bell aria-hidden className="h-6 w-6 text-fio" />
              <p className="font-voz text-[24px] leading-[1.05] text-papel">
                {inbox.length === 0 ? L('Caixa vazia. Joga que o recado chega.', 'Inbox empty. Play and the news will come.') : L('Nenhuma mensagem neste filtro.', 'No messages in this filter.')}
              </p>
              {inbox.length === 0 ? (
                <Link
                  to="/"
                  className="inline-flex min-h-[46px] items-center gap-2 border-2 border-papel px-4 font-impact text-[17px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
                >
                  {L('Ir pra Home', 'Go Home')} <span aria-hidden>→</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className="inline-flex min-h-[46px] items-center gap-2 border-2 border-papel px-4 font-impact text-[17px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
                >
                  {L('Ver todas', 'See all')} <span aria-hidden>→</span>
                </button>
              )}
            </motion.div>
          ) : (
            filtered.map((msg) => (
              <MessageCard
                key={msg.id}
                msg={msg}
                onRead={() => markAsRead(msg.id)}
                onDelete={() => deleteMessage(msg.id)}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MessageCard({ msg, onRead, onDelete }: { msg: InboxItem; onRead: () => void; onDelete: () => void }) {
  const Icon = CATEGORY_ICON[msg.category] ?? Bell;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={cn(
        'relative min-w-0 border-l-[5px] bg-concreto',
        !msg.read ? 'border-rua' : 'border-linha',
      )}
    >
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 flex min-w-0 items-center gap-2 font-prova text-[10.5px] font-bold uppercase tracking-[0.16em] text-mudo">
              <Icon aria-hidden className={cn('h-3.5 w-3.5 shrink-0', !msg.read ? 'text-rua' : 'text-mudo')} strokeWidth={2.4} />
              <span className="truncate">{msg.tag}</span>
              <span aria-hidden>·</span>
              <span className="shrink-0">{msg.timeLabel}</span>
            </p>
            <h3 className={cn('min-w-0 font-voz text-[22px] leading-[1.05]', !msg.read ? 'text-papel' : 'text-suave')}>{msg.title}</h3>

            {msg.body && <p className="mt-1.5 text-[13px] leading-relaxed text-suave">{msg.body}</p>}

            {(msg.deepLink || !msg.read) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {msg.deepLink && (
                  <Link
                    to={msg.deepLink}
                    onClick={onRead}
                    className="inline-flex min-h-[40px] items-center gap-1.5 bg-rua px-3.5 font-impact text-[15px] uppercase leading-none text-asfalto-27 transition-colors hover:bg-papel"
                  >
                    {L('Ver detalhes', 'View details')} <span aria-hidden>→</span>
                  </Link>
                )}
                {!msg.read && (
                  <button
                    type="button"
                    onClick={onRead}
                    className="inline-flex min-h-[40px] items-center border-2 border-linha px-3 font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-mudo transition-colors hover:border-papel hover:text-papel"
                  >
                    {L('Marcar como lida', 'Mark as read')}
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onDelete}
            className="flex h-10 w-10 shrink-0 items-center justify-center text-mudo transition-colors hover:text-baixa"
            aria-label={L('Apagar mensagem', 'Delete message')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
