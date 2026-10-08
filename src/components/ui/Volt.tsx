/**
 * Peças herdadas do VOLT2, já repintadas pro DS 2027 "Respeito é ouro"
 * (docs/DS-2027.md). Ficam com os nomes antigos porque 20+ telas usam.
 *
 *   · UMA LINHA SÓ: categoria vira #hashtag; texto que quebraria em duas corta
 *     com reticências (min-w-0 + truncate), nunca empurra o layout.
 *   · A CONSEQUÊNCIA MORA NO BOTÃO: "Dar chance +10", não um parágrafo acima.
 *   · Sem degradê. Ouro chapado é valor (respeito) e lenda; amarelo é ação.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Texto de uma linha que corta com reticências em vez de quebrar. */
export function UmaLinha({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('block min-w-0 truncate', className)}>{children}</span>;
}

/** Categoria em mono: `#ligaglobal #div3`, `#acesso · 12 rodadas`. */
export function Hashtag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('block min-w-0 truncate font-mono text-[11.5px] font-medium text-cimento', className)}>
      {children}
    </span>
  );
}

/**
 * Título de seção: risco volt + rótulo mono + linha que se apaga.
 * A linha é o único gradiente permitido fora de foto e selo.
 */
export function SecaoVolt({
  label,
  tone = 'volt',
  children,
  className,
}: {
  label: string;
  tone?: 'volt' | 'neutro';
  /** Linha secundária opcional (em geral uma <Hashtag>). */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {/* DS 2027: "— RÓTULO" em Geist Mono espaçado. Sem linha que se apaga. */}
      <h2
        className={cn(
          'min-w-0 truncate font-mono text-[12px] font-bold uppercase tracking-[0.22em]',
          tone === 'volt' ? 'text-mudo' : 'text-fio',
        )}
      >
        <span className={tone === 'volt' ? 'text-neon-yellow' : undefined}>—</span> {label}
      </h2>
      {children}
    </div>
  );
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${Math.abs(delta)}`;
  return '±0';
}

/**
 * Botão com a consequência dentro: rótulo + delta. No primário o delta vai em
 * preto (o fundo já é a ação); no secundário ele carrega a cor do efeito.
 */
export function BotaoConsequencia({
  label,
  delta,
  variant = 'primary',
  onClick,
  disabled,
  className,
}: {
  label: string;
  delta?: number;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const deltaTone =
    delta == null || variant === 'primary' ? '' : delta > 0 ? 'text-alta' : delta < 0 ? 'text-baixa' : 'text-cimento';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'ole-num inline-flex h-[50px] min-w-0 items-center justify-center gap-1.5 px-3 text-[18px] uppercase transition-[transform,box-shadow,background-color,color] disabled:pointer-events-none disabled:opacity-40',
        variant === 'primary'
          ? 'bg-neon-yellow text-black shadow-[4px_4px_0_var(--color-giz)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--color-giz)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-yellow'
          : 'border-2 border-giz text-giz hover:bg-giz hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-yellow',
        className,
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      {delta != null && <span className={cn('shrink-0', deltaTone)}>{formatDelta(delta)}</span>}
    </button>
  );
}

/**
 * Placa de papel (#ECECE7) — o terceiro tom do VOLT2, pra quebrar o preto e o
 * amarelo. Usar com parcimônia: título da Resenha, convite.
 */
export function Placa({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('bg-cal text-deep-black', className)}>{children}</div>;
}

/** Selo da rede Solana. Só aparece junto de ativo que está na cadeia. */
export function SeloRede({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-cimento',
        className,
      )}
    >
      Solana
      <span aria-hidden className="text-ouro-27">●</span>
    </span>
  );
}
