import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Label de seção com linhas laterais — assinatura do site oficial olefoot.com.
 * Wrapper sobre `.ole-eyebrow` (já no tema).
 */
export function Eyebrow({
  children,
  className,
  align = 'center',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  align?: 'center' | 'start';
  as?: 'div' | 'span' | 'p';
}) {
  return (
    <Tag
      className={cn(
        'ole-eyebrow',
        align === 'start' && 'justify-start',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
