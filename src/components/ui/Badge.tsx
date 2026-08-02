import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'rare' | 'epic' | 'legendary' | 'outline';

/**
 * ── Alinhado à regra canônica de raridade (2026-08-01) ─────────────────────
 * `src/entities/rarityLabels.ts` define, com a assinatura do fundador:
 * **prestígio = GRAU DE AMARELO** (topo sólido, base sem amarelo).
 *
 * Este Badge fazia o contrário: raro VERDE, épico ROXO, lendário LARANJA — três
 * matizes que não existem na paleta e que ainda brigavam com a Loja, onde épico
 * era FÚCSIA. O jogador via a mesma palavra em duas cores diferentes conforme a
 * tela, então a cor não ensinava raridade nenhuma.
 *
 * Agora a escada é de amarelo, e a hierarquia se lê pela intensidade.
 */
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-white/10 text-white/75',
  rare: 'bg-neon-yellow/15 text-neon-yellow',
  epic: 'bg-neon-yellow/35 text-neon-yellow',
  legendary: 'bg-neon-yellow text-black',
  outline: 'bg-transparent border border-neon-yellow/60 text-neon-yellow',
};

/**
 * Badge esportivo — caps, sharp ou angular.
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
