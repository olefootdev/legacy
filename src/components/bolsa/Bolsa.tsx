/**
 * Peças da BOLSA (DS 2027 · "Respeito é ouro") — usadas só pelas telas do
 * mercado vivo, loja, leilões e PLAYERVIP.
 *
 *   · `degrauDeOvr` — a escada por OVR (<70 chão · 70–79 corre · 80–89 respeito · 90+ lenda).
 *   · `ContagemSpray` — a contagem regressiva em blocos de spray do "Drop de lenda".
 *   · `OvrSelo` — o OVR em mini-carta, pintado pelo degrau.
 *   · `AvisoRua` — retorno de ação (erro / feito) sem bloco colorido.
 *   · `CAMPO_RUA` — campo de formulário: concreto chapado, canto vivo, foco em rua.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DEGRAU_CLASSES, type Degrau } from '@/components/ui/Rua';
import { L } from '@/i18n/L';

export function degrauDeOvr(ovr: number): Degrau {
  if (ovr >= 90) return 'lenda';
  if (ovr >= 80) return 'respeito';
  if (ovr >= 70) return 'corre';
  return 'chao';
}

/** Campo de formulário DS 2027. */
export const CAMPO_RUA =
  'w-full min-w-0 border-2 border-linha bg-asfalto-27 px-4 py-3.5 font-sans text-base text-papel outline-none placeholder:text-fio focus:border-rua';

/** Milissegundos que faltam até `ate`, atualizando a cada segundo. */
export function useRestante(ate: string | number | Date): number {
  const alvo = new Date(ate).getTime();
  const [resta, setResta] = useState(() => alvo - Date.now());
  useEffect(() => {
    setResta(alvo - Date.now());
    const t = setInterval(() => setResta(alvo - Date.now()), 1000);
    return () => clearInterval(t);
  }, [alvo]);
  return resta;
}

/**
 * Contagem em blocos de spray (peça 2d do DS). Mostra HH só quando passa de
 * uma hora. `bloco` pinta cada bloco — o padrão é asfalto com número claro.
 */
export function ContagemSpray({
  ms,
  bloco = 'bg-asfalto-27 text-papel',
  tamanho = 'text-[clamp(34px,10vw,52px)]',
  rotulos = true,
  className,
}: {
  ms: number;
  bloco?: string;
  tamanho?: string;
  rotulos?: boolean;
  className?: string;
}) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const partes: { v: number; r: string }[] = [
    ...(h > 0 ? [{ v: h, r: L('h', 'h') }] : []),
    { v: m, r: L('min', 'min') },
    { v: s, r: L('seg', 'sec') },
  ];
  return (
    <div
      role="timer"
      aria-label={L(`Faltam ${h > 0 ? `${h}h ` : ''}${m} min ${s} s`, `${h > 0 ? `${h}h ` : ''}${m} min ${s} s left`)}
      className={cn('grid gap-1.5', className)}
      style={{ gridTemplateColumns: `repeat(${partes.length}, minmax(0, 1fr))` }}
    >
      {partes.map((p, i) => (
        <div key={i} className="flex min-w-0 flex-col gap-1">
          <span
            className={cn(
              'flex items-center justify-center py-1.5 font-spray font-black tabular-nums leading-none',
              tamanho,
              bloco,
            )}
          >
            {String(p.v).padStart(2, '0')}
          </span>
          {rotulos && (
            <span className="text-center font-prova text-[10px] font-bold uppercase tracking-[0.2em] opacity-70">{p.r}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** OVR em mini-carta pintada pelo degrau da escada. */
export function OvrSelo({ ovr, className }: { ovr: number; className?: string }) {
  const d = degrauDeOvr(ovr);
  return (
    <span
      className={cn(
        'inline-flex h-9 w-10 shrink-0 items-center justify-center font-impact text-[19px] leading-none tabular-nums',
        DEGRAU_CLASSES[d],
        d === 'chao' || d === 'respeito' ? 'border-2' : '',
        className,
      )}
      aria-label={`OVR ${ovr}`}
    >
      {ovr}
    </span>
  );
}

/** Retorno de ação — erro ou feito — em faixa de concreto com fio lateral. */
export function AvisoRua({ tipo, children, className }: { tipo: 'erro' | 'ok'; children: ReactNode; className?: string }) {
  return (
    <p
      role={tipo === 'erro' ? 'alert' : 'status'}
      className={cn(
        'flex min-w-0 items-start gap-3 border-l-4 bg-concreto px-4 py-3 font-sans text-[13px] leading-snug text-papel',
        tipo === 'erro' ? 'border-baixa' : 'border-rua',
        className,
      )}
    >
      <span className={cn('shrink-0 font-prova text-[11px] font-bold uppercase tracking-[0.18em]', tipo === 'erro' ? 'text-baixa' : 'text-rua')}>
        {tipo === 'erro' ? L('— Opa', '— Oops') : L('— Feito', '— Done')}
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}
