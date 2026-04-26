/**
 * MarketActivityFeed — Feed minimalista de atividades do mercado
 * Substitui seção de notificações na Home (final da página)
 */
import { motion } from 'motion/react';
import { TrendingUp, Trophy, Flame, Crown, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPrice, type MarketActivity } from '@/market/socialTrade';

interface MarketActivityFeedProps {
  activities: MarketActivity[];
  maxVisible?: number;
}

function ActivityIcon({ type, isAI }: { type: MarketActivity['type']; isAI?: boolean }) {
  if (type === 'auction_won') {
    return <Trophy className="h-4 w-4 text-yellow-400" />;
  }
  if (type === 'purchase') {
    return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  }
  if (type === 'sale') {
    return <DollarSign className="h-4 w-4 text-blue-400" />;
  }
  return <Flame className="h-4 w-4 text-orange-400" />;
}

function ActivityEmoji({ type, profit }: { type: MarketActivity['type']; profit?: number }) {
  if (type === 'auction_won') return '🏆';
  if (type === 'sale' && profit && profit > 0) return '💰';
  if (type === 'purchase') return '🔥';
  return '⚡';
}

export function MarketActivityFeed({ activities, maxVisible = 5 }: MarketActivityFeedProps) {
  const visible = activities.slice(0, maxVisible);

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-white/40">Nenhuma atividade recente no mercado</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visible.map((activity, i) => (
        <motion.div
          key={activity.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className={cn(
            'group relative overflow-hidden rounded-lg border px-4 py-3 transition-all hover:border-white/20',
            activity.isAI
              ? 'border-purple-500/20 bg-purple-950/20'
              : 'border-white/10 bg-white/5',
          )}
        >
          {/* Barra lateral de cor */}
          <div
            className={cn(
              'absolute left-0 top-0 h-full w-1',
              activity.type === 'auction_won' && 'bg-yellow-400',
              activity.type === 'purchase' && 'bg-emerald-400',
              activity.type === 'sale' && 'bg-blue-400',
              activity.type === 'listing' && 'bg-orange-400',
            )}
          />

          <div className="flex items-start gap-3 pl-2">
            {/* Ícone */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/40">
              <ActivityIcon type={activity.type} isAI={activity.isAI} />
            </div>

            {/* Conteúdo */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {/* Nome do usuário */}
                  <p className="text-xs font-bold text-white/90">
                    {activity.isAI && <Crown className="mr-1 inline h-3 w-3 text-purple-400" />}
                    {activity.userName}
                  </p>

                  {/* Ação */}
                  <p className="mt-0.5 text-xs text-white/60">
                    {activity.type === 'auction_won' && 'arrematou '}
                    {activity.type === 'purchase' && 'comprou '}
                    {activity.type === 'sale' && 'vendeu '}
                    {activity.type === 'listing' && 'listou '}
                    <span className="font-semibold text-white">
                      {activity.playerName}
                    </span>
                    {' '}
                    <span className="text-white/40">
                      ({activity.playerPos}, {activity.playerOvr} OVR)
                    </span>
                  </p>

                  {/* Preço em Moret */}
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      className="text-neon-yellow"
                      style={{
                        fontFamily: 'var(--font-serif-hero)',
                        fontStyle: 'italic',
                        fontSize: '1.125rem',
                        letterSpacing: '-0.01em',
                        lineHeight: 1,
                      }}
                    >
                      {formatPrice(activity.price, activity.currency)}
                    </span>
                    {activity.profit && activity.profit > 0 && (
                      <span className="text-[10px] font-bold text-emerald-400">
                        +{formatPrice(activity.profit, activity.currency)} lucro
                      </span>
                    )}
                  </div>
                </div>

                {/* Emoji */}
                <span className="shrink-0 text-lg">
                  {ActivityEmoji({ type: activity.type, profit: activity.profit })}
                </span>
              </div>

              {/* Timestamp */}
              <p className="mt-1 text-[10px] text-white/30">
                {formatRelativeTime(activity.timestamp)}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `há ${days}d`;
  if (hours > 0) return `há ${hours}h`;
  if (minutes > 0) return `há ${minutes}m`;
  return 'agora';
}
