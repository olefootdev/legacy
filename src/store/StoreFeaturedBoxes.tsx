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
  glow: string;
}> = {
  premium: {
    badge: 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow/40',
    glow: 'shadow-[0_0_24px_rgba(234,255,0,0.08)]',
  },
  rising: {
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
    glow: 'shadow-[0_0_24px_rgba(16,185,129,0.08)]',
  },
  drop: {
    badge: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/40',
    glow: 'shadow-[0_0_24px_rgba(217,70,239,0.08)]',
  },
};

const RARITY_GRADIENT: Record<ShopRarity, string> = {
  comum:  'from-slate-700/50 via-slate-800/40 to-black',
  raro:   'from-cyan-500/25 via-cyan-700/20 to-black',
  epico:  'from-fuchsia-500/25 via-fuchsia-700/20 to-black',
  mitico: 'from-amber-500/30 via-orange-700/25 to-black',
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
  if (items.length === 0) return null;
  const v = VARIANT_STYLES[variant];
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
                'group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/40 p-0 text-left transition-colors hover:border-white/30',
                v.glow,
              )}
            >
              {/* Visual superior — ícone centralizado com gradiente de raridade */}
              <div className={cn('relative flex h-52 w-full items-center justify-center overflow-hidden bg-gradient-to-br', RARITY_GRADIENT[item.rarity])}>
                <Icon
                  className="h-24 w-24 text-white/80 transition-transform duration-500 group-hover:scale-110"
                  aria-hidden
                />

                <div className="absolute right-2 top-2 rounded-md border border-white/20 bg-black/70 px-2 py-0.5 backdrop-blur">
                  <p className="font-display text-[9px] font-black uppercase tracking-widest text-white">
                    {RARITY_LABEL[item.rarity]}
                  </p>
                </div>

                {item.featured ? (
                  <div className="absolute left-2 top-2">
                    <span className={cn('rounded-full border px-2 py-0.5 font-display text-[8px] font-black uppercase tracking-widest', v.badge)}>
                      Featured
                    </span>
                  </div>
                ) : null}

                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/90 to-transparent" />
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
                    <span className="rounded-lg border border-cyan-500/30 bg-cyan-950/50 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-200">
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
