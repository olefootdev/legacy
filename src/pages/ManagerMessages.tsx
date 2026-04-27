/**
 * ManagerMessages — Página de mensagens do manager
 * Alertas de leilões, oportunidades, notificações do sistema
 */
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, AlertCircle, Trophy, TrendingUp, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { generateMockMessages, type ManagerMessage } from '@/market/socialTrade';
import { BackButton } from '@/components/BackButton';

type MessageFilter = 'all' | 'unread' | 'high' | 'medium' | 'low';

export function ManagerMessages() {
  const [messages, setMessages] = useState<ManagerMessage[]>(() => generateMockMessages(15));
  const [filter, setFilter] = useState<MessageFilter>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return messages;
    if (filter === 'unread') return messages.filter((m) => !m.read);
    return messages.filter((m) => m.urgency === filter);
  }, [messages, filter]);

  const unreadCount = messages.filter((m) => !m.read).length;

  const markAsRead = (id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read: true } : m)));
  };

  const markAllAsRead = () => {
    setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
  };

  const deleteMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-6 pb-10">
      <BackButton to="/" label="Home" />

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
            { key: 'high' as const, label: 'Urgente' },
            { key: 'medium' as const, label: 'Média' },
            { key: 'low' as const, label: 'Baixa' },
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
              <p className="text-sm text-white/40">Nenhuma mensagem neste filtro</p>
            </motion.div>
          ) : (
            filtered.map((msg) => (
              <motion.div
                key={msg.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  'group relative overflow-hidden rounded-lg border transition-all',
                  !msg.read
                    ? 'border-neon-yellow/30 bg-neon-yellow/5'
                    : 'border-white/10 bg-white/5 hover:border-white/20',
                )}
              >
                {/* Barra lateral de urgência */}
                <div
                  className={cn(
                    'absolute left-0 top-0 h-full w-1',
                    msg.urgency === 'high' && 'bg-red-500',
                    msg.urgency === 'medium' && 'bg-yellow-500',
                    msg.urgency === 'low' && 'bg-blue-500',
                  )}
                />

                <div className="px-4 py-4 pl-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Ícone + Título */}
                      <div className="flex items-center gap-2 mb-2">
                        {msg.type === 'auction_outbid' && (
                          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                        )}
                        {msg.type === 'auction_won' && (
                          <Trophy className="h-4 w-4 text-yellow-400 shrink-0" />
                        )}
                        {msg.type === 'opportunity' && (
                          <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
                        )}
                        {msg.type === 'system' && (
                          <Bell className="h-4 w-4 text-blue-400 shrink-0" />
                        )}

                        <h3 className="text-sm font-bold text-white">{msg.title}</h3>

                        {!msg.read && (
                          <span className="ml-auto shrink-0 h-2 w-2 rounded-full bg-neon-yellow" />
                        )}
                      </div>

                      {/* Mensagem */}
                      <p className="text-xs text-white/70 leading-relaxed">{msg.message}</p>

                      {/* Timestamp */}
                      <p className="mt-2 text-[10px] text-white/40">
                        {formatMessageTime(msg.timestamp)}
                      </p>

                      {/* Ações */}
                      <div className="mt-3 flex items-center gap-2">
                        {msg.actionUrl && (
                          <Link
                            to={msg.actionUrl}
                            className="rounded-full bg-neon-yellow px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black transition-all hover:bg-yellow-300"
                          >
                            Ver detalhes
                          </Link>
                        )}
                        {!msg.read && (
                          <button
                            type="button"
                            onClick={() => markAsRead(msg.id)}
                            className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/70 transition-all hover:border-white/30 hover:text-white"
                          >
                            Marcar como lida
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Botão deletar */}
                    <button
                      type="button"
                      onClick={() => deleteMessage(msg.id)}
                      className="shrink-0 rounded-full p-1 text-white/40 transition-colors hover:bg-red-500/20 hover:text-red-400"
                      aria-label="Deletar mensagem"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function formatMessageTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  if (hours > 0) return `há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  if (minutes > 0) return `há ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  return 'agora mesmo';
}
