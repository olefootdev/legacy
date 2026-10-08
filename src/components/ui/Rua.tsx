/**
 * DS 2027 · "RESPEITO É OURO" — as peças da rua (olefoot-design-27/).
 *
 * Tudo que o Olefoot mostra mora na rua (muro, lambe, alambrado, adesivo); tudo
 * que mede é jogo (carta, nível, OVR). Regras que estas peças carregam:
 *   · A ESCADA: cada elemento sabe o degrau — CHÃO (cal/contorno), CORRE (rua,
 *     só onde se age), RESPEITO (asfalto + fio de ouro, valor que já existe),
 *     LENDA (ouro chapado, raro de propósito).
 *   · OURO CHAPADO: sem degradê, sem brilho, sem sombra colorida, sem neon.
 *   · Ouro e rua nunca disputam a mesma peça: um manda, o outro apoia.
 *   · Inclinação só até 6°, como lambe colado.
 *   · Tipos: A VOZ (Pirata One), O GRITO (Anton), O SPRAY (Big Shoulders
 *     Stencil), A PROVA (Geist Mono).
 */
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export type Degrau = 'chao' | 'corre' | 'respeito' | 'lenda';

/** Fundo/texto/borda de cada degrau da escada. */
export const DEGRAU_CLASSES: Record<Degrau, string> = {
  chao: 'bg-cal text-asfalto-27 border-[3px] border-dashed border-asfalto-27',
  corre: 'bg-rua text-asfalto-27',
  respeito: 'bg-asfalto-27 text-papel border-[3px] border-ouro-27',
  lenda: 'bg-ouro-27 text-asfalto-27',
};

/** Degrau da carta pelo OVR: <70 chão · 70–79 corre · 80–89 respeito · 90+ lenda. */
export function degrauDe(ovr: number): Degrau {
  if (ovr >= 90) return 'lenda';
  if (ovr >= 80) return 'respeito';
  if (ovr >= 70) return 'corre';
  return 'chao';
}

const MARCA_SRC = {
  wordmark: '/brand/olefoot-yellow-01.svg',
  escudo: '/brand/olefoot-icone-yellow-01.svg',
  nove: '/brand/2027/nove-de-respeito.png',
} as const;

function mascara(src: string): CSSProperties {
  return { WebkitMaskImage: `url('${src}')`, maskImage: `url('${src}')` };
}

/**
 * Marca recolorível (wordmark, escudo ou o 9 de respeito). A cor vem da classe
 * `bg-*` — o desenho é a máscara, então funciona em preto, rua ou ouro.
 */
export function MarcaRua({
  tipo,
  className,
  label,
}: {
  tipo: keyof typeof MARCA_SRC;
  className?: string;
  /** Sem label a marca é decorativa (aria-hidden). */
  label?: string;
}) {
  const aspect = tipo === 'wordmark' ? '947.9 / 178.6' : tipo === 'escudo' ? '180.7 / 178.6' : '596 / 842';
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('rua-mascara inline-block shrink-0', className)}
      style={{ ...mascara(MARCA_SRC[tipo]), aspectRatio: aspect }}
    />
  );
}

/** Rótulo de seção: "— MISSÕES DO DIA" em mono espaçado, com contador opcional. */
export function SecaoRua({
  label,
  aside,
  className,
}: {
  label: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 items-baseline justify-between gap-3', className)}>
      <h2 className="min-w-0 truncate font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">
        — {label}
      </h2>
      {aside != null && (
        <span className="shrink-0 font-prova text-[12px] font-bold tracking-[0.14em] text-mudo">{aside}</span>
      )}
    </div>
  );
}

type BotaoVariante = 'corre' | 'contorno' | 'ouro' | 'vazio' | 'asfalto' | 'asfalto-ouro';

const BOTAO_BASE =
  'inline-flex min-h-[52px] min-w-0 items-center justify-center gap-2 whitespace-nowrap px-6 font-impact text-[20px] uppercase leading-none transition-[transform,box-shadow,background-color,color] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rua';

const BOTAO_VARIANTE: Record<BotaoVariante, string> = {
  // A sombra dura em papel é o único "relevo" do DS: deslocada, sem blur.
  corre:
    'bg-rua text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)]',
  contorno: 'border-2 border-papel text-papel hover:bg-papel hover:text-asfalto-27',
  ouro: 'bg-ouro-27 text-asfalto-27 hover:bg-papel',
  vazio: 'border-2 border-dashed border-fio text-mudo pointer-events-none',
  // Botão preto em cima de peça amarela/cal (ex.: "ESCALAR TIME →" no ingresso).
  asfalto: 'bg-asfalto-27 text-rua hover:bg-concreto active:translate-y-px',
  // Botão preto em cima de peça de OURO (lenda): ouro e amarelo não disputam.
  'asfalto-ouro': 'bg-asfalto-27 text-ouro-27 hover:bg-concreto active:translate-y-px',
};

/** Botão do DS 2027. `to` vira Link; sem `to`, vira <button>. */
export function BotaoRua({
  children,
  variante = 'corre',
  to,
  onClick,
  disabled,
  className,
  ariaLabel,
  type = 'button',
  busy,
}: {
  children: ReactNode;
  variante?: BotaoVariante;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  type?: 'button' | 'submit';
  /** Ação em andamento: trava o botão e avisa leitor de tela. */
  busy?: boolean;
}) {
  const cls = cn(BOTAO_BASE, BOTAO_VARIANTE[variante], disabled && 'pointer-events-none opacity-40', className);
  if (to) {
    return (
      <Link to={to} className={cls} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy} aria-busy={busy || undefined} className={cls} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

type SeloTom = 'corre' | 'corre-contorno' | 'ouro' | 'ouro-contorno' | 'cal' | 'mudo';

const SELO_TOM: Record<SeloTom, string> = {
  corre: 'bg-rua text-asfalto-27 px-2.5 py-1',
  'corre-contorno': 'border-2 border-rua text-rua px-2 py-0.5',
  ouro: 'bg-ouro-27 text-asfalto-27 px-2.5 py-1',
  'ouro-contorno': 'border-2 border-ouro-27 text-ouro-27 px-2 py-0.5',
  cal: 'bg-cal text-asfalto-27 px-2.5 py-1',
  mudo: 'border-2 border-linha text-mudo px-2 py-0.5',
};

/** Selo/chip: "● AO VIVO", "+41 HOJE", "#19 NO MUNDO", "LENDA". */
export function SeloRua({ children, tom = 'corre', className }: { children: ReactNode; tom?: SeloTom; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-prova text-[12px] font-bold uppercase tracking-[0.08em]',
        SELO_TOM[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Barra de nível em segmentos (10 por padrão), cheia de rua. */
export function BarraSegmentos({
  valor,
  max,
  segmentos = 10,
  className,
  tom = 'rua',
}: {
  valor: number;
  max: number;
  segmentos?: number;
  className?: string;
  tom?: 'rua' | 'ouro';
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, valor / max)) : 0;
  const cheios = Math.round(ratio * segmentos);
  return (
    <div
      aria-hidden
      className={cn('grid h-3.5 gap-1', className)}
      style={{ gridTemplateColumns: `repeat(${segmentos}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: segmentos }, (_, i) => (
        <span key={i} className={i < cheios ? (tom === 'ouro' ? 'bg-ouro-27' : 'bg-rua') : 'bg-linha'} />
      ))}
    </div>
  );
}

/**
 * FITA — faixa amarela inclinada com as hashtags da casa, andando devagar.
 * Decorativa: o conteúdo é marca, não informação.
 */
export function FitaRua({
  tags = ['#persista', '#correloko'],
  inclinacao = -2,
  className,
}: {
  tags?: string[];
  inclinacao?: number;
  className?: string;
}) {
  // O mobile-responsive.css trava max-width em 100%: as peças que sangram
  // pra fora do container precisam de max-w-none explícito.
  // Repete o bastante pra cobrir telas largas; o trilho anda -50% e emenda.
  const linha = Array.from({ length: 8 }, () => tags).flat();
  return (
    // contain:inline-size — o trilho é larguíssimo; sem isso ele vira a largura
    // "natural" do pai e estoura containers centralizados sem w-full.
    <div aria-hidden className={cn('pointer-events-none relative max-w-none overflow-hidden [contain:inline-size]', className)}>
      <div
        className="-mx-8 flex h-11 w-[calc(100%+64px)] max-w-none items-center overflow-hidden bg-rua text-asfalto-27"
        style={{ transform: `rotate(${inclinacao}deg)` }}
      >
        <div className="rua-fita-trilho flex max-w-none shrink-0 items-center gap-9 whitespace-nowrap pl-6 font-voz text-[26px] leading-none">
          {[...linha, ...linha].map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
