/**
 * OLEFOOT PYTHON MODE — Badge de consequências do jogador.
 *
 * Mostra na ficha/card do jogador se ele tem alguma consequência ativa
 * (suspenso, lesionado, moral abalado, MVP em alta, etc.).
 *
 * Compacto: só badge + tempo restante. Tooltip pra detalhes.
 *
 * Tipografia Legacy Tech: Agency 800 uppercase tracking-wide nos labels,
 * Moret italic tabular-nums no tempo. Cores via tokens (--color-danger /
 * --color-warning / --color-success / --color-neon-yellow).
 */
import { ShieldOff, Activity, TrendingUp, TrendingDown, BadgeCheck } from 'lucide-react';
import { usePlayerConsequences } from '@/hooks/useConsequences';
import { cn } from '@/lib/utils';
import type { EvaluatedConsequence } from '@/systems/consequences/types';

function formatTimeLeft(ms: number): string {
  if (ms < 60_000) return '<1m';
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

interface BadgeMeta {
  Icon: typeof ShieldOff;
  className: string;
  label: string;
}

function getBadgeMeta(c: EvaluatedConsequence): BadgeMeta | null {
  const kind = c.consequence.kind;
  if (kind === 'red_card_suspension' || kind === 'red_card_suspension_repeat') {
    return {
      Icon: ShieldOff,
      className:
        'bg-[var(--color-danger)]/12 text-[var(--color-danger)] border-[var(--color-danger)]/35',
      label: 'Suspenso',
    };
  }
  if (kind === 'injury_severe_out') {
    return {
      Icon: Activity,
      className:
        'bg-[var(--color-danger)]/15 text-[var(--color-danger)] border-[var(--color-danger)]/40',
      label: 'Lesão grave',
    };
  }
  if (kind === 'injury_medium_out') {
    return {
      Icon: Activity,
      className:
        'bg-[var(--color-warning)]/12 text-[var(--color-warning)] border-[var(--color-warning)]/35',
      label: 'Lesão moderada',
    };
  }
  if (kind === 'injury_light_out') {
    return {
      Icon: Activity,
      className:
        'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/30',
      label: 'Lesão leve',
    };
  }
  if (kind === 'forced_rest') {
    return {
      Icon: Activity,
      className: 'bg-white/5 text-white/75 border-white/15',
      label: 'Descanso',
    };
  }
  if (kind === 'morale_boost_hat_trick' || kind === 'morale_boost_mvp') {
    return {
      Icon: BadgeCheck,
      className:
        'bg-neon-yellow/12 text-neon-yellow border-neon-yellow/35 shadow-[0_0_10px_rgba(253,225,0,0.18)]',
      label: kind === 'morale_boost_hat_trick' ? 'Hat-trick' : 'MVP',
    };
  }
  if (kind === 'market_value_boost_mvp' || kind === 'market_value_boost_hat_trick') {
    return {
      Icon: TrendingUp,
      className:
        'bg-[var(--color-success)]/12 text-[var(--color-success)] border-[var(--color-success)]/35',
      label: 'Em alta',
    };
  }
  if (kind === 'market_interest_spike') {
    return {
      Icon: TrendingUp,
      className:
        'bg-[var(--color-success)]/12 text-[var(--color-success)] border-[var(--color-success)]/35',
      label: 'Cobiçado',
    };
  }
  if (kind.startsWith('market_value_drop')) {
    return {
      Icon: TrendingDown,
      className:
        'bg-[var(--color-danger)]/12 text-[var(--color-danger)] border-[var(--color-danger)]/35',
      label: 'Valor em queda',
    };
  }
  return null;
}

interface Props {
  playerId: string | undefined;
  /** Mostra só o badge mais grave (compact) ou todos. */
  compact?: boolean;
}

export function PlayerConsequencesBadge({ playerId, compact = true }: Props) {
  const consequences = usePlayerConsequences(playerId);
  if (!consequences.length) return null;

  const sorted = [...consequences].sort((a, b) => {
    const aIsUnavail = a.consequence.dimension === 'physical' && a.currentValue > 0;
    const bIsUnavail = b.consequence.dimension === 'physical' && b.currentValue > 0;
    if (aIsUnavail !== bIsUnavail) return aIsUnavail ? -1 : 1;
    return Math.abs(b.currentValue) - Math.abs(a.currentValue);
  });

  const visible = compact ? sorted.slice(0, 1) : sorted.slice(0, 3);

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((c) => {
        const meta = getBadgeMeta(c);
        if (!meta) return null;
        return (
          <div
            key={c.consequence.id}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 border',
              meta.className,
            )}
            style={{ borderRadius: 'var(--radius-sm)' }}
            title={`${meta.label} · expira em ${formatTimeLeft(c.msUntilExpiry)}`}
          >
            <meta.Icon size={10} />
            <span
              className="truncate max-w-[100px] leading-none"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '9px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
              }}
            >
              {meta.label}
            </span>
            <span
              className="tabular-nums opacity-70 leading-none"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontStyle: 'italic',
                fontWeight: 700,
                fontSize: '11px',
                letterSpacing: '-0.02em',
              }}
            >
              {formatTimeLeft(c.msUntilExpiry)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
