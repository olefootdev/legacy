import type { ReactNode } from 'react';
import { GameBannerBackdrop } from '@/components/GameBannerBackdrop';

/**
 * Header padrão das páginas /clube/elenco · /clube/treino · /clube/staff.
 *
 * Sprint B-3 (Apr/2026): tab-bar e Veracity strip removidas — navegação
 * agora vive no /clube hub (HubSectionCards) e atalhos pontuais ficam no
 * toolbar local da página. Quando `customHero` é passado, o banner
 * default é substituído integralmente.
 */
export type TeamMeuTimeHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  /** Linha extra sob o subtítulo (ex.: botões de formação no elenco). */
  actions?: ReactNode;
  /** Hero customizado (substitui o banner padrão). Se omitido, banner default. */
  customHero?: ReactNode;
};

export function TeamMeuTimeHeader({
  title,
  subtitle,
  actions,
  customHero,
}: TeamMeuTimeHeaderProps) {
  if (customHero) return <>{customHero}</>;

  return (
    <div
      className="relative overflow-hidden border border-[var(--color-border)]"
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      <GameBannerBackdrop slot="team_header" imageOpacity={0.32} />
      <div className="relative z-10 px-5 sm:px-7 py-6 sm:py-8 flex flex-col items-start gap-3">
        {/* Eyebrow */}
        <div
          className="inline-flex items-center gap-3 text-neon-yellow"
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          <span aria-hidden className="h-px w-8 bg-neon-yellow/50" />
          <span
            className="uppercase font-semibold"
            style={{ fontSize: '10px', letterSpacing: '0.22em' }}
          >
            OLE Football · Meu Time
          </span>
        </div>
        {/* Headline — Moret italic case mixto (assinatura /legend) */}
        <h2
          className="italic text-white leading-[1.05] [overflow-wrap:anywhere]"
          style={{
            fontFamily: 'var(--font-serif-hero)',
            fontWeight: 700,
            fontSize: 'clamp(1.85rem, 4.5vw, 3rem)',
            letterSpacing: '-0.015em',
          }}
        >
          {title}
        </h2>
        {/* Régua decorativa */}
        <span aria-hidden className="block w-12 h-[3px] bg-neon-yellow" />
        {/* Subtítulo */}
        {subtitle != null && (
          <div
            className="text-white/65"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </div>
        )}
        {actions && <div className="mt-1 w-full">{actions}</div>}
      </div>
    </div>
  );
}
