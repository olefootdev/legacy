import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { quickMatchPortraitSrc } from '@/lib/quickMatchPortrait';

/** Mesmo visual que o card horizontal em `Team.tsx` (foto + badge canto). */
export type TeamCardVisualStyle = 'neon-yellow' | 'white' | 'gray-400';

const PORTRAIT_MASK: CSSProperties = {
  maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
  WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
};

export function TeamStylePortraitColumn({
  portraitSeed,
  style: playerStyle,
  badgeText,
  /** Partida rápida: imagem cobre toda a coluna, sem “moldura” nem badge na foto. */
  fullBleed,
  className,
}: {
  portraitSeed: string;
  style: TeamCardVisualStyle;
  /** Omitir em partida rápida quando a nota vai para fora da foto. */
  badgeText?: string;
  fullBleed?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative shrink-0 self-stretch overflow-hidden border-r border-white/10 bg-neutral-900',
        fullBleed
          ? 'w-[3.75rem] min-h-0 sm:w-[4.25rem] md:w-[4.5rem]'
          : 'flex min-h-[4.75rem] w-[4.25rem] flex-col items-center justify-end pt-2 sm:min-h-[5.25rem] sm:w-20 sm:pt-3 md:w-24 md:pt-4',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0',
          fullBleed ? 'opacity-[0.04]' : 'opacity-20',
          playerStyle === 'neon-yellow' ? 'bg-neon-yellow' : 'bg-white',
        )}
      />
      <img
        src={quickMatchPortraitSrc(portraitSeed, 200, 300)}
        alt=""
        className={cn(
          'relative z-0 grayscale transition-all duration-300 group-hover:grayscale-0',
          fullBleed
            ? 'absolute inset-0 h-full w-full object-cover object-top'
            : 'h-[90%] w-[80%] object-cover object-top',
        )}
        referrerPolicy="no-referrer"
        style={fullBleed ? undefined : PORTRAIT_MASK}
      />
      {badgeText != null && badgeText !== '' && (
        <div
          className={cn(
            'absolute left-1 top-1 z-[1] rounded px-1 py-0.5 font-display text-[9px] font-black tabular-nums drop-shadow-md sm:left-1.5 sm:top-1.5 sm:px-1.5 sm:text-[10px]',
            playerStyle === 'neon-yellow'
              ? 'bg-neon-yellow text-black'
              : 'bg-black/80 text-white border border-white/20',
          )}
        >
          {badgeText}
        </div>
      )}
    </div>
  );
}
