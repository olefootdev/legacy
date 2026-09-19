/**
 * VOLT2 — as peças que se repetem em toda tela nova (A VIRADA · V3).
 *
 * Regras que estas peças carregam pra ninguém precisar lembrar:
 *   · UMA LINHA SÓ: categoria vira #hashtag; texto que quebraria em duas corta
 *     com reticências (min-w-0 + truncate), nunca empurra o layout.
 *   · A CONSEQUÊNCIA MORA NO BOTÃO: "Dar chance +10", não um parágrafo acima.
 *   · SÓLIDO: cor chapada. Gradiente só no acabamento (a linha que se apaga, o
 *     selo da rede). Sem sombra, sem inclinação, sem enfeite solto.
 *   · OURO É DA REDE: só ativo que está na Solana usa ouro e o SeloRede. EXP e
 *     OLEFOOT do jogo são fictícios e nunca aparecem assim.
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
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className={cn('block h-0.5 w-[18px] shrink-0', tone === 'volt' ? 'bg-neon-yellow' : 'bg-[#3A3D40]')}
        />
        <h2 className="min-w-0 truncate font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-giz">
          {label}
        </h2>
        <span
          aria-hidden
          className="block h-px min-w-3 grow"
          style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.18), rgba(255,255,255,0))' }}
        />
      </div>
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
        'ole-num inline-flex h-[50px] min-w-0 items-center justify-center gap-1.5 px-3 text-[13px] uppercase transition-colors disabled:pointer-events-none disabled:opacity-40',
        variant === 'primary'
          ? 'bg-neon-yellow text-black hover:bg-white [--corte:12px] [clip-path:var(--clip-corte)] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-black'
          : 'border border-white/30 font-bold text-white hover:border-white hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-yellow',
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
  return <div className={cn('bg-giz text-deep-black', className)}>{children}</div>;
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
      <span
        aria-hidden
        className="block h-2 w-2 shrink-0"
        style={{ background: 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)' }}
      />
      Solana
    </span>
  );
}
