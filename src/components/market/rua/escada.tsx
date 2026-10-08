/**
 * Peças do MERCADO DE CARTAS na régua DS 2027 · "RESPEITO É OURO".
 *
 * A carta sabe o degrau pelo OVR (docs/DS-2027.md §1):
 *   <70 CHÃO (cal tracejado) · 70–79 CORRE (rua) · 80–89 RESPEITO (asfalto +
 *   fio de ouro) · 90+ LENDA (ouro chapado).
 * Cada degrau tem um botão que não briga com a carta: em cima de rua/cal/ouro
 * o botão é asfalto; na carta de RESPEITO quem manda é o ouro, então o botão
 * é ouro chapado — nunca amarelo e ouro disputando a mesma peça.
 *
 * Tudo aqui é pele: nenhuma peça lê estado do jogo.
 */
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';
import type { Degrau } from '@/components/ui/Rua';

export type { Degrau };

export function degrauDe(ovr: number): Degrau {
  if (ovr >= 90) return 'lenda';
  if (ovr >= 80) return 'respeito';
  if (ovr >= 70) return 'corre';
  return 'chao';
}

export const DEGRAU_INFO: Record<Degrau, { n: string; nome: string }> = {
  chao: { n: '01', nome: L('Chão', 'Ground') },
  corre: { n: '02', nome: L('Corre', 'Hustle') },
  respeito: { n: '03', nome: L('Respeito', 'Respect') },
  lenda: { n: '04', nome: L('Lenda', 'Legend') },
};

/** Inclinações de lambe colado — alternam pra parede não parecer grade. */
export const TORTO = [-2.5, 2, -1.5, 2.5, -2, 1.5];

/** Cor do OVR dentro da carta (vazado no CHÃO, ouro no RESPEITO). */
export function ovrClasses(d: Degrau): string {
  if (d === 'chao') return 'text-transparent [-webkit-text-stroke:1.5px_var(--color-asfalto-27)]';
  if (d === 'respeito') return 'text-ouro-27';
  return '';
}

/** Faixa de rodapé "02 · CORRE" — a carteirinha de cada degrau. */
export function faixaClasses(d: Degrau): string {
  return cn(
    'flex min-w-0 items-center justify-between gap-2 font-prova text-[10.5px] font-bold uppercase tracking-[0.14em]',
    d === 'chao' && 'border-t-2 border-dashed border-asfalto-27 pt-1.5',
    d === 'corre' && 'bg-asfalto-27 px-2 py-1.5 text-rua',
    d === 'respeito' && 'border-2 border-ouro-27 px-2 py-1 text-ouro-27',
    d === 'lenda' && 'bg-asfalto-27 px-2 py-1.5 text-ouro-27',
  );
}

/** Botão de ação dentro da carta, por degrau. */
export function ctaCartaClasses(d: Degrau): string {
  return cn(
    'flex min-h-11 w-full min-w-0 items-center justify-center gap-2 px-3 font-impact text-[16px] uppercase leading-none transition-transform [-webkit-tap-highlight-color:transparent] hover:-translate-y-0.5 active:translate-y-px',
    d === 'chao' && 'bg-asfalto-27 text-papel',
    d === 'corre' && 'bg-asfalto-27 text-rua',
    d === 'respeito' && 'bg-ouro-27 text-asfalto-27',
    d === 'lenda' && 'bg-asfalto-27 text-ouro-27',
  );
}

/** Fundo da janela da foto dentro da carta. */
export function fotoFundo(d: Degrau): string {
  return d === 'respeito' ? 'bg-concreto' : 'bg-asfalto-27/10';
}

/** Selo pequeno em cima da foto (moeda, raridade). Sempre asfalto: lê em qualquer foto. */
export const SELO_FOTO =
  'inline-flex shrink-0 items-center whitespace-nowrap bg-asfalto-27 px-1.5 py-0.5 font-prova text-[9.5px] font-bold uppercase tracking-[0.1em] text-papel';

/** Barra em segmentos com cor livre (a BarraSegmentos do ui some em cima de amarelo). */
export function Segmentos({
  valor,
  max,
  segmentos = 10,
  cheio,
  vazio,
  className,
}: {
  valor: number;
  max: number;
  segmentos?: number;
  cheio: string;
  vazio: string;
  className?: string;
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, valor / max)) : 0;
  const n = Math.round(ratio * segmentos);
  return (
    <div
      aria-hidden
      className={cn('grid h-2.5 gap-[3px]', className)}
      style={{ gridTemplateColumns: `repeat(${segmentos}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: segmentos }, (_, i) => (
        <span key={i} className={i < n ? cheio : vazio} />
      ))}
    </div>
  );
}

/** Linha de atributo da ficha: rótulo prova · 10 segmentos · número Anton. */
export function AtributoRua({ label, value, largo = false }: { label: string; value: number; largo?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={cn(
          'shrink-0 truncate font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-mudo',
          largo ? 'w-24' : 'w-9',
        )}
      >
        {label}
      </span>
      <Segmentos valor={value} max={100} cheio="bg-rua" vazio="bg-linha" className="min-w-0 flex-1" />
      <span className="w-8 shrink-0 text-right font-impact text-[20px] leading-none tabular-nums text-papel">{value}</span>
    </div>
  );
}

/** Estado vazio no degrau CHÃO: tracejado, número vazado, voz curta. */
export function VazioRua({ titulo, linha, className }: { titulo: string; linha?: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 border-2 border-dashed border-fio px-5 py-12 text-center',
        className,
      )}
    >
      <span
        aria-hidden
        className="font-impact text-[64px] leading-none text-transparent [-webkit-text-stroke:1.5px_var(--color-fio)]"
      >
        0
      </span>
      <p className="font-voz text-[28px] leading-none text-papel">{titulo}</p>
      {linha ? <p className="max-w-sm font-prova text-[11.5px] uppercase tracking-[0.14em] text-mudo">{linha}</p> : null}
    </div>
  );
}

/** Botão fechar dos modais do mercado: quadrado, contorno, sem arredondar. */
export const FECHAR_RUA =
  'grid h-10 w-10 shrink-0 place-items-center border-2 border-linha text-suave transition-colors hover:border-papel hover:text-papel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rua';

/** Campo de texto/numero no concreto, foco em rua. */
export const CAMPO_RUA =
  'w-full min-w-0 border-2 border-linha bg-concreto px-3 py-3 text-[15px] text-papel outline-none transition-colors placeholder:text-fio focus:border-rua';

/** Rótulo de campo "— NOME" em mono. */
export const ROTULO_RUA = 'block font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo';

/** Botão principal de ação (rua + sombra dura de papel). Pode quebrar linha no 375. */
export const ACAO_RUA =
  'inline-flex min-h-[52px] w-full min-w-0 items-center justify-center gap-2 bg-rua px-4 py-3 text-center font-impact text-[19px] uppercase leading-[1.05] text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rua';

/** Mesma ação, em ouro chapado (compra de LENDA). Sombra dura em papel, sem brilho. */
export const ACAO_OURO =
  'inline-flex min-h-[52px] w-full min-w-0 items-center justify-center gap-2 bg-ouro-27 px-4 py-3 text-center font-impact text-[19px] uppercase leading-[1.05] text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ouro-27';

/** Ação secundária: contorno de papel. */
export const ACAO_CONTORNO =
  'inline-flex min-h-[48px] w-full min-w-0 items-center justify-center gap-2 border-2 border-papel px-4 py-2.5 text-center font-impact text-[17px] uppercase leading-[1.05] text-papel transition-colors hover:bg-papel hover:text-asfalto-27 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rua';
