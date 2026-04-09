import { useGameStore } from '@/game/store';
import type { BannerSlotId } from '@/ui/banners';
import { resolveUiBannerImageUrl } from '@/ui/banners';
import { cn } from '@/lib/utils';

type Props = {
  slot: BannerSlotId;
  className?: string;
  imgClassName?: string;
  overlayClassName?: string;
  /** Opacidade da imagem (0–1). */
  imageOpacity?: number;
};

export function GameBannerBackdrop({
  slot,
  className,
  imgClassName,
  overlayClassName,
  imageOpacity = 0.42,
}: Props) {
  const entry = useGameStore((s) => s.uiBanners?.[slot]);
  const url = resolveUiBannerImageUrl(entry);
  if (!url) return null;
  return (
    <div className={cn('absolute inset-0 pointer-events-none overflow-hidden', className)} aria-hidden>
      <img
        src={url}
        alt=""
        className={cn('h-full w-full object-cover', imgClassName)}
        style={{ opacity: imageOpacity }}
      />
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent',
          overlayClassName,
        )}
      />
    </div>
  );
}
