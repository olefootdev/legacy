/**
 * SmartShortcut — Atalho contextual inteligente.
 * Aparece dinamicamente quando há ações relevantes (missões prontas, convites, etc.).
 *
 * Baseado no padrão /manager, agora usando o sistema OleCard.
 */

import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { OleCard, OleCardIcon, type OleCardTone } from './OleCard';

interface SmartShortcutProps {
  /** Ícone do atalho. */
  icon: LucideIcon;
  /** Label principal (ex: "Resgatar 3 missões"). */
  label: string;
  /** Subtítulo/descrição (ex: "+1.5K EXP prontos"). */
  sub: string;
  /** Tom de cor. */
  tone?: OleCardTone;
  /** Link de navegação (se for link). */
  to?: string;
  /** Callback de clique (se for botão). */
  onClick?: () => void;
}

export function SmartShortcut({
  icon,
  label,
  sub,
  tone = 'yellow',
  to,
  onClick,
}: SmartShortcutProps) {
  const inner = (
    <>
      <OleCardIcon icon={icon} tone={tone} size="md" />
      <div className="min-w-0 flex-1 text-left">
        <p className="font-display text-xs font-black uppercase tracking-wider leading-tight">
          {label}
        </p>
        <p className="mt-0.5 text-[10px] text-white/60">{sub}</p>
      </div>
      <ChevronRight
        className="h-4 w-4 shrink-0 opacity-70 transition-transform group-hover:translate-x-1"
        aria-hidden
      />
    </>
  );

  if (to) {
    return (
      <Link to={to} className="block">
        <OleCard
          variant="gradient"
          tone={tone}
          size="sm"
          interactive
          className="group flex items-center gap-3"
        >
          {inner}
        </OleCard>
      </Link>
    );
  }

  return (
    <OleCard
      variant="gradient"
      tone={tone}
      size="sm"
      interactive
      onClick={onClick}
      className="group flex items-center gap-3"
    >
      {inner}
    </OleCard>
  );
}
