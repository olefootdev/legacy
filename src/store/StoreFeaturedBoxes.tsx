/**
 * Grid de "boxes" em destaque na /store — cards maiores que o grid padrão,
 * com foco no ícone/raridade do item. Mesmo padrão visual dos
 * TransferFeaturedBoxes da /transfer pra manter consistência entre as lojas.
 */

import { motion } from 'motion/react';
import { ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { shopItemIcon, type ShopCatalogItem, type ShopRarity } from '@/game/shopCatalog';
import { StoreSectionHeadline } from '@/store/StoreSectionHeadline';

interface StoreFeaturedBoxesProps {
  title: string;
  subtitle?: string;
  items: ShopCatalogItem[];
  onSelect: (item: ShopCatalogItem) => void;
  variant?: 'premium' | 'rising' | 'drop';
}

const VARIANT_STYLES: Record<NonNullable<StoreFeaturedBoxesProps['variant']>, {
  badge: string;
}> = {
  premium: {
    badge: 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow/40',
  },
  rising: {
    badge: 'bg-[var(--color-success)]/20 text-[var(--color-success)] border-[var(--color-success)]/40',
  },
  drop: {
    badge: 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow/40',
  },
};

/**
 * Raridade = grau de amarelo, em cor chapada (VOLT2): etiqueta por tier e,
 * no topo da escada, borda volt 2px. Sem degradê de fundo nem brilho.
 */
const RARITY_TAG: Record<ShopRarity, string> = {
  comum:  'border-white/20 bg-deep-black text-white',
  raro:   'border-neon-yellow/30 bg-deep-black text-neon-yellow/85',
  epico:  'border-neon-yellow/60 bg-deep-black text-neon-yellow',
  mitico: 'border-neon-yellow bg-neon-yellow text-black',
};

const RARITY_FRAME: Record<ShopRarity, string> = {
  comum:  'border border-white/10 hover:border-white/30',
  raro:   'border border-white/10 hover:border-white/30',
  epico:  'border border-neon-yellow/55',
  mitico: 'border-2 border-neon-yellow',
};

const RARITY_LABEL: Record<ShopRarity, string> = {
  comum: 'COMUM',
  raro: 'RARO',
  epico: 'ÉPICO',
  mitico: 'MÍTICO',
};

function formatBro(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function StoreFeaturedBoxes({
  title, subtitle, items, onSelect, variant = 'premium',
}: StoreFeaturedBoxesProps) {
  // Proteção contra dados inválidos
  if (!items || !Array.isArray(items) || items.length === 0) {
    return null;
  }

  const v = VARIANT_STYLES[variant] ?? VARIANT_STYLES.premium;
  const SHOWN_LIMIT = 6;
  const shown = items.slice(0, SHOWN_LIMIT);
  const moreCount = Math.max(0, items.length - SHOWN_LIMIT);

  return (
    <section className="min-w-0 space-y-4">
      <StoreSectionHeadline
        title={title}
        subtitle={subtitle}
        rightLabel={moreCount > 0 ? `+${moreCount} mais` : undefined}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((item, i) => {
          const Icon = shopItemIcon(item.iconKey);
          return (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              className={cn(
                'group relative overflow-hidden bg-panel p-0 text-left transition-colors',
                RARITY_FRAME[item.rarity],
              )}
            >
              {/* Visual superior — ícone centralizado sobre fundo chapado */}
              <div className="relative flex h-52 w-full items-center justify-center overflow-hidden bg-card">
                <Icon
                  className="h-24 w-24 text-white/80 transition-colors duration-300 group-hover:text-white"
                  aria-hidden
                />

                <div className={cn('absolute right-2 top-2 border px-2 py-0.5', RARITY_TAG[item.rarity])}>
                  <p className="font-display text-[9px] font-black uppercase tracking-widest">
                    {RARITY_LABEL[item.rarity]}
                  </p>
                </div>

                {item.featured ? (
                  <div className="absolute left-2 top-2">
                    <span className={cn('rounded-full border px-2 py-0.5 font-display text-[8px] font-black uppercase tracking-widest', v.badge)}>
                      Destaque
                    </span>
                  </div>
                ) : null}

              </div>

              {/* Info */}
              <div className="space-y-2 p-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-black uppercase tracking-wider text-white">
                    {item.title}
                  </p>
                  <p className="line-clamp-2 text-[10px] leading-snug text-gray-500">
                    {item.blurb}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-2">
                  {item.priceBroCents != null && item.priceBroCents > 0 ? (
                    <span className="rounded-lg border border-white/15 bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] font-bold text-white/80">
                      {formatBro(item.priceBroCents)} BRO
                    </span>
                  ) : null}
                  {item.priceExp != null && item.priceExp > 0 ? (
                    <span className="rounded-lg border border-neon-yellow/30 bg-neon-yellow/5 px-2 py-0.5 font-mono text-[10px] font-bold text-neon-yellow">
                      {item.priceExp.toLocaleString('pt-BR')} EXP
                    </span>
                  ) : null}
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-white/50 transition-colors group-hover:text-neon-yellow">
                    <ShoppingBag className="h-3 w-3" aria-hidden />
                    Comprar
                  </span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
