/**
 * TrophyCard — Card de troféu com glow e skew decorativo.
 * Usado para troféus de competição, missões e memoráveis.
 *
 * Baseado no padrão /manager, agora usando o sistema OleCard.
 */

import { Trophy, Lock } from 'lucide-react';
import { OleCard, OleCardIcon, type OleCardTone } from './OleCard';
import { cn } from '@/lib/utils';

interface TrophyCardProps {
  /** Nome do troféu. */
  name: string;
  /** Descrição/blurb. */
  description?: string;
  /** Categoria (ex: "Competição", "Missão"). */
  category?: string;
  /** Troféu conquistado? */
  earned: boolean;
  /** Tom de cor (usado quando earned). */
  tone?: OleCardTone;
  /** Callback de clique (opcional). */
  onClick?: () => void;
}

export function TrophyCard({
  name,
  description,
  category,
  earned,
  tone = 'yellow',
  onClick,
}: TrophyCardProps) {
  return (
    <OleCard
      variant={earned ? 'gradient' : 'default'}
      tone={earned ? tone : 'neutral'}
      size="sm"
      interactive={Boolean(onClick)}
      onClick={onClick}
      className={cn(
        'group flex min-h-[140px] flex-col gap-2',
        earned && 'shadow-[0_0_18px_rgba(253,225,0,0.15)]',
        !earned && 'opacity-80',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Ícone do troféu com skew */}
        <div
          className={cn(
            'flex h-10 w-10 -skew-x-6 shrink-0 items-center justify-center transition-transform group-hover:scale-110',
            earned
              ? 'bg-neon-yellow text-black'
              : 'bg-white/5 text-gray-600',
          )}
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          {earned ? (
            <Trophy className="h-5 w-5 skew-x-6" strokeWidth={2.2} />
          ) : (
            <Lock className="h-4 w-4 skew-x-6" />
          )}
        </div>

        {/* Badge de categoria */}
        {category && (
          <span
            className={cn(
              'px-1.5 py-0.5 font-display text-[8px] font-bold uppercase tracking-wider',
              earned
                ? tone === 'yellow'
                  ? 'bg-neon-yellow/20 text-neon-yellow'
                  : tone === 'cyan'
                  ? 'bg-cyan-500/20 text-cyan-200'
                  : 'bg-white/10 text-white/70'
                : 'bg-white/5 text-gray-500',
            )}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            {category}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-display text-[11px] font-bold uppercase leading-tight tracking-wide text-white">
          {name}
        </p>
        {description && (
          <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-gray-500">
            {description}
          </p>
        )}
      </div>
    </OleCard>
  );
}
