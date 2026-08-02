/**
 * Badge animado para itens míticos/featured
 * Aparece no canto superior esquerdo do card com glow pulsante
 */

import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import type { ShopRarity } from '@/game/shopCatalog';

interface LegendaryBadgeProps {
  rarity: ShopRarity;
  featured?: boolean;
}

export function LegendaryBadge({ rarity, featured }: LegendaryBadgeProps) {
  if (rarity !== 'mitico' && !featured) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
      className="absolute left-3 top-3 z-10"
    >
      {/* Glow pulsante */}
      <motion.div
        animate={{
          opacity: [0.4, 0.8, 0.4],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute inset-0 rounded-lg bg-neon-yellow/25 blur-xl"
      />

      {/* Badge */}
      <div className="relative flex items-center gap-2 rounded-lg bg-neon-yellow px-3 py-1.5">
        <Sparkles className="h-3.5 w-3.5 text-black" strokeWidth={2.4} />
        {/* Topo da escada de raridade: amarelo sólido, texto preto. É o mesmo
            tratamento que o layer final dá ao que importa mais. */}
        <span
          className="font-impact uppercase text-black"
          style={{ fontSize: '13px', letterSpacing: '0.04em' }}
        >
          Lendário
        </span>
      </div>
    </motion.div>
  );
}
