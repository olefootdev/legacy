/**
 * Headline de seção da Store — padrão BVB sem ícones.
 *
 * Uso:
 *   <StoreSectionHeadline
 *     title="DESTAQUES DA SEMANA"
 *     subtitle="Cartas em destaque pelo overall e buzz do mercado."
 *     rightLabel="+5 mais"
 *   />
 *
 * Visual:
 *   - Título: Agency caps amarelo, tracking-widest
 *   - Subtítulo: text-soft, leading-snug abaixo
 *   - rightLabel (opcional): pill outline no canto direito
 *   - Sem ícone, sem badge colorido — minimalismo BVB
 *   - variant='moret': Título em Moret italic com glow pulsante para seções premium
 */

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface StoreSectionHeadlineProps {
  title: string;
  subtitle?: string;
  /** Texto da pílula no canto direito (ex: "+5 mais", "VER TUDO"). */
  rightLabel?: string;
  /** Click handler na pílula. Se omitido, pill é só informativa. */
  onRightClick?: () => void;
  className?: string;
  /** Variante visual: 'default' (Agency FB) ou 'moret' (Moret italic para seções premium) */
  variant?: 'default' | 'moret';
}

export function StoreSectionHeadline({
  title,
  subtitle,
  rightLabel,
  onRightClick,
  className,
  variant = 'default',
}: StoreSectionHeadlineProps) {
  if (variant === 'moret') {
    return (
      <header className={cn('flex items-start justify-between gap-3 px-0.5', className)}>
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Barra vertical com glow */}
          <motion.span
            animate={{
              boxShadow: [
                '0 0 10px rgba(253,225,0,0.4)',
                '0 0 20px rgba(253,225,0,0.7)',
                '0 0 10px rgba(253,225,0,0.4)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            aria-hidden
            className="block w-[3px] h-10 bg-neon-yellow shrink-0"
          />
          <div className="min-w-0 flex-1">
            {/* Título em Moret italic */}
            <h2
              className="text-neon-yellow leading-tight"
              style={{
                fontFamily: 'var(--font-serif-hero)', // Moret
                fontStyle: 'italic',
                fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                letterSpacing: '-0.01em',
              }}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-[11px] sm:text-[12px] leading-snug text-text-soft">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {rightLabel && (
          <button
            type="button"
            onClick={onRightClick}
            className="shrink-0 inline-flex items-center border border-neon-yellow/40 hover:border-neon-yellow hover:bg-neon-yellow/10 text-neon-yellow px-3 py-1.5 font-display font-bold uppercase tracking-[0.18em] text-[10px] sm:text-[11px] rounded-sm transition-colors"
          >
            {rightLabel}
          </button>
        )}
      </header>
    );
  }

  return (
    <header className={cn('flex items-start justify-between gap-3 px-0.5', className)}>
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Barra vertical amarela — assinatura BVB */}
        <span aria-hidden className="block w-[3px] h-7 sm:h-8 bg-neon-yellow shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[15px] sm:text-[17px] font-black uppercase tracking-[0.2em] text-neon-yellow leading-tight">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-[11px] sm:text-[12px] leading-snug text-text-soft">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {rightLabel ? (
        onRightClick ? (
          <button
            type="button"
            onClick={onRightClick}
            className="shrink-0 inline-flex items-center border border-white/20 hover:border-neon-yellow hover:text-neon-yellow text-white/70 px-3 py-1.5 font-display font-bold uppercase tracking-[0.18em] text-[10px] sm:text-[11px] rounded-sm transition-colors"
          >
            {rightLabel}
          </button>
        ) : (
          <span className="shrink-0 inline-flex items-center border border-white/20 text-white/70 px-3 py-1.5 font-display font-bold uppercase tracking-[0.18em] text-[10px] sm:text-[11px] rounded-sm">
            {rightLabel}
          </span>
        )
      ) : null}
    </header>
  );
}
