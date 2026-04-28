import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Eyebrow } from './Eyebrow';
import { Headline } from './Headline';

/**
 * Header editorial Olefoot — padroniza o pattern usado em Home / Mercado /
 * Transfer / Competição. Composição: eyebrow (pequeno, tracking largo) +
 * headline MORET + régua amarela. Substitui blocos "header improvisados"
 * em telas internas (Plantel, Wallet, Staff) sem refatorar lógica.
 *
 * Uso típico:
 * <LegacyHeader
 *   eyebrow="Ole Football · Meu Time"
 *   title="Plantel"
 *   subtitle="Principal"
 *   surface="dark"
 * />
 */
export function LegacyHeader({
  eyebrow,
  title,
  subtitle,
  surface = 'dark',
  align = 'center',
  size = 'lg',
  rule = true,
  className,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Linha 2 em MORET italic (estilo "fundadores", "Raro", "Principal"). */
  subtitle?: ReactNode;
  /** dark = sobre preto/painel. yellow = sobre fundo amarelo. */
  surface?: 'dark' | 'yellow';
  align?: 'center' | 'start';
  size?: 'xl' | 'lg' | 'md';
  /** Régua horizontal amarela abaixo do título. */
  rule?: boolean;
  className?: string;
  /** Conteúdo extra abaixo da régua (ex: meta line, CTAs). */
  children?: ReactNode;
}) {
  const inverted = surface === 'yellow';
  const ruleColor = inverted ? 'bg-black/80' : 'bg-neon-yellow';

  return (
    <header
      className={cn(
        'flex flex-col gap-4',
        align === 'center' ? 'items-center text-center' : 'items-start text-left',
        className,
      )}
    >
      {eyebrow ? (
        <Eyebrow
          align={align}
          className={inverted ? '!text-black/80 [&::before]:!bg-black/30 [&::after]:!bg-black/30' : undefined}
        >
          {eyebrow}
        </Eyebrow>
      ) : null}

      <Headline
        line1={title}
        line2={subtitle}
        size={size}
        inverted={inverted}
        className={align === 'center' ? 'items-center text-center' : ''}
      />

      {rule ? (
        <div className={cn('h-[2px] w-16', ruleColor)} aria-hidden />
      ) : null}

      {children ? <div className="w-full">{children}</div> : null}
    </header>
  );
}
