/**
 * OLEFOOT PYTHON MODE — Badge de consequências do jogador.
 *
 * Mostra na ficha/card do jogador se ele tem alguma consequência ativa
 * (suspenso, lesionado, moral abalado, MVP em alta, etc.).
 *
 * Compacto: só badge + tempo restante. Tooltip pra detalhes.
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
      className: 'bg-red-500/15 text-red-400 border-red-500/30',
      label: 'Suspenso',
    };
  }
  if (kind === 'injury_severe_out') {
    return {
      Icon: Activity,
      className: 'bg-red-600/15 text-red-500 border-red-600/30',
      label: 'Lesão grave',
    };
  }
  if (kind === 'injury_medium_out') {
    return {
      Icon: Activity,
      className: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
      label: 'Lesão moderada',
    };
  }
  if (kind === 'injury_light_out') {
    return {
      Icon: Activity,
      className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
      label: 'Lesão leve',
    };
  }
  if (kind === 'forced_rest') {
    return {
      Icon: Activity,
      className: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      label: 'Descanso',
    };
  }
  if (kind === 'morale_boost_hat_trick' || kind === 'morale_boost_mvp') {
    return {
      Icon: BadgeCheck,
      className: 'bg-neon-yellow/15 text-neon-yellow border-neon-yellow/30',
      label: kind === 'morale_boost_hat_trick' ? 'Hat-trick' : 'MVP',
    };
  }
  if (kind === 'market_value_boost_mvp' || kind === 'market_value_boost_hat_trick') {
    return {
      Icon: TrendingUp,
      className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      label: 'Em alta',
    };
  }
  if (kind === 'market_interest_spike') {
    return {
      Icon: TrendingUp,
      className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      label: 'Cobiçado',
    };
  }
  if (kind.startsWith('market_value_drop')) {
    return {
      Icon: TrendingDown,
      className: 'bg-red-500/15 text-red-400 border-red-500/30',
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

  // Ordena: indisponibilidade primeiro, depois magnitude absoluta
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
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border text-[10px] font-medium',
              meta.className,
            )}
            title={`${meta.label} · expira em ${formatTimeLeft(c.msUntilExpiry)}`}
          >
            <meta.Icon size={10} />
            <span className="truncate max-w-[90px]">{meta.label}</span>
            <span className="opacity-70">{formatTimeLeft(c.msUntilExpiry)}</span>
          </div>
        );
      })}
    </div>
  );
}
