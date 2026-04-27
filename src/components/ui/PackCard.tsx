import { cn } from '@/lib/utils';
import { Badge } from './Badge';

type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

const RARITY_VARIANT: Record<Rarity, 'default' | 'rare' | 'epic' | 'legendary'> = {
  common: 'default',
  rare: 'rare',
  epic: 'epic',
  legendary: 'legendary',
};

/**
 * Card de pacote da loja — glow amarelo no hover, badge de raridade,
 * preço em Moret italic. Featured pack: passar `featured` para ocupar
 * a row inteira (parent precisa ter `display: grid`).
 */
export function PackCard({
  title,
  description,
  rarity,
  priceLabel,
  priceCurrency = 'OLE',
  imageUrl,
  onPurchase,
  disabled = false,
  featured = false,
  className,
}: {
  title: string;
  description?: string;
  rarity: Rarity;
  /** Texto cru do preço — número formatado pelo caller. */
  priceLabel: string;
  priceCurrency?: string;
  imageUrl?: string;
  onPurchase?: () => void;
  disabled?: boolean;
  featured?: boolean;
  className?: string;
}) {
  return (
    <article
      className={cn(
        'ole-player-card ole-yellow-glow relative cursor-pointer transition-all duration-200',
        'hover:border-neon-yellow hover:-translate-y-1',
        featured && 'col-span-full',
        disabled && 'opacity-60 pointer-events-none',
        className,
      )}
    >
      <div
        className={cn(
          'relative flex',
          featured ? 'flex-col md:flex-row min-h-[280px]' : 'flex-col min-h-[260px]',
        )}
      >
        {/* Imagem / placeholder */}
        <div
          className={cn(
            'relative bg-deep-black flex items-center justify-center overflow-hidden',
            featured ? 'md:w-2/5 aspect-[3/2] md:aspect-auto' : 'aspect-[3/2]',
          )}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <span
              className="font-display font-black text-text-soft uppercase tracking-widest opacity-25"
              style={{ fontSize: featured ? 96 : 64 }}
              aria-hidden
            >
              ⚽
            </span>
          )}
          <div className="absolute top-3 left-3 z-20">
            <Badge variant={RARITY_VARIANT[rarity]} className="text-[10px] px-2 py-1">
              {rarity}
            </Badge>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-5 flex flex-col justify-between gap-4">
          <div>
            <h3 className="ole-headline text-[20px] sm:text-[24px] text-white leading-tight">
              {title}
            </h3>
            {description ? (
              <p className="mt-2 text-text-soft text-[13px] leading-relaxed">{description}</p>
            ) : null}
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="leading-none">
              <span className="text-text-soft uppercase text-[10px] tracking-[0.18em] font-medium">
                {priceCurrency}
              </span>
              <p
                className="text-neon-yellow leading-none mt-0.5 tabular-nums"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontSize: featured ? '48px' : '32px',
                }}
              >
                {priceLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onPurchase}
              disabled={disabled}
              className="bg-neon-yellow text-black font-display font-bold uppercase tracking-[0.12em] text-[13px] px-5 py-2.5 -skew-x-6 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="inline-block skew-x-6">Adquirir</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
