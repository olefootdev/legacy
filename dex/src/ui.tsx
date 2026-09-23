/**
 * Os poucos pedaços de UI que as telas dividem. VOLT2: chapado, 0 raio.
 *
 * A LOGO MORA AQUI, na barra, e por isso aparece em toda etapa — criar, frase,
 * senha, trancada, conectar. Numa carteira isso não é vaidade de marca: a tela
 * que pede senha e a que pede assinatura são exatamente as que um clone tenta
 * imitar, e a marca no mesmo lugar em todas é parte do que a pessoa reconhece.
 * Se fosse colada tela a tela, uma ia ficar de fora.
 */
import type { ReactNode } from 'react';
import { useIdioma } from '@/i18n/useIdioma';

export const BOTAO_VOLT =
  'flex h-[52px] w-full items-center justify-center bg-neon-yellow px-4 font-num text-[13px] font-extrabold uppercase tracking-[0.04em] text-deep-black disabled:opacity-40';
export const BOTAO_LINHA =
  'flex h-[52px] w-full items-center justify-center border border-white/30 px-4 font-num text-[13px] font-extrabold uppercase tracking-[0.04em] text-white disabled:opacity-40';
export const CAMPO =
  'h-12 w-full border border-white/10 bg-panel px-3 font-mono text-[14px] text-white outline-none focus:border-neon-yellow';

export const Logo = ({ altura = 26 }: { altura?: number }) => (
  <img
    src="/brand/olefoot-yellow-01.svg"
    alt="OLEFOOT"
    className="block shrink-0 self-start"
    style={{ height: altura, width: altura * 5.31 }}
  />
);

/** PT | EN. Dois caracteres cada, sem bandeirinha — bandeira não é idioma. */
export function Idiomas() {
  const [idioma, setIdioma] = useIdioma();
  return (
    <div className="flex shrink-0 items-center gap-1 font-mono text-[11px]">
      {(['pt', 'en'] as const).map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => setIdioma(i)}
          aria-pressed={idioma === i}
          className={`px-1.5 py-0.5 uppercase ${idioma === i ? 'text-neon-yellow' : 'text-poeira hover:text-cimento'}`}
        >
          {i}
        </button>
      ))}
    </div>
  );
}

export function Barra({ titulo, onVoltar }: { titulo?: string; onVoltar?: () => void }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2.5 bg-nav px-3">
      {onVoltar && (
        <button type="button" onClick={onVoltar} aria-label="Voltar"
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/15 text-white">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      )}
      <img src="/brand/olefoot-yellow-01.svg" alt="OLEFOOT"
        className="block shrink-0" style={{ height: 17, width: 90 }} />
      {titulo && (
        <span className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-poeira">{titulo}</span>
      )}
      <span className="flex-grow" />
      <Idiomas />
    </div>
  );
}

export function Aviso({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <div className="border-l-[3px] border-atencao bg-sheet px-3.5 py-3">
      {titulo && <p className="font-num text-[11px] font-extrabold uppercase tracking-[0.04em] text-atencao">{titulo}</p>}
      <p className="mt-1 text-[12px] leading-relaxed text-giz">{children}</p>
    </div>
  );
}
