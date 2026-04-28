import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * Cartão de seção para páginas de hub (MarketHub, ClubHub, CompetitionHub,
 * HelpHub). Padrão Legacy Tech:
 *  - SEM ícones pequenos: trilho lateral colorido substitui o icone-em-box
 *  - Eyebrow uppercase
 *  - Título grande (26px black uppercase)
 *  - Descrição clara
 *  - CTA texto-claro dominante (sem icone)
 *
 * Wrapper inline em MarketHub foi extraído pra cá em Sprint B.
 */
export function HubSectionCard({
  to,
  eyebrow,
  title,
  description,
  cta,
  rail,
  delay = 0,
  meta,
  badge,
  external = false,
  onClick,
}: {
  to: string;
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  cta: ReactNode;
  /** Tailwind bg-* class para o trilho lateral (raridade/categoria). */
  rail: string;
  delay?: number;
  /** Linha extra acima do CTA (ex.: "10 ativos · 3 favoritos"). */
  meta?: ReactNode;
  /** Badge no canto superior direito (ex.: "NOVO", "BETA", contador). */
  badge?: ReactNode;
  /** Link externo (abre em nova aba). */
  external?: boolean;
  onClick?: () => void;
}) {
  const className =
    'group relative isolate block h-full overflow-hidden border border-white/[0.05] transition-all duration-300 hover:border-white/15 hover:-translate-y-1';
  const style = {
    borderRadius: 'var(--radius-card)',
    background: 'var(--color-panel-elevated)',
    boxShadow: 'var(--shadow-card)',
  } as const;

  const inner = (
    <>
      {/* Trilho lateral colorido — substitui o icone-em-box pequeno */}
      <span aria-hidden className={cn('absolute left-0 top-0 h-full w-[3px]', rail)} />

      <div className="relative flex h-full flex-col gap-5 p-6 pl-7">
        {/* Linha superior: eyebrow + badge opcional */}
        <div className="flex items-start justify-between gap-3">
          <span
            className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            {eyebrow}
          </span>
          {badge ? (
            <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-white/8 px-2.5 py-1 font-display text-[9px] font-bold uppercase tracking-[0.2em] text-white/85">
              {badge}
            </span>
          ) : null}
        </div>

        {/* Título grande */}
        <h3
          className="font-display text-[26px] font-black uppercase leading-[0.95] tracking-tight text-white transition-colors group-hover:text-neon-yellow"
          style={{ letterSpacing: '0.005em' }}
        >
          {title}
        </h3>

        {/* Descrição clara */}
        <p className="text-[13px] leading-relaxed text-white/55">{description}</p>

        {/* Meta opcional */}
        {meta ? (
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
            {meta}
          </p>
        ) : null}

        {/* CTA texto-claro */}
        <div className="mt-auto pt-2 border-t border-[var(--color-divider-yellow)]">
          <span
            className="inline-flex items-center bg-neon-yellow px-6 py-3 font-display text-[11px] font-black uppercase tracking-[0.22em] text-black shadow-[0_4px_14px_rgba(253,225,0,0.18)] transition-all group-hover:bg-white group-hover:scale-[1.02]"
            style={{
              fontFamily: 'var(--font-display)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {cta}
          </span>
        </div>
      </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      {external ? (
        <a
          href={to}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          style={style}
          onClick={onClick}
        >
          {inner}
        </a>
      ) : (
        <Link to={to} className={className} style={style} onClick={onClick}>
          {inner}
        </Link>
      )}
    </motion.div>
  );
}
