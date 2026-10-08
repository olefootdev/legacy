/**
 * OLEFOOT PYTHON MODE — Badge de consequências do jogador.
 *
 * Mostra na ficha/card do jogador se ele tem alguma consequência ativa
 * (suspenso, lesionado, moral abalado, MVP em alta, etc.).
 *
 * Compacto: só badge + tempo restante. Tooltip pra detalhes.
 *
 * DS 2027: selo em contorno (sem fundo tingido), rótulo e tempo em prova.
 * Vermelho/laranja/verde só como sinal de jogo; MVP/hat-trick é respeito
 * (contorno de ouro).
 */
import { L } from '@/i18n/L';
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
        'text-baixa border-baixa',
      label: L('Suspenso', 'Suspended'),
    };
  }
  if (kind === 'injury_severe_out') {
    return {
      Icon: Activity,
      className:
        'text-baixa border-baixa',
      label: L('Lesão grave', 'Serious injury'),
    };
  }
  if (kind === 'injury_medium_out') {
    return {
      Icon: Activity,
      className:
        'text-atencao border-atencao',
      label: L('Lesão moderada', 'Moderate injury'),
    };
  }
  if (kind === 'injury_light_out') {
    return {
      Icon: Activity,
      className:
        'text-atencao border-atencao',
      label: L('Lesão leve', 'Minor injury'),
    };
  }
  if (kind === 'forced_rest') {
    return {
      Icon: Activity,
      className: 'text-suave border-linha',
      label: L('Descanso', 'Rest'),
    };
  }
  if (kind === 'morale_boost_hat_trick' || kind === 'morale_boost_mvp') {
    return {
      Icon: BadgeCheck,
      className:
        'text-ouro-27 border-ouro-27',
      label: kind === 'morale_boost_hat_trick' ? 'Hat-trick' : 'MVP',
    };
  }
  if (kind === 'market_value_boost_mvp' || kind === 'market_value_boost_hat_trick') {
    return {
      Icon: TrendingUp,
      className:
        'text-alta border-alta',
      label: L('Em alta', 'Rising'),
    };
  }
  if (kind === 'market_interest_spike') {
    return {
      Icon: TrendingUp,
      className:
        'text-alta border-alta',
      label: L('Cobiçado', 'In demand'),
    };
  }
  if (kind.startsWith('market_value_drop')) {
    return {
      Icon: TrendingDown,
      className:
        'text-baixa border-baixa',
      label: L('Valor em queda', 'Value falling'),
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
              'inline-flex items-center gap-1 border-2 px-2 py-1',
              meta.className,
            )}
            title={L(`${meta.label} · expira em ${formatTimeLeft(c.msUntilExpiry)}`, `${meta.label} · expires in ${formatTimeLeft(c.msUntilExpiry)}`)}
          >
            <meta.Icon size={10} />
            <span className="max-w-[100px] truncate font-prova text-[10px] font-bold uppercase leading-none tracking-[0.1em]">
              {meta.label}
            </span>
            <span className="font-prova text-[11px] leading-none tabular-nums opacity-70">
              {formatTimeLeft(c.msUntilExpiry)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
