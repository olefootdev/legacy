/**
 * DS 2027 · CONVOCAÇÃO DE RODADA (PDF, peça 2a) e PLACAR DE RESULTADO (2b).
 *
 * Convocação: metade de cima em rua com alambrado (é ação: escalar), o nosso
 * clube em Anton preto; corte diagonal pro asfalto, o "x" na voz e o
 * adversário em rua. Sem degradê — o corte é um polígono chapado.
 *
 * Placar: o resultado pichado em spray, nomes no grito e a frase na voz.
 * Vitória em rua, empate em papel, derrota em mudo. Sem glow.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const NOME = 'block font-impact uppercase leading-[0.86] [overflow-wrap:anywhere]';

export function Convocacao({
  rotulo,
  quando,
  casa,
  fora,
  frase,
  sub,
  acoes,
  ariaLabel,
}: {
  /** Canto esquerdo: "Rodada 01", "Liga Global · Div 3". */
  rotulo: ReactNode;
  /** Canto direito: "SÁB 12.04 · 20H", contagem ou selo ao vivo. */
  quando: ReactNode;
  casa: string;
  fora: string;
  /** Frase na voz: "Escala teu time até sexta." */
  frase?: ReactNode;
  /** Linha mono pequena embaixo da frase. */
  sub?: ReactNode;
  /** Botões (use BotaoRua). */
  acoes?: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <section aria-label={ariaLabel} className="relative flex min-w-0 flex-col overflow-hidden bg-asfalto-27">
      {/* Metade de cima: rua + alambrado + retícula */}
      <div className="relative flex min-w-0 flex-col gap-4 overflow-hidden bg-rua px-5 pb-16 pt-5 text-asfalto-27 sm:px-7 sm:pt-7">
        <span aria-hidden className="rua-alambrado absolute inset-x-0 top-0 h-40 [--alambrado:rgba(13,13,12,0.28)]" />
        <span
          aria-hidden
          className="rua-reticula absolute -bottom-6 -right-6 h-44 w-56 [--reticula:rgba(13,13,12,0.45)]"
          style={{
            WebkitMaskImage: 'radial-gradient(circle at 100% 100%, #000 0%, transparent 72%)',
            maskImage: 'radial-gradient(circle at 100% 100%, #000 0%, transparent 72%)',
          }}
        />
        <div className="relative flex min-w-0 items-center justify-between gap-3 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em]">
          <span className="min-w-0 truncate">{rotulo}</span>
          <span className="shrink-0">{quando}</span>
        </div>
        <span className={cn(NOME, 'relative')} style={{ fontSize: 'clamp(40px, 12vw, 84px)' }}>
          {casa}
        </span>
      </div>

      {/* Corte diagonal chapado (polígono, não degradê). */}
      <div aria-hidden className="relative -mt-12 h-12 w-full">
        <span className="absolute inset-0 bg-asfalto-27" style={{ clipPath: 'polygon(0 100%, 100% 0, 100% 100%)' }} />
      </div>

      {/* Metade de baixo: asfalto com grão */}
      <div className="rua-grao relative flex min-w-0 flex-col gap-4 bg-asfalto-27 px-5 pb-5 sm:px-7 sm:pb-7">
        <span
          aria-hidden
          className="-mt-10 block self-center font-voz leading-none text-papel [text-shadow:3px_3px_0_var(--color-asfalto-27)]"
          style={{ fontSize: 'clamp(54px, 14vw, 84px)' }}
        >
          x
        </span>
        <span className={cn(NOME, 'self-end text-right text-rua')} style={{ fontSize: 'clamp(40px, 12vw, 84px)' }}>
          {fora}
        </span>
        {(frase != null || acoes != null) && (
          <div className="flex min-w-0 flex-wrap items-end justify-between gap-4 pt-2">
            <div className="flex min-w-0 flex-col gap-1">
              {frase != null && <p className="font-voz text-[clamp(22px,6vw,30px)] leading-[1.05] text-papel">{frase}</p>}
              {sub != null && <p className="font-prova text-[11px] tracking-[0.08em] text-suave">{sub}</p>}
            </div>
            {acoes != null && <div className="flex min-w-0 flex-wrap items-center gap-3">{acoes}</div>}
          </div>
        )}
      </div>
    </section>
  );
}

/** Placar pichado: "3×1" em spray. `resultado` pinta do ponto de vista do manager. */
export function PlacarRua({
  golsCasa,
  golsFora,
  resultado,
  tamanho = 'grande',
  className,
}: {
  golsCasa: number;
  golsFora: number;
  resultado?: 'W' | 'D' | 'L' | null;
  tamanho?: 'grande' | 'medio' | 'pequeno';
  className?: string;
}) {
  const tom = resultado === 'W' ? 'text-rua' : resultado === 'L' ? 'text-mudo' : 'text-papel';
  const size =
    tamanho === 'grande' ? 'clamp(88px, 28vw, 168px)' : tamanho === 'medio' ? 'clamp(48px, 14vw, 80px)' : '30px';
  return (
    <span className={cn('inline-block whitespace-nowrap font-spray font-black leading-[0.85] tabular-nums', tom, className)} style={{ fontSize: size }}>
      {golsCasa}×{golsFora}
    </span>
  );
}
