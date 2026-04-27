import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Headline padrão BVB: linha 1 Agency FB caps + linha 2 Moret italic.
 * Tamanhos via clamp para responsividade automática (mobile→desktop).
 */
export function Headline({
  line1,
  line2,
  size = 'xl',
  className,
  inverted = false,
}: {
  line1: ReactNode;
  line2?: ReactNode;
  /** xl=hero (96/84), lg=section (64/48), md=card (48/32) */
  size?: 'xl' | 'lg' | 'md';
  className?: string;
  /** Texto preto (sobre fundo amarelo). Default false = branco/atual. */
  inverted?: boolean;
}) {
  const line1Size =
    size === 'xl'
      ? 'text-[clamp(40px,9vw,96px)]'
      : size === 'lg'
        ? 'text-[clamp(32px,6vw,64px)]'
        : 'text-[clamp(24px,5vw,48px)]';
  const line2Size =
    size === 'xl'
      ? 'text-[clamp(32px,7vw,84px)]'
      : size === 'lg'
        ? 'text-[clamp(24px,4.5vw,48px)]'
        : 'text-[clamp(18px,3.5vw,32px)]';

  return (
    <h1 className={cn('flex flex-col leading-[0.95]', className)}>
      <span className={cn('ole-headline', line1Size, inverted ? 'text-black' : 'text-white')}>
        {line1}
      </span>
      {line2 != null && (
        <span className={cn('ole-headline-italic', line2Size, inverted ? 'text-black/85' : 'text-white/75')}>
          {line2}
        </span>
      )}
    </h1>
  );
}
