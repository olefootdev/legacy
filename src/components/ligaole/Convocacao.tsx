/**
 * CONVOCAÇÃO — o confronto do mata-mata como cartaz de rodada (DS 2027,
 * peça 2a "convocação de rodada"). Metade de cima em rua com alambrado e
 * retícula (é ação: o jogo vai rolar), corte diagonal, o "x" na VOZ em papel
 * em cima do corte, e o adversário em rua sobre asfalto, alinhado à direita.
 *
 * Usado pela Liga Ole e pela Legends Cup. Presentational puro: recebe nomes e
 * meta já resolvidos — nenhum dado é inventado aqui.
 */
import type { ReactNode } from 'react';

const NOME = 'block font-impact uppercase leading-[0.86] [overflow-wrap:anywhere]';
const NOME_SIZE = { fontSize: 'clamp(40px, 12vw, 76px)' } as const;

export function Convocacao({
  kicker,
  aside,
  home,
  homeMeta,
  away,
  awayMeta,
  tag,
  ariaLabel,
  children,
}: {
  /** Rótulo do topo esquerdo — "Liga Ole · Oitavas". */
  kicker: string;
  /** Rótulo do topo direito — "Rodada 2 de 3", "Força 82". */
  aside?: string | null;
  home: string;
  homeMeta?: string | null;
  away: string;
  awayMeta?: string | null;
  /** Adesivo extra colado no corte (ex.: "Revanche"). */
  tag?: ReactNode;
  ariaLabel: string;
  /** Rodapé do cartaz (frase do técnico rival, prêmio…). */
  children?: ReactNode;
}) {
  return (
    <section aria-label={ariaLabel} className="flex min-w-0 flex-col overflow-hidden bg-concreto">
      {/* Metade de cima: rua chapada, corte diagonal embaixo. */}
      <div className="relative flex min-w-0 flex-col gap-4 overflow-hidden bg-rua px-5 pb-14 pt-5 text-asfalto-27 [clip-path:polygon(0_0,100%_0,100%_calc(100%-44px),0_100%)] sm:px-7">
        <span aria-hidden className="rua-alambrado absolute inset-x-0 top-0 h-32 [--alambrado:rgba(13,13,12,0.28)]" />
        <span
          aria-hidden
          className="rua-reticula absolute -bottom-2 right-0 h-40 w-48 [--reticula:rgba(13,13,12,0.45)]"
          style={{
            WebkitMaskImage: 'radial-gradient(circle at 100% 100%, #000 0%, transparent 70%)',
            maskImage: 'radial-gradient(circle at 100% 100%, #000 0%, transparent 70%)',
          }}
        />
        <div className="relative flex min-w-0 items-center justify-between gap-3 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em]">
          <span className="min-w-0 truncate">{kicker}</span>
          {aside && <span className="shrink-0">{aside}</span>}
        </div>
        <div className="relative flex min-w-0 flex-col gap-1.5">
          <span className={NOME} style={NOME_SIZE}>
            {home}
          </span>
          {homeMeta && <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.16em]">{homeMeta}</span>}
        </div>
      </div>

      {/* Metade de baixo: asfalto, o "x" em cima do corte e o adversário em rua. */}
      <div className="rua-grao relative flex min-w-0 flex-col items-end gap-1.5 px-5 pb-5 text-right sm:px-7">
        <span
          aria-hidden
          className="-mt-14 mr-auto block font-voz text-[clamp(64px,17vw,96px)] leading-none text-papel [text-shadow:4px_4px_0_var(--color-asfalto-27)]"
        >
          x
        </span>
        {tag && <div className="-mt-6 mb-1">{tag}</div>}
        <span className={`${NOME} max-w-full text-rua`} style={NOME_SIZE}>
          {away}
        </span>
        {awayMeta && <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.16em] text-mudo">{awayMeta}</span>}
        {children && <div className="mt-4 w-full text-left">{children}</div>}
      </div>
    </section>
  );
}
