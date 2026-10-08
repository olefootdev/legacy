/**
 * Legends Cup na Home 2027 — cartaz de convocação (DS, peça 2a): metade rua,
 * metade asfalto, corte diagonal. É ação, então manda a rua.
 */
import { Link } from 'react-router-dom';
import { L } from '@/i18n/L';

export function LegendsCupRua({ phase }: { phase: string | null }) {
  return (
    <Link
      to="/legends-cup"
      aria-label={phase ? L(`Legends Cup — ${phase}`, `Legends Cup — ${phase}`) : 'Legends Cup'}
      className="group flex min-w-0 flex-col overflow-hidden bg-concreto"
    >
      {/* Metade de cima em rua com o corte diagonal embaixo — cor chapada. */}
      <div className="relative flex flex-col gap-4 overflow-hidden bg-rua px-5 pb-12 pt-5 text-asfalto-27 [clip-path:polygon(0_0,100%_0,100%_calc(100%-34px),0_100%)] sm:px-6">
        <span aria-hidden className="rua-alambrado absolute inset-x-0 top-0 h-28 [--alambrado:rgba(13,13,12,0.3)]" />
        <div className="relative flex items-center justify-between font-prova text-[11.5px] font-bold uppercase tracking-[0.2em]">
          <span>{L('Mata-mata', 'Knockout')}</span>
          <span>{phase ? `#${phase.toLowerCase().replace(/\s+/g, '')}` : L('#inscrição', '#signup')}</span>
        </div>
        <span className="relative font-impact text-[clamp(48px,13.5vw,84px)] uppercase leading-[0.86]">
          Legends Cup
        </span>
      </div>

      <div className="flex items-end justify-between gap-3 px-5 pb-5 pt-1 sm:px-6">
        <span className="font-voz text-[clamp(22px,5.6vw,28px)] leading-none text-papel">
          {phase ? L('Ninguém desce o morro de graça.', 'Nobody comes down the hill for free.') : L('Escala e entra na chave.', 'Pick your XI and get in.')}
        </span>
        <span className="inline-flex min-h-[46px] shrink-0 items-center bg-rua px-4 font-impact text-[18px] uppercase leading-none text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)] transition-[transform,box-shadow] group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-[6px_6px_0_var(--color-papel)]">
          {L('Bora', 'Go')} <span aria-hidden className="ml-1.5">→</span>
        </span>
      </div>
    </Link>
  );
}
