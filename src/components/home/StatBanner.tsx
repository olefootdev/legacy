/**
 * StatBanner — banner compacto padrão da Home (Legacy Tech).
 *
 * Extraído do PassiveIncomeWidget / LoginBonusWidget (referências do fundador):
 * rail amarelo 3px + ícone quadrado tintado + eyebrow Agency (label · meta) +
 * valor Moret italic + sub-linha + CTA/right-slot opcional. Unifica Coroa do Dia,
 * Engajamento, Desafio Diário e afins num só ritmo visual.
 */

import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export type StatBannerTone = 'yellow' | 'cyan' | 'green' | 'neutral';

const TONES: Record<StatBannerTone, { rail: string; accent: string; iconBg: string; iconBorder: string }> = {
  yellow: { rail: 'var(--color-neon-yellow)', accent: 'var(--color-neon-yellow)', iconBg: 'rgba(253,225,0,0.12)', iconBorder: 'rgba(253,225,0,0.35)' },
  cyan: { rail: 'rgba(34,211,238,0.5)', accent: '#67e8f9', iconBg: 'rgba(6,182,212,0.10)', iconBorder: 'rgba(6,182,212,0.30)' },
  green: { rail: 'rgba(74,222,128,0.6)', accent: 'var(--color-success)', iconBg: 'rgba(74,222,128,0.10)', iconBorder: 'rgba(74,222,128,0.30)' },
  neutral: { rail: 'var(--color-border)', accent: 'rgba(255,255,255,0.5)', iconBg: 'rgba(255,255,255,0.05)', iconBorder: 'rgba(255,255,255,0.12)' },
};

interface StatBannerProps {
  icon: ReactNode;
  /** Agency uppercase: "Coroa do dia · status". */
  eyebrow: string;
  /** Valor protagonista (Moret italic). */
  value: ReactNode;
  /** Linha menor de contexto (branco/40). */
  sub?: string;
  tone?: StatBannerTone;
  /** Realça com glow (banner "ativo"/claimable). */
  glow?: boolean;
  /** Botão de ação (pílula amarela) — não dispara o onClick do banner. */
  cta?: { label: string; onClick: () => void };
  /** Slot custom à direita (ex.: número/anel). Ignora a seta. */
  rightSlot?: ReactNode;
  /** Clica o banner inteiro. */
  onClick?: () => void;
}

export function StatBanner({ icon, eyebrow, value, sub, tone = 'neutral', glow, cta, rightSlot, onClick }: StatBannerProps) {
  const t = TONES[tone];
  const inner = (
    <div className="px-4 py-3.5 flex items-center gap-3">
      <div
        className="shrink-0 w-11 h-11 grid place-items-center border"
        style={{ backgroundColor: t.iconBg, borderColor: t.iconBorder, color: t.accent, borderRadius: 'var(--radius-sm)' }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span aria-hidden className="block h-px w-4" style={{ backgroundColor: t.accent, opacity: 0.55 }} />
          <span
            className="truncate"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '9px', letterSpacing: '0.32em', textTransform: 'uppercase', color: t.accent }}
          >
            {eyebrow}
          </span>
        </div>
        <div
          className="mt-1 text-white truncate leading-tight"
          style={{ fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(15px, 2.6vw, 18px)', letterSpacing: '-0.02em' }}
        >
          {value}
        </div>
        {sub && <p className="text-[10px] text-white/40 mt-0.5 truncate">{sub}</p>}
      </div>
      {rightSlot}
      {cta && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); cta.onClick(); }}
          className="shrink-0 bg-neon-yellow text-deep-black px-4 py-2 hover:bg-white transition-colors"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', borderRadius: 'var(--radius-sm)' }}
        >
          {cta.label}
        </button>
      )}
      {onClick && !cta && !rightSlot && <ChevronRight className="w-5 h-5 text-white/30 shrink-0" strokeWidth={2.5} aria-hidden />}
    </div>
  );

  const style = {
    borderRadius: 'var(--radius-md)',
    borderLeftColor: t.rail,
    borderColor: 'rgba(255,255,255,0.10)',
    boxShadow: glow ? '0 8px 24px rgba(0,0,0,0.18), 0 0 18px rgba(253,225,0,0.12)' : '0 8px 24px rgba(0,0,0,0.18)',
  } as const;
  const cls = 'relative w-full bg-[var(--color-card)] border border-l-[3px] overflow-hidden text-left';

  return onClick ? (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.99 }} className={cls} style={style}>
      {inner}
    </motion.button>
  ) : (
    <div className={cls} style={style}>{inner}</div>
  );
}
