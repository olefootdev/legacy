/**
 * Visualização em LISTA compacta para Store
 * Máximo de itens visíveis, mínima rolagem, informação densa.
 * Inspirado em marketplaces NFT (OpenSea list view, Blur.io). DS 2027: escada no ícone.
 */

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { shopItemIcon, type ShopCatalogItem, type ShopRarity } from '@/game/shopCatalog';
import { L, LOCALE } from '@/i18n/L';

interface StoreItemListProps {
  items: ShopCatalogItem[];
  inventory: Record<string, number>;
  onSelect: (item: ShopCatalogItem) => void;
}

/** Escada do DS 2027 aplicada ao ícone da raridade (mesma régua da grade). */
function rarityTile(r: ShopRarity): string {
  switch (r) {
    case 'comum':  return 'border-2 border-dashed border-fio bg-asfalto-27 text-mudo';
    case 'raro':   return 'bg-cal text-asfalto-27';
    case 'epico':  return 'border-[3px] border-ouro-27 bg-asfalto-27 text-ouro-27';
    case 'mitico': return 'bg-ouro-27 text-asfalto-27';
    default:       return 'bg-concreto text-mudo';
  }
}

function raritySelo(r: ShopRarity): string {
  switch (r) {
    case 'mitico': return 'bg-ouro-27 text-asfalto-27 px-2 py-0.5';
    case 'epico':  return 'border-2 border-ouro-27 text-ouro-27 px-1.5 py-px';
    case 'raro':   return 'bg-cal text-asfalto-27 px-2 py-0.5';
    default:       return 'border-2 border-linha text-mudo px-1.5 py-px';
  }
}

function formatBro(cents: number): string {
  return (cents / 100).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function StoreItemList({ items, inventory, onSelect }: StoreItemListProps) {
  if (items.length === 0) {
    return (
      <div className="border-2 border-dashed border-fio p-8 text-center">
        <p className="font-sans text-sm text-suave">{L('Nenhum item disponível nesta categoria.', 'No items available in this category.')}</p>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
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
              'group relative w-full min-w-0 bg-concreto text-left transition-colors hover:bg-linha focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rua',
              item.rarity === 'mitico' && 'border-l-[6px] border-ouro-27',
            )}
          >
            <div className="flex min-w-0 items-center gap-3 p-3">
              <div className={cn('relative flex h-14 w-14 shrink-0 items-center justify-center', rarityTile(item.rarity))}>
                <Icon className="h-7 w-7" aria-hidden />
                {(item.rarity === 'mitico' || item.featured) && (
                  <span aria-hidden className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-asfalto-27 text-[11px] text-ouro-27">
                    ★
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-impact text-[19px] uppercase leading-[1.05] text-papel">
                      {item.title}
                    </h3>
                    <p className="mt-0.5 line-clamp-1 font-sans text-[12px] leading-tight text-suave">
                      {item.blurb}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 font-prova text-[10px] font-bold uppercase tracking-[0.12em]',
                      raritySelo(item.rarity),
                    )}
                  >
                    {item.rarity === 'mitico' ? L('Mítico', 'Mythic') : item.rarity === 'epico' ? L('Épico', 'Epic') : item.rarity === 'raro' ? L('Raro', 'Rare') : L('Comum', 'Common')}
                  </span>
                </div>

                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  {item.priceBroCents != null && item.priceBroCents > 0 && (
                    <span className="inline-flex items-baseline gap-1">
                      <span className="font-impact text-[17px] leading-none tabular-nums text-papel">{formatBro(item.priceBroCents)}</span>
                      <span className="font-prova text-[10px] font-bold tracking-[0.14em] text-mudo">BRO</span>
                    </span>
                  )}
                  {item.priceExp != null && item.priceExp > 0 && (
                    <span className="inline-flex items-baseline gap-1">
                      <span className="font-impact text-[17px] leading-none tabular-nums text-papel">{item.priceExp.toLocaleString(LOCALE)}</span>
                      <span className="font-prova text-[10px] font-bold tracking-[0.14em] text-mudo">EXP</span>
                    </span>
                  )}
                  {item.consumable && inv > 0 && (
                    <span className="font-prova text-[10px] font-bold uppercase tracking-[0.12em] text-suave">
                      {inv}× {L('no estoque', 'in stock')}
                    </span>
                  )}
                  {isPremium && (
                    <span className="font-prova text-[10px] font-bold uppercase tracking-[0.12em] text-ouro-27">Premium</span>
                  )}
                  <span className="ml-auto inline-flex items-center gap-1 font-impact text-[15px] uppercase leading-none text-mudo transition-colors group-hover:text-rua">
                    {L('Comprar', 'Buy')} <span aria-hidden>→</span>
                  </span>
                </div>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
