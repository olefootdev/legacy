/**
 * LegendsRail — módulo "Lendas em Destaque" do layout v3.
 *
 * Rail horizontal com as lendas mais recentes do drop (legacy_players ordenadas
 * por created_at desc). Selo "Novo" nas mais recentes. Dados por props — Home
 * faz o fetch real. Se vazio → empty-state honesto (nunca lenda inventada).
 */

import { Link } from 'react-router-dom';

const MORET = 'var(--font-serif-hero)';

export type LegendMini = {
  id: string;
  name: string;
  pos: string;
  ovr: number;
  portraitUrl?: string;
  isNew: boolean;
};

export function LegendsRail({ legends }: { legends: LegendMini[] }) {
  return (
    <section aria-label="Lendas em destaque">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="font-impact uppercase text-white" style={{ fontSize: '13px', letterSpacing: '0.02em' }}>
          Lendas em destaque
        </h2>
        <Link
          to="/mercado/transfer"
          className="font-display font-black uppercase text-neon-yellow"
          style={{ fontSize: '9px', letterSpacing: '0.16em' }}
        >
          Ver todas ›
        </Link>
      </div>

      {legends.length === 0 ? (
        <div
          className="border border-[var(--color-border)] bg-dark-gray px-4 py-6 text-center"
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          <p className="text-white/55" style={{ fontFamily: 'var(--font-sans)', fontSize: '12px' }}>
            Nenhuma lenda no drop ainda.
          </p>
        </div>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {legends.map((l) => (
            <Link
              key={l.id}
              to={`/mercado/transfer?legacy=${encodeURIComponent(l.id)}`}
              className="relative w-[104px] flex-none overflow-hidden transition-transform hover:-translate-y-0.5"
              style={{ borderRadius: 'var(--radius-md)', border: '1px solid rgba(199,166,78,0.3)' }}
            >
              <div className="relative aspect-[3/4]">
                {l.portraitUrl ? (
                  <img
                    src={l.portraitUrl}
                    alt={l.name}
                    draggable={false}
                    className="absolute inset-0 h-full w-full object-cover object-top"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(70% 55% at 60% 24%, rgba(199,166,78,0.32), transparent 62%), linear-gradient(180deg,#28230f,#12100a 60%,#0c0c0c)',
                    }}
                  />
                )}
                <span
                  aria-hidden
                  className="absolute -top-2 right-1 select-none font-impact leading-[0.7] text-[rgba(199,166,78,0.18)]"
                  style={{ fontSize: '58px' }}
                >
                  {l.ovr}
                </span>
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(180deg,transparent 40%,rgba(12,12,12,0.85))' }}
                />
                {l.isNew && (
                  <span
                    className="absolute left-1.5 top-1.5 font-display font-black uppercase"
                    style={{
                      fontSize: '7px',
                      letterSpacing: '0.1em',
                      background: 'var(--color-neon-yellow)',
                      color: '#000',
                      padding: '2px 5px',
                      borderRadius: '3px',
                    }}
                  >
                    Novo
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 p-2">
                  <p
                    className="truncate italic font-bold text-white"
                    style={{ fontFamily: MORET, fontSize: '12px', lineHeight: 1 }}
                  >
                    {l.name}
                  </p>
                  <div className="mt-0.5 flex items-center justify-between">
                    <span
                      className="font-display font-black uppercase"
                      style={{ fontSize: '7px', letterSpacing: '0.1em', color: 'var(--gold, #C7A64E)' }}
                    >
                      {l.pos}
                    </span>
                    <span className="font-impact tabular-nums text-neon-yellow" style={{ fontSize: '15px' }}>
                      {l.ovr}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
