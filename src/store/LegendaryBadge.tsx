/**
 * Selo de destaque para itens míticos/featured (DS 2027).
 *
 * Selo em linha (não flutua por cima do card): contorno na cor do texto da
 * carta, então funciona em qualquer degrau da escada — no ouro vira preto,
 * no asfalto vira papel. Sem brilho, sem ícone de faísca.
 */

import { motion } from 'motion/react';
import type { ShopRarity } from '@/game/shopCatalog';
import { L } from '@/i18n/L';

interface LegendaryBadgeProps {
  rarity: ShopRarity;
  featured?: boolean;
}

export function LegendaryBadge({ rarity, featured }: LegendaryBadgeProps) {
  if (rarity !== 'mitico' && !featured) return null;

  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1, duration: 0.2 }}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-2 border-current px-2 py-0.5 font-prova text-[12px] font-bold uppercase tracking-[0.08em]"
    >
      <span aria-hidden>★</span>
      {rarity === 'mitico' ? L('Lendário', 'Legendary') : L('Destaque', 'Featured')}
    </motion.span>
  );
}
