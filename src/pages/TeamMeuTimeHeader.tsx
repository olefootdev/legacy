import type { ReactNode } from 'react';
import { GameBannerBackdrop } from '@/components/GameBannerBackdrop';
import { L } from '@/i18n/L';

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

  // DS 2027: muro de concreto (sem canto arredondado), rótulo em prova,
  // título no grito. A foto do banner, quando existe, só escurece pra leitura.
  return (
    <div className="rua-grao relative min-w-0 overflow-hidden bg-concreto">
      <GameBannerBackdrop slot="team_header" imageOpacity={0.32} />
      <span aria-hidden className="absolute inset-y-0 left-0 w-[6px] bg-rua" />
      <div className="relative z-10 flex min-w-0 flex-col items-start gap-3 px-5 py-6 sm:px-7 sm:py-8">
        <span className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">
          — {L('#meutime', '#myteam')}
        </span>
        <h2 className="font-impact text-[clamp(34px,9vw,56px)] uppercase leading-[0.92] text-papel [overflow-wrap:anywhere]">
          {title}
        </h2>
        {subtitle != null && <div className="text-[14px] leading-relaxed text-suave">{subtitle}</div>}
        {actions && <div className="mt-1 w-full min-w-0">{actions}</div>}
      </div>
    </div>
  );
}
