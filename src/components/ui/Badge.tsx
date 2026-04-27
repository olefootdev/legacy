import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'rare' | 'epic' | 'legendary' | 'outline';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-neon-yellow text-black',
  rare: 'bg-[#00C851] text-white',
  epic: 'bg-[#9C27B0] text-white',
  legendary: 'bg-[#FF6F00] text-white',
  outline: 'bg-transparent border border-neon-yellow/60 text-neon-yellow',
};

/**
 * Badge esportivo — Agency FB caps, sharp ou angular.
 */
export function Badge({
  children,
  variant = 'default',
  angular = false,
  className,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  angular?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-block font-display font-black uppercase text-[12px] tracking-[0.2em] px-4 py-1.5 rounded-sm',
        VARIANT_CLASSES[variant],
        angular && 'clip-angular-badge',
        className,
      )}
    >
      {children}
    </span>
  );
}
