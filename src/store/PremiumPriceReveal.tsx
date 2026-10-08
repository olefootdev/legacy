/**
 * Preço em destaque para itens caros
 * Para itens acima de ¢50, mostra o preço grande em spray no hover (DS 2027).
 */

import { motion, AnimatePresence } from 'motion/react';
import { useState, type ReactNode } from 'react';
import type { ShopCatalogItem } from '@/game/shopCatalog';
import { L, LOCALE } from '@/i18n/L';

interface PremiumPriceRevealProps {
  key?: import("react").Key;
  item: ShopCatalogItem;
  children: ReactNode;
  onSelect: () => void;
}

export function PremiumPriceReveal({ item, children, onSelect }: PremiumPriceRevealProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isPremium = (item.priceBroCents ?? 0) >= 5000; // ¢50+

  if (!isPremium) {
    return <div className="h-full" onClick={onSelect}>{children}</div>;
  }

  const priceDisplay = item.priceBroCents
    ? `¢${(item.priceBroCents / 100).toFixed(0)}`
    : `${item.priceExp?.toLocaleString(LOCALE)} EXP`;

  return (
    <motion.div
      className="relative h-full"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onSelect}
    >
      {children}

      {/* Overlay de preço — asfalto chapado, preço em spray (DS 2027). */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 border-[3px] border-ouro-27 bg-asfalto-27"
          >
            <span className="font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-mudo">
              — {L('Preço premium', 'Premium price')}
            </span>
            <span className="font-spray text-[clamp(48px,12vw,72px)] font-black leading-[0.85] tabular-nums text-ouro-27">
              {priceDisplay}
            </span>
            <span className="font-impact text-[17px] uppercase text-rua">
              {L('Ver detalhes', 'See details')} <span aria-hidden>→</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
