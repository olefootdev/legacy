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
        className="absolute inset-0 rounded-lg bg-amber-400/30 blur-xl"
      />

      {/* Badge */}
      <div className="relative flex items-center gap-2 rounded-lg border border-amber-400/60 bg-gradient-to-br from-amber-950/90 via-orange-950/80 to-black/90 px-3 py-1.5 backdrop-blur-sm">
        <Sparkles className="h-3.5 w-3.5 text-amber-300" strokeWidth={2.5} />
        <span
          className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent"
          style={{
            fontFamily: 'var(--font-serif-hero)',
            fontStyle: 'italic',
            fontSize: '15px',
            letterSpacing: '-0.01em',
          }}
        >
          lendário
        </span>
      </div>
    </motion.div>
  );
}
