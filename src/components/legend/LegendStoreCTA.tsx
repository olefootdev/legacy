/**
 * LegendStoreCTA — banner editorial no rodapé levando o manager pra Store.
 * Reutilizável: passa nome + slug.
 */
import { Link } from 'react-router-dom';
import { Hashtag } from '@/components/ui';
import { L } from '@/i18n/L';

interface LegendStoreCTAProps {
  legendName: string;
  storeHighlightId?: string;
}

export function LegendStoreCTA({ legendName, storeHighlightId }: LegendStoreCTAProps) {
  const href = storeHighlightId
    ? `/mercado/loja?tab=legacies&legend=${storeHighlightId}`
    : `/mercado/loja?tab=legacies`;

  return (
    <section aria-label={L('Garanta sua lenda', 'Get your legend')} className="px-5 pb-12 sm:px-8 sm:pb-16">
      {/* DS 2027 · drop de lenda: asfalto com fio de ouro; a ação é rua. */}
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-5 border-[3px] border-ouro-27 bg-asfalto-27 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <div className="flex min-w-0 flex-col gap-2">
          <Hashtag className="font-bold uppercase tracking-[0.18em] text-ouro-27">{L('— Loja · legacy', '— Store · legacy')}</Hashtag>
          <h2 className="font-impact uppercase leading-[0.9] text-papel" style={{ fontSize: 'clamp(40px, 9vw, 64px)' }}>
            {L('Garanta teu legacy', 'Get your legacy')}
          </h2>
          <p className="truncate font-voz text-[clamp(24px,6vw,32px)] leading-none text-ouro-27">
            {L(`A carta de ${legendName}.`, `The ${legendName} card.`)}
          </p>
        </div>
        <Link
          to={href}
          className="inline-flex min-h-[56px] shrink-0 items-center gap-2 whitespace-nowrap bg-rua px-7 font-impact text-[21px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)]"
        >
          {L('Ver na loja', 'View in store')} <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
