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
      {/* VOLT2: etiqueta volt chapada — sem emoji e sem a cor por tier (a paleta
          não tem escala pra isso; o nome do tier já diz o degrau). */}
      <div className="ole-num inline-flex items-center self-start whitespace-nowrap bg-neon-yellow px-2 py-1 text-[11px] uppercase text-black">
        {compact ? (
          <span>TIER {tier.id}</span>
        ) : (
          <span>{tierLabel(tier)}</span>
        )}
      </div>
      {showProgress ? (
        <div className="w-full">
          <div className="h-1.5 w-full bg-card-hi">
            <div
              className="h-full bg-neon-yellow transition-all"
              style={{ width: `${Math.max(2, Math.round(progress * 100))}%` }}
            />
          </div>
          <p className="mt-1.5 truncate font-mono text-[11px] text-cimento">
            {next ? (
              <>
                {Math.round(progress * 100)}% → <span className="text-white">{next.name}</span> · {next.minExp.toLocaleString('pt-BR')} EXP
              </>
            ) : (
              <>Topo da carreira</>
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}
