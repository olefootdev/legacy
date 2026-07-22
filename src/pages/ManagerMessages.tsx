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
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-6 pb-10">
      <BackButton to="/manager" label="Manager" />

      {/* Header */}
      <header className="text-center pt-2 pb-2">
        <div className="ole-eyebrow !text-neon-yellow mb-4">
          <span>Central do Manager</span>
        </div>
        <h1 className="leading-[0.95]">
          <span
            className="block font-bold uppercase text-white"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.25rem, 6vw, 3.5rem)',
              letterSpacing: '0.005em',
            }}
          >
            Mensagens
          </span>
          {unreadCount > 0 && (
            <span
              className="block italic text-neon-yellow mt-1"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 400,
                fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
                letterSpacing: '-0.01em',
              }}
            >
              {unreadCount} não {unreadCount === 1 ? 'lida' : 'lidas'}
            </span>
          )}
        </h1>
        <span aria-hidden className="mx-auto mt-5 block w-12 h-[3px] bg-neon-yellow" />
      </header>

      {/* Filtros */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all' as const, label: 'Todas' },
            { key: 'unread' as const, label: 'Não lidas' },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all',
                filter === f.key
                  ? 'bg-neon-yellow text-black'
                  : 'border border-white/20 bg-white/5 text-white/60 hover:border-white/30 hover:text-white',
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
            className="text-xs font-bold uppercase tracking-wider text-neon-yellow hover:text-yellow-300 transition-colors"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Lista de mensagens */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <Bell className="mx-auto h-12 w-12 text-white/20 mb-4" />
              <p className="text-sm text-white/40">
                {inbox.length === 0 ? 'Caixa vazia' : 'Nenhuma mensagem neste filtro'}
              </p>
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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'group relative overflow-hidden border transition-all',
        !msg.read ? 'border-neon-yellow/30 bg-neon-yellow/5' : 'border-white/10 bg-white/5 hover:border-white/20',
      )}
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      <span aria-hidden className={cn('absolute left-0 top-0 h-full w-1', !msg.read ? 'bg-neon-yellow' : 'bg-white/15')} />

      <div className="px-4 py-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={cn('h-4 w-4 shrink-0', msg.colorClass || 'text-white/60')} strokeWidth={2.2} />
              <h3 className="min-w-0 truncate text-sm font-bold text-white">{msg.title}</h3>
              {!msg.read && <span className="ml-auto shrink-0 h-2 w-2 rounded-full bg-neon-yellow" />}
            </div>

            {msg.body && <p className="text-xs text-white/70 leading-relaxed">{msg.body}</p>}

            <p className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/40">
              <span className="font-display font-bold">{msg.tag}</span>
              <span className="text-white/20">·</span>
              <span>{msg.timeLabel}</span>
            </p>

            <div className="mt-3 flex items-center gap-2">
              {msg.deepLink && (
                <Link
                  to={msg.deepLink}
                  onClick={onRead}
                  className="rounded-full bg-neon-yellow px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black transition-all hover:bg-yellow-300"
                >
                  Ver detalhes
                </Link>
              )}
              {!msg.read && (
                <button
                  type="button"
                  onClick={onRead}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/70 transition-all hover:border-white/30 hover:text-white"
                >
                  Marcar como lida
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onDelete}
            className="shrink-0 rounded-full p-1 text-white/40 transition-colors hover:bg-red-500/20 hover:text-red-400"
            aria-label="Apagar mensagem"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
