/**
 * InheritanceModule — módulo "Herança" (Messi→Yamal) do layout v3.
 *
 * A passagem de era como mecânica: uma LENDA do teu plantel aponta a JOIA da
 * base como sucessora. Dados por props — Home deriva de state.players (maior
 * OVR entre isLegacy vs. joia novo_talento/mais nova). Se não houver lenda OU
 * joia, o módulo NÃO é renderizado (Home decide) — nunca inventa nome.
 */

import { ArrowRight } from 'lucide-react';

const MORET = 'var(--font-serif-hero)';

export type HeirFigure = { name: string; num: number };

export function InheritanceModule({ legend, jewel }: { legend: HeirFigure; jewel: HeirFigure }) {
  return (
    <section
      aria-label="Herança"
      className="relative overflow-hidden"
      style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(199,166,78,0.35)',
        background: 'linear-gradient(120deg, rgba(199,166,78,0.09), rgba(253,225,0,0.05))',
      }}
    >
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span className="font-impact uppercase" style={{ fontSize: '12px', color: '#C7A64E' }}>
          Herança
        </span>
        <span
          className="font-display font-black uppercase text-white/40"
          style={{ fontSize: '8.5px', letterSpacing: '0.14em' }}
        >
          quem carrega o legado
        </span>
      </div>

      <div className="flex items-stretch gap-2 px-3 pb-3 pt-2.5">
        <div className="flex-1 text-center">
          <p
            className="font-display font-black uppercase text-white/40"
            style={{ fontSize: '7.5px', letterSpacing: '0.1em' }}
          >
            A lenda
          </p>
          <p className="mt-1 truncate italic font-bold text-white" style={{ fontFamily: MORET, fontSize: '15px', lineHeight: 1 }}>
            {legend.name}
          </p>
          <p className="mt-0.5 font-impact tabular-nums" style={{ fontSize: '20px', color: '#C7A64E' }}>
            {legend.num}
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-1" style={{ color: '#C7A64E' }}>
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2.5} />
          <span
            className="font-display font-black uppercase text-white/40"
            style={{ fontSize: '6.5px', letterSpacing: '0.08em' }}
          >
            herda
          </span>
        </div>

        <div className="flex-1 text-center">
          <p
            className="font-display font-black uppercase text-white/40"
            style={{ fontSize: '7.5px', letterSpacing: '0.1em' }}
          >
            Tua joia
          </p>
          <p className="mt-1 truncate italic font-bold text-white" style={{ fontFamily: MORET, fontSize: '15px', lineHeight: 1 }}>
            {jewel.name}
          </p>
          <p className="mt-0.5 font-impact tabular-nums text-neon-yellow" style={{ fontSize: '20px' }}>
            {jewel.num}
          </p>
        </div>
      </div>
    </section>
  );
}
