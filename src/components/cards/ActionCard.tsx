/**
 * ActionCard — Card de ação com gradiente, ícone e métrica.
 * Usado em dashboards para ações principais (Carreira, Network, PRO, etc.).
 *
 * Baseado no padrão /manager, agora usando o sistema OleCard.
 */

import { ChevronRight, Lock, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  OleCard,
  OleCardHeader,
  OleCardMetric,
  OleCardFooter,
  OleCardBadge,
  OleCardIcon,
  type OleCardTone,
} from './OleCard';

interface ActionCardProps {
  /** Ícone principal do card. */
  icon: LucideIcon;
  /** Título do card (ex: "Carreira"). */
  title: string;
  /** Subtítulo/descrição (ex: "Profissional"). */
  subtitle: string;
  /** Métrica principal (ex: "1.2K EXP"). */
  metric: ReactNode;
  /** Texto do rodapé (ex: "Próximo: Campeão"). */
  footer: string;
  /** Callback de clique. */
  onClick: () => void;
  /** Tom de cor. */
  tone?: OleCardTone;
  /** Badge de notificação (ex: "3"). */
  badge?: string;
  /** Card bloqueado (mostra cadeado). */
  locked?: boolean;
}

export function ActionCard({
  icon,
  title,
  subtitle,
  metric,
  footer,
  onClick,
  tone = 'yellow',
  badge,
  locked = false,
}: ActionCardProps) {
  return (
    <OleCard
      variant="gradient"
      tone={tone}
      size="md"
      interactive
      onClick={onClick}
      className="group h-full flex flex-col gap-3"
    >
      {badge && <OleCardBadge tone="rose">{badge}</OleCardBadge>}

      <OleCardHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        tone={tone}
        badge={locked ? <Lock className="h-3 w-3 text-white/40" aria-hidden /> : undefined}
      />

      <OleCardMetric value={metric} tone={tone} />

      <OleCardFooter>
        <span className="text-[10px] text-white/45">{footer}</span>
        <ChevronRight className="h-3.5 w-3.5 text-white/30 transition-all group-hover:translate-x-1 group-hover:text-white/70" />
      </OleCardFooter>
    </OleCard>
  );
}
