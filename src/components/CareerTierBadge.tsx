import { cn } from '@/lib/utils';
import {
  computeCareerTier,
  nextCareerTier,
  tierLabel,
  tierProgress01,
} from '@/systems/careerTiers';

export interface CareerTierBadgeProps {
  expLifetimeEarned: number;
  /** Se `true`, exibe barra de progresso pro próximo tier. */
  showProgress?: boolean;
  /** Compacto = só glyph + ID; default = glyph + nome completo. */
  compact?: boolean;
  className?: string;
}

export function CareerTierBadge({
  expLifetimeEarned,
  showProgress = false,
  compact = false,
  className,
}: CareerTierBadgeProps) {
  const tier = computeCareerTier(expLifetimeEarned);
  const next = nextCareerTier(tier.id);
  const progress = tierProgress01(expLifetimeEarned);

  return (
    <div className={cn('inline-flex flex-col gap-1', className)}>
      <div
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-display text-[10px] font-black uppercase tracking-wider',
          tier.badgeClass,
          tier.textClass,
        )}
      >
        <span className="text-[11px]">{tier.glyph}</span>
        {compact ? (
          <span>TIER {tier.id}</span>
        ) : (
          <span>{tierLabel(tier)}</span>
        )}
      </div>
      {showProgress ? (
        <div className="w-full">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={cn('h-full transition-all', tier.textClass.replace('text-', 'bg-'))}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="mt-0.5 text-[9px] text-white/40">
            {next ? (
              <>
                {Math.round(progress * 100)}% → <strong>{next.name}</strong> ({next.minExp.toLocaleString('pt-BR')} EXP)
              </>
            ) : (
              <>Máximo atingido</>
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}
