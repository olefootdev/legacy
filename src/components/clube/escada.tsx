/**
 * Peças da ESCADA do DS 2027 usadas na área CLUBE (elenco, treino, staff,
 * academia, valores, estruturas).
 *
 *   <70 CHÃO · 70–79 CORRE · 80–89 RESPEITO · 90+ LENDA
 *
 * Mesma régua de `DropLenda` (home/rua) — se a escada subir pra `ui/Rua.tsx`,
 * este arquivo vira re-export.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { BotaoRua, DEGRAU_CLASSES, degrauDe, type Degrau } from '@/components/ui/Rua';
import { L } from '@/i18n/L';

// A régua da escada mora em ui/Rua.tsx; re-export pra quem já importa daqui.
export { degrauDe };

export const DEGRAU_INFO: Record<Degrau, { n: string; nome: string }> = {
  chao: { n: '01', nome: L('Chão', 'Ground') },
  corre: { n: '02', nome: L('Corre', 'Hustle') },
  respeito: { n: '03', nome: L('Respeito', 'Respect') },
  lenda: { n: '04', nome: L('Lenda', 'Legend') },
};

/** Cor do número de OVR em cima da carta do degrau. */
export function ovrNumeroClasses(d: Degrau): string {
  if (d === 'chao') return 'text-transparent [-webkit-text-stroke:1.5px_var(--color-asfalto-27)]';
  if (d === 'respeito') return 'text-ouro-27';
  return '';
}

/** Anel do avatar redondo (token no campo, retrato pequeno) pelo degrau. */
export function anelDegrau(d: Degrau): string {
  switch (d) {
    case 'lenda':
      return 'border-ouro-27 border-[3px]';
    case 'respeito':
      return 'border-ouro-27 border-2';
    case 'corre':
      return 'border-rua border-2';
    default:
      return 'border-cal border-2 border-dashed';
  }
}

/** Selinho de OVR (quadrado) — fundo/texto do degrau, número em Anton. */
export function OvrSelo({ ovr, className }: { ovr: number; className?: string }) {
  const d = degrauDe(ovr);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-impact tabular-nums leading-none',
        d === 'chao' ? 'border-2 border-dashed border-asfalto-27 bg-cal text-asfalto-27' : DEGRAU_CLASSES[d],
        d === 'respeito' && 'text-ouro-27',
        className,
      )}
    >
      {ovr}
    </span>
  );
}

/**
 * "Vazio com saída" — degrau CHÃO: tracejado, frase na voz e um caminho.
 * Sem `acao`, fica só a frase (quando não existe saída real).
 */
export function VazioRua({
  frase,
  detalhe,
  acao,
  className,
}: {
  frase: string;
  detalhe?: ReactNode;
  acao?: { label: string; to?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col items-start gap-3 border-2 border-dashed border-fio p-5', className)}>
      <p className="font-voz text-[26px] leading-tight text-papel">{frase}</p>
      {detalhe != null && <div className="text-[14px] leading-relaxed text-suave">{detalhe}</div>}
      {acao && (
        <BotaoRua to={acao.to} onClick={acao.onClick} className="mt-1 min-h-[48px] px-5 text-[18px]">
          {acao.label} <span aria-hidden>→</span>
        </BotaoRua>
      )}
    </div>
  );
}

/** Cabeçalho de modal no DS: rótulo em prova, título no grito, X. */
export function ModalTopoRua({
  rotulo,
  titulo,
  tituloId,
  onClose,
  voz,
}: {
  rotulo?: string;
  titulo: ReactNode;
  tituloId?: string;
  onClose: () => void;
  /** Título em Pirata (nome de jogador) em vez de Anton. */
  voz?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border-b-2 border-linha px-5 py-4">
      <div className="flex min-w-0 flex-col gap-1">
        {rotulo && (
          <span className="font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-mudo">— {rotulo}</span>
        )}
        <h3
          id={tituloId}
          className={cn(
            'min-w-0 text-papel [overflow-wrap:anywhere]',
            voz ? 'font-voz text-[28px] leading-none' : 'font-impact text-[26px] uppercase leading-[0.95]',
          )}
        >
          {titulo}
        </h3>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={L('Fechar', 'Close')}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center border-2 border-linha font-impact text-[20px] leading-none text-mudo transition-colors hover:border-papel hover:text-papel"
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Placar de números da tela (substitui RailStat/StatTile nas telas do Clube):
 * grade colada por fios de 1px, rótulo em prova, número no grito.
 */
export function PlacarRua({
  itens,
  className,
}: {
  itens: Array<{ label: string; value: ReactNode; hint?: string }>;
  className?: string;
}) {
  return (
    <dl className={cn('grid min-w-0 grid-cols-2 gap-px bg-linha sm:grid-cols-4', className)}>
      {itens.map((o) => (
        <div key={o.label} className="flex min-w-0 flex-col gap-1 bg-asfalto-27 px-4 py-3.5">
          <dt className="block min-w-0 truncate font-prova text-[10px] font-bold uppercase tracking-[0.16em] text-mudo">{o.label}</dt>
          <dd className="font-impact text-[34px] leading-none text-papel tabular-nums">{o.value}</dd>
          {o.hint && <dd className="font-prova text-[10px] text-mudo">{o.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
