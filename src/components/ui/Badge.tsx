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
  // DS 2027 · a escada: chão → corre → respeito → lenda.
  default: 'border-2 border-linha text-mudo',
  rare: 'border-2 border-neon-yellow text-neon-yellow',
  epic: 'bg-black border-2 border-ouro-27 text-ouro-27',
  legendary: 'bg-ouro-27 text-black',
  outline: 'bg-transparent border-2 border-neon-yellow text-neon-yellow',
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
        'inline-block font-prova font-bold uppercase text-[12px] tracking-[0.14em] px-3 py-1',
        VARIANT_CLASSES[variant],
        angular && 'clip-angular-badge',
        className,
      )}
    >
      {children}
    </span>
  );
}
