/**
 * Drop de lenda — as cartas do mercado na ESCADA do DS 2027 (peça 1b).
 *
 * Cada carta sabe o degrau pelo OVR: <70 CHÃO (cal tracejado), 70–79 CORRE
 * (rua), 80–89 RESPEITO (asfalto com fio de ouro), 90+ LENDA (ouro chapado).
 * Coladas tortas como lambe (até 6°). Dado real: `legacy_players` listadas,
 * mais novas primeiro — sem drop listado, a seção some.
 */
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { DEGRAU_CLASSES, MarcaRua, SecaoRua, degrauDe, type Degrau } from '@/components/ui/Rua';
import type { LegendMini } from '@/components/home/LegendsRail';
import { posLabel } from '@/components/matchquick/posLabel';
import { L } from '@/i18n/L';

export { degrauDe };

const DEGRAU_INFO: Record<Degrau, { n: string; nome: string }> = {
  chao: { n: '01', nome: L('Chão', 'Ground') },
  corre: { n: '02', nome: L('Corre', 'Hustle') },
  respeito: { n: '03', nome: L('Respeito', 'Respect') },
  lenda: { n: '04', nome: L('Lenda', 'Legend') },
};

/** Inclinações de lambe colado — alternam pra não parecer grade. */
export const TORTO = [-3, 2.5, -1.5, 3, -2.5, 1.5];

export function DropLenda({ legends }: { legends: LegendMini[] }) {
  if (legends.length === 0) return null;
  return (
    <section aria-label={L('Drop de lenda', 'Legend drop')} className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <SecaoRua label={L('Drop de lenda · mercado', 'Legend drop · market')} />
          <h2 className="flex flex-col font-impact text-[clamp(38px,10.5vw,58px)] uppercase leading-[0.9]">
            <span className="font-voz text-[1.25em] normal-case leading-[0.9] text-papel">{L('Respeito', 'Respect')}</span>
            <span className="text-rua">{L('não se compra.', "can't be bought.")}</span>
            <span className="text-transparent [-webkit-text-stroke:1.5px_var(--color-papel)]">{L('Se conquista.', "It's earned.")}</span>
          </h2>
        </div>
      </div>

      {/* Trilho com folga vertical pra inclinação não cortar. */}
      <ul className="-mx-3 flex max-w-none snap-x snap-mandatory gap-4 overflow-x-auto px-5 py-6 [scrollbar-width:none] sm:-mx-4 sm:px-6 [&::-webkit-scrollbar]:hidden">
        {legends.map((lg, i) => (
          <li key={lg.id} className="shrink-0 snap-start">
            <CartaLenda legend={lg} torto={TORTO[i % TORTO.length]!} />
          </li>
        ))}
      </ul>

      <Link
        to="/mercado/transfer"
        className="inline-flex min-h-[44px] items-center gap-2 self-start font-impact text-[18px] uppercase text-rua hover:text-papel"
      >
        {L('Ver o mercado', 'See the market')} <span aria-hidden>→</span>
      </Link>
    </section>
  );
}

export function CartaLenda({ legend, torto = 0 }: { legend: LegendMini; torto?: number }) {
  const d = degrauDe(legend.ovr);
  const info = DEGRAU_INFO[d];
  const destaque = d === 'respeito' ? 'text-ouro-27' : '';
  return (
    <Link
      to={`/mercado/transfer?legacy=${encodeURIComponent(legend.id)}`}
      aria-label={L(`${legend.name}, OVR ${legend.ovr}, ${info.nome}`, `${legend.name}, OVR ${legend.ovr}, ${info.nome}`)}
      className={cn(
        'flex w-[176px] flex-col gap-2.5 p-3 shadow-[6px_8px_0_rgba(0,0,0,0.55)] transition-transform duration-200 hover:!rotate-0 hover:-translate-y-1',
        DEGRAU_CLASSES[d],
      )}
      style={{ transform: `rotate(${torto}deg)` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span
            className={cn(
              'font-impact text-[50px] leading-[0.85]',
              destaque,
              d === 'chao' && 'text-transparent [-webkit-text-stroke:1.5px_var(--color-asfalto-27)]',
            )}
          >
            {legend.ovr}
          </span>
          <span className={cn('mt-1 font-impact text-[14px] uppercase leading-none', destaque)}>{posLabel(legend.pos)}</span>
        </div>
        <MarcaRua tipo="escudo" className={cn('h-8', d === 'respeito' ? 'bg-ouro-27' : 'bg-asfalto-27')} />
      </div>

      <div className={cn('relative aspect-[4/5] w-full overflow-hidden', d === 'respeito' ? 'bg-concreto' : 'bg-asfalto-27/10')}>
        {legend.portraitUrl ? (
          <img
            src={legend.portraitUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 object-cover"
            style={{ width: '100%', height: '100%', maxWidth: 'none', objectPosition: '50% 14%' }}
          />
        ) : (
          <MarcaRua tipo="escudo" className="absolute left-1/2 top-1/2 h-14 -translate-x-1/2 -translate-y-1/2 bg-current opacity-30" />
        )}
        {legend.isNew && (
          <span className="absolute left-0 top-2 bg-rua px-2 py-0.5 font-impact text-[13px] uppercase text-asfalto-27">{L('Novo', 'New')}</span>
        )}
      </div>

      <span className="block min-w-0 truncate font-voz text-[25px] leading-none">{legend.name}</span>

      <div
        className={cn(
          'flex items-center justify-between px-2 py-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.14em]',
          d === 'chao' && 'border-t-2 border-dashed border-asfalto-27 px-0',
          d === 'corre' && 'bg-asfalto-27 text-rua',
          d === 'respeito' && 'border-2 border-ouro-27 text-ouro-27',
          d === 'lenda' && 'bg-asfalto-27 text-ouro-27',
        )}
      >
        <span>
          {info.n} · {info.nome}
        </span>
      </div>
    </Link>
  );
}
