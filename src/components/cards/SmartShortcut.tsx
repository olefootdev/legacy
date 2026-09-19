/**
 * SmartShortcut — Atalho contextual.
 *
 * VOLT2 (2026-09-19):
 * - Superfície chapada; ícone em bloco na cor do tom
 * - Sem brilho, sem pulsar, sem inclinar, sem crescer no hover
 * - No hover, só a borda acende
 */

import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface SmartShortcutProps {
  /** Ícone do atalho. */
  icon: LucideIcon;
  /** Label principal (ex: "Resgatar 3 missões"). */
  label: string;
  /** Subtítulo/descrição (ex: "+1.5K EXP prontos"). */
  sub: string;
  /** Tom de cor. */
  tone?: 'yellow' | 'fuchsia' | 'cyan' | 'emerald' | 'rose';
  /** Link de navegação (se for link). */
  to?: string;
  /** Callback de clique (se for botão). */
  onClick?: () => void;
}

/** Tons mapeados para a paleta VOLT2 — nomes mantidos por compatibilidade. */
const TONE_STYLES = {
  yellow: {
    mainBg: 'bg-panel',
    border: 'border-neon-yellow/50',
    borderHover: 'group-hover:border-neon-yellow',
    iconBg: 'bg-neon-yellow',
    iconText: 'text-black',
    text: 'text-neon-yellow',
  },
  fuchsia: {
    mainBg: 'bg-panel',
    border: 'border-lenda/50',
    borderHover: 'group-hover:border-lenda',
    iconBg: 'bg-lenda',
    iconText: 'text-white',
    text: 'text-lenda',
  },
  cyan: {
    mainBg: 'bg-panel',
    border: 'border-white/30',
    borderHover: 'group-hover:border-white',
    iconBg: 'bg-giz',
    iconText: 'text-black',
    text: 'text-giz',
  },
  emerald: {
    mainBg: 'bg-panel',
    border: 'border-alta/50',
    borderHover: 'group-hover:border-alta',
    iconBg: 'bg-alta',
    iconText: 'text-black',
    text: 'text-alta',
  },
  rose: {
    mainBg: 'bg-panel',
    border: 'border-baixa/50',
    borderHover: 'group-hover:border-baixa',
    iconBg: 'bg-baixa',
    iconText: 'text-white',
    text: 'text-baixa',
  },
};

export function SmartShortcut({
  icon: Icon,
  label,
  sub,
  tone = 'yellow',
  to,
  onClick,
}: SmartShortcutProps) {
  const style = TONE_STYLES[tone];

  const inner = (
    <>
      {/* Superfície chapada */}
      <div
        className={cn(
          'absolute inset-0',
          style.mainBg,
        )}
        aria-hidden
      />

      {/* Conteúdo */}
      <div className="relative z-10 flex items-center gap-4">
        {/* Ícone em bloco chapado */}
        <div
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center',
            style.iconBg,
            style.iconText,
          )}
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          <Icon className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        </div>

        {/* Texto */}
        <div className="min-w-0 flex-1 text-left">
          <p
            className={cn(
              'font-bold uppercase leading-tight truncate',
              style.text,
            )}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(12px, 1.3vw, 14px)',
              letterSpacing: '0.12em',
            }}
          >
            {label}
          </p>
          <p className="mt-1 text-[11px] text-white/60 leading-snug truncate">{sub}</p>
        </div>

        {/* Seta */}
        <ChevronRight
          className={cn(
            'h-5 w-5 shrink-0 transition-all duration-300',
            'group-hover:translate-x-1',
            style.text,
          )}
          aria-hidden
        />
      </div>
    </>
  );

  const baseClasses = cn(
    'group relative isolate overflow-hidden',
    'flex items-center px-5 py-4',
    'border-2 transition-colors duration-300',
    style.border,
    style.borderHover,
  );

  const baseStyle = { borderRadius: 'var(--radius-sm)' };

  if (to) {
    return (
      <Link to={to} className={baseClasses} style={baseStyle}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={baseClasses} style={baseStyle}>
      {inner}
    </button>
  );
}
