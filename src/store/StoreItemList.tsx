/**
 * Visualização em LISTA compacta para Store
 * Máximo de itens visíveis, mínima rolagem, informação densa.
 * Inspirado em marketplaces NFT (OpenSea list view, Blur.io).
 */

import { motion } from 'motion/react';
import { ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { shopItemIcon, type ShopCatalogItem, type ShopRarity } from '@/game/shopCatalog';
import { LegendaryBadge } from '@/store/LegendaryBadge';

interface StoreItemListProps {
  items: ShopCatalogItem[];
  inventory: Record<string, number>;
  onSelect: (item: ShopCatalogItem) => void;
}

function rarityColor(r: ShopRarity): string {
  switch (r) {
    case 'comum':  return 'text-white/45';
    case 'raro':   return 'text-neon-yellow/60';
    case 'epico':  return 'text-neon-yellow/85';
    case 'mitico': return 'text-neon-yellow';
    default:       return 'text-gray-400';
  }
}

function rarityBorder(r: ShopRarity): string {
  switch (r) {
    case 'comum':  return 'border-white/12';
    case 'raro':   return 'border-neon-yellow/25';
    case 'epico':  return 'border-neon-yellow/45';
    case 'mitico': return 'border-neon-yellow/75';
    default:       return 'border-white/10';
  }
}

function formatBro(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function StoreItemList({ items, inventory, onSelect }: StoreItemListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-8 text-center">
        <p className="text-sm text-gray-500">Nenhum item disponível nesta categoria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const Icon = shopItemIcon(item.iconKey);
        const inv = inventory[item.id] ?? 0;
        const isPremium = (item.priceBroCents ?? 0) >= 5000;

        return (
          <motion.button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.015, duration: 0.2 }}
            className={cn(
              'group relative w-full overflow-hidden rounded-lg border bg-gradient-to-r from-white/[0.02] to-transparent text-left transition-all hover:from-white/[0.06] hover:to-white/[0.02]',
              rarityBorder(item.rarity),
              'hover:scale-[1.01] hover:shadow-lg'
            )}
          >
            {/* Layout horizontal compacto */}
            <div className="flex items-center gap-3 p-3">
              {/* Ícone + Badge lendário */}
              <div className="relative shrink-0">
                <div className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-lg border bg-gradient-to-br from-white/5 to-black/60',
                  rarityBorder(item.rarity)
                )}>
                  <Icon className={cn('h-7 w-7 transition-transform group-hover:scale-110', rarityColor(item.rarity))} aria-hidden />
                </div>
                {(item.rarity === 'mitico' || item.featured) && (
                  <div className="absolute -right-1 -top-1">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-neon-yellow">
                      <span className="text-[8px]">★</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Info principal */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-sm font-black uppercase tracking-tight text-white">
                      {item.title}
                    </h3>
                    <p className="mt-0.5 line-clamp-1 text-[10px] leading-tight text-gray-500">
                      {item.blurb}
                    </p>
                  </div>

                  {/* Raridade badge */}
                  <span
                    className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 font-display text-[7px] font-black uppercase tracking-widest',
                      item.rarity === 'mitico' && 'bg-neon-yellow text-black',
                      item.rarity === 'epico' && 'bg-neon-yellow/30 text-neon-yellow',
                      item.rarity === 'raro' && 'bg-neon-yellow/12 text-neon-yellow/85',
                      item.rarity === 'comum' && 'bg-white/10 text-white/70'
                    )}
                  >
                    {item.rarity === 'mitico' ? 'MÍTICO' : item.rarity === 'epico' ? 'ÉPICO' : item.rarity === 'raro' ? 'RARO' : 'COMUM'}
                  </span>
                </div>

                {/* Preços + inventário + CTA */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {/* Preços */}
                  {item.priceBroCents != null && item.priceBroCents > 0 && (
                    <span className="rounded border border-white/15 bg-white/[0.06] px-2 py-0.5 font-mono text-[9px] font-bold text-white/80">
                      {formatBro(item.priceBroCents)} BRO
                    </span>
                  )}
                  {item.priceExp != null && item.priceExp > 0 && (
                    <span className="rounded border border-neon-yellow/30 bg-neon-yellow/5 px-2 py-0.5 font-mono text-[9px] font-bold text-neon-yellow">
                      {item.priceExp.toLocaleString('pt-BR')} EXP
                    </span>
                  )}

                  {/* Inventário */}
                  {item.consumable && inv > 0 && (
                    <span className="rounded border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-2 py-0.5 font-display text-[8px] font-bold uppercase text-[var(--color-success)]">
                      {inv}× estoque
                    </span>
                  )}

                  {/* Premium badge */}
                  {isPremium && (
                    <span className="ml-auto rounded border border-neon-yellow/30 bg-neon-yellow/10 px-2 py-0.5 font-display text-[8px] font-bold uppercase tracking-wider text-neon-yellow">
                      Premium
                    </span>
                  )}

                  {/* CTA hover */}
                  <span className="ml-auto inline-flex items-center gap-1 text-[9px] text-white/40 transition-colors group-hover:text-neon-yellow">
                    <ShoppingBag className="h-3 w-3" aria-hidden />
                    Comprar
                  </span>
                </div>
              </div>
            </div>

            {/* Hover overlay sutil */}
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.02) 50%, transparent 100%)',
              }}
            />
          </motion.button>
        );
      })}
    </div>
  );
}
