/**
 * Preço Dinâmico com Moret para Itens Caros
 * Para itens acima de ¢50, mostrar o preço em Moret italic gigante no hover.
 */

import { motion, AnimatePresence } from 'motion/react';
import { useState, type ReactNode } from 'react';
import type { ShopCatalogItem } from '@/game/shopCatalog';

interface PremiumPriceRevealProps {
  item: ShopCatalogItem;
  children: ReactNode;
  onSelect: () => void;
}

export function PremiumPriceReveal({ item, children, onSelect }: PremiumPriceRevealProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isPremium = (item.priceBroCents ?? 0) >= 5000; // ¢50+

  if (!isPremium) {
    return <div onClick={onSelect}>{children}</div>;
  }

  const priceDisplay = item.priceBroCents
    ? `¢${(item.priceBroCents / 100).toFixed(0)}`
    : `${item.priceExp?.toLocaleString('pt-BR')} EXP`;

  return (
    <motion.div
      className="relative"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onSelect}
    >
      {children}

      {/* Overlay de preço em Moret */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-black/95 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="text-center"
            >
              <p
                className="mb-1 uppercase tracking-[0.3em] text-neon-yellow/70"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '9px',
                }}
              >
                Preço Premium
              </p>
              <p
                className="bg-gradient-to-br from-neon-yellow via-amber-200 to-neon-yellow bg-clip-text text-transparent"
                style={{
                  fontFamily: 'var(--font-serif-hero)', // Moret
                  fontStyle: 'italic',
                  fontSize: 'clamp(2rem, 5vw, 3rem)',
                  letterSpacing: '-0.02em',
                  lineHeight: 0.9,
                }}
              >
                {priceDisplay}
              </p>
              <p
                className="mt-2 text-white/60"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                }}
              >
                Clique para ver detalhes
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
