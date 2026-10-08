/**
 * DS 2027 · "RESPEITO É OURO" — peças de TABELA da área Competição.
 *
 * Mesma gramática do "Quanto falta pra subir" da Home (QuantoFalta.tsx):
 *   · linha em concreto com Anton;
 *   · líder com fio de ouro (respeito: valor que já existe);
 *   · a linha do manager em rua, colada torta, com sombra dura de papel;
 *   · zona de acesso/queda tracejada;
 *   · o número do que falta em spray.
 * Ouro e rua nunca disputam a mesma linha: um manda, o outro apoia.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { L, LOCALE } from '@/i18n/L';

/** "#01", "#18" — posição sempre com dois dígitos. */
export function posRua(pos: number): string {
  return `#${String(pos).padStart(2, '0')}`;
}

/**
 * Uma linha de ranking/tabela.
 * `tom`: 'lider' (fio de ouro), 'eu' (rua colada torta), 'zona' (posição em rua),
 * 'abaixo' (texto mudo), 'normal'.
 */
export function LinhaRua({
  pos,
  nome,
  valor,
  sub,
  tom = 'normal',
  chip,
  avatar,
  onClick,
  ariaLabel,
  className,
  id,
}: {
  id?: string;
  pos: number | string;
  nome: ReactNode;
  valor: ReactNode;
  /** Linha mono pequena embaixo do nome (J · V-E-D, divisão…). */
  sub?: ReactNode;
  tom?: 'lider' | 'eu' | 'zona' | 'abaixo' | 'normal';
  chip?: ReactNode;
  avatar?: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}) {
  const posTxt = typeof pos === 'number' ? posRua(pos) : pos;
  const Tag = onClick ? 'button' : 'div';
  if (tom === 'eu') {
    return (
      <Tag
        id={id}
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        aria-label={ariaLabel}
        className={cn(
          'relative z-[1] my-1 flex min-h-[60px] w-full min-w-0 -rotate-1 items-center gap-3 bg-rua px-4 py-2 text-left text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)] sm:gap-4',
          className,
        )}
      >
        <span className="w-12 shrink-0 font-impact text-[24px] leading-none sm:text-[26px]">{posTxt}</span>
        {avatar}
        <span className="flex min-w-0 grow flex-col gap-1">
          <span className="block min-w-0 truncate font-impact text-[22px] uppercase leading-none sm:text-[26px]">{nome}</span>
          {sub != null && <span className="block min-w-0 truncate font-prova text-[10.5px] font-bold uppercase tracking-[0.12em] text-asfalto-27/70">{sub}</span>}
        </span>
        {chip}
        <span className="shrink-0 font-impact text-[24px] leading-none sm:text-[28px]">{valor}</span>
      </Tag>
    );
  }
  const lider = tom === 'lider';
  return (
    <Tag
      id={id}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'flex min-h-[50px] w-full min-w-0 items-center gap-3 px-4 py-2 text-left sm:gap-4',
        lider ? 'border-2 border-ouro-27 text-ouro-27' : 'bg-concreto',
        !lider && (tom === 'abaixo' ? 'text-mudo' : 'text-papel'),
        onClick && 'transition-colors hover:bg-linha',
        className,
      )}
    >
      <span className={cn('w-12 shrink-0 font-impact text-[20px] leading-none sm:text-[21px]', tom === 'zona' && 'text-rua')}>{posTxt}</span>
      {avatar}
      <span className="flex min-w-0 grow flex-col gap-1">
        <span className="block min-w-0 truncate font-impact text-[19px] uppercase leading-none sm:text-[21px]">{nome}</span>
        {sub != null && (
          <span className={cn('block min-w-0 truncate font-prova text-[10.5px] font-bold uppercase tracking-[0.12em]', lider ? 'text-ouro-27/80' : 'text-mudo')}>
            {sub}
          </span>
        )}
      </span>
      {chip}
      <span className="shrink-0 font-impact text-[20px] leading-none sm:text-[21px]">{valor}</span>
    </Tag>
  );
}

/** Divisória tracejada de zona: "ZONA DE ACESSO", "ZONA DE QUEDA", "…". */
export function ZonaRua({ label, tom = 'rua' }: { label: string; tom?: 'rua' | 'fio' }) {
  const linha = tom === 'rua' ? 'border-rua' : 'border-fio';
  return (
    <div className="flex h-6 items-center gap-2" role="separator" aria-label={label}>
      <span className={cn('block h-0 grow border-t-2 border-dashed', linha)} />
      <span className={cn('shrink-0 font-prova text-[11px] font-bold uppercase tracking-[0.2em]', tom === 'rua' ? 'text-rua' : 'text-mudo')}>{label}</span>
      <span className={cn('block h-0 grow border-t-2 border-dashed', linha)} />
    </div>
  );
}

/** Reticências entre o líder e a janela do manager. */
export function SaltoRua() {
  return (
    <div aria-hidden className="flex h-8 items-center bg-concreto/60 px-4 font-impact text-[18px] leading-none text-mudo">
      ···
    </div>
  );
}

/** O número do que falta em spray: "412 PTS" + a frase no grito. */
export function FaltaRua({ valor, unidade, frase }: { valor: number; unidade: string; frase: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-spray font-black uppercase leading-[0.85] text-rua" style={{ fontSize: 'clamp(60px, 18vw, 104px)' }}>
        {valor.toLocaleString(LOCALE)} {unidade}
      </span>
      <span className="font-impact text-[clamp(17px,4.6vw,24px)] uppercase leading-tight text-papel">{frase}</span>
    </div>
  );
}

/** Forma recente: V/E/D em quadradinhos — vitória em rua, empate concreto, derrota tracejada. */
export function FormaRua({ form, className }: { form: ReadonlyArray<'W' | 'D' | 'L'>; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-label={L('Forma recente', 'Recent form')}>
      {form.map((r, i) => (
        <span
          key={i}
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center font-impact text-[15px] leading-none',
            r === 'W' && 'bg-rua text-asfalto-27',
            r === 'D' && 'bg-linha text-papel',
            r === 'L' && 'border-2 border-dashed border-fio text-mudo',
          )}
        >
          {r === 'W' ? L('V', 'W') : r === 'D' ? L('E', 'D') : L('D', 'L')}
        </span>
      ))}
    </span>
  );
}

/** Cabeçalho de tela da Competição: rótulo "— X", título no grito, frase na voz. */
export function CabecalhoRua({
  rotulo,
  titulo,
  voz,
  aside,
  children,
}: {
  rotulo: string;
  titulo: ReactNode;
  voz?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">— {rotulo}</span>
        {aside != null && <span className="shrink-0 font-prova text-[12px] font-bold uppercase tracking-[0.14em] text-mudo">{aside}</span>}
      </div>
      <h1 className="min-w-0 font-impact uppercase leading-[0.86] text-papel [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(42px, 12vw, 84px)' }}>
        {titulo}
      </h1>
      {voz != null && <p className="font-voz text-[clamp(22px,6vw,30px)] leading-[1.05] text-suave">{voz}</p>}
      {children}
    </header>
  );
}

/** Abas em rua: a ativa é bloco amarelo, as outras contorno de linha. */
export function AbasRua<T extends string>({
  abas,
  ativa,
  onChange,
  ariaLabel,
}: {
  abas: ReadonlyArray<{ id: NoInfer<T>; label: ReactNode }>;
  ativa: T;
  onChange: (id: NoInfer<T>) => void;
  ariaLabel?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex min-w-0 flex-wrap gap-1.5">
      {abas.map((a) => {
        const on = a.id === ativa;
        return (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(a.id)}
            className={cn(
              'inline-flex min-h-[44px] items-center px-4 font-impact text-[16px] uppercase leading-none transition-colors',
              on ? 'bg-rua text-asfalto-27' : 'border-2 border-linha text-suave hover:border-papel hover:text-papel',
            )}
          >
            {a.label}
          </button>
        );
      })}
    </div>
  );
}

/** Estado vazio no degrau CHÃO: contorno tracejado + frase na voz. */
export function VazioRua({ titulo, frase, children }: { titulo: ReactNode; frase?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 border-2 border-dashed border-fio px-5 py-8">
      <span className="font-impact text-[24px] uppercase leading-none text-papel">{titulo}</span>
      {frase != null && <p className="font-voz text-[22px] leading-[1.05] text-suave">{frase}</p>}
      {children}
    </div>
  );
}
