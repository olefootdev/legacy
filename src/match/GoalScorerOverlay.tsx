import { motion } from 'motion/react';
import {
  TeamStylePortraitColumn,
  type TeamCardVisualStyle,
} from '@/components/match/TeamStylePortraitColumn';
import { cn } from '@/lib/utils';

export interface GoalScorerOverlayProps {
  scorerName: string;
  scorerNumber?: number;
  minute: number;
  side: 'home' | 'away';
  homeShort: string;
  awayShort: string;
  homeScore: number;
  awayScore: number;
  /** Frase curta emocional sob o nome (substitui o antigo “Jogo posicional”). */
  storyline?: string;
  goalBuildUp?: 'positional' | 'counter';
  /** Seed picsum (igual à partida rápida / Meu Time). */
  scorerPortraitSeed?: string;
  scorerCardStyle?: TeamCardVisualStyle;
  className?: string;
}

/** Partida rápida: cartão de golo acima do placar (fluxo da página), um único fade vertical. */
export function GoalScorerOverlay({
  scorerName,
  scorerNumber,
  minute,
  side,
  homeShort,
  awayShort,
  homeScore,
  awayScore,
  storyline,
  goalBuildUp,
  scorerPortraitSeed,
  scorerCardStyle = 'gray-400',
  className,
}: GoalScorerOverlayProps) {
  const accent = side === 'home' ? 'text-neon-yellow' : 'text-white';
  const dorsalBadge =
    scorerNumber != null && scorerNumber > 0 ? String(scorerNumber) : '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={cn('w-full', className)}
      role="status"
      aria-live="assertive"
      aria-label={`Golo de ${scorerName}`}
    >
      <div
        className={cn(
          'glass-panel w-full p-5 border text-center',
          'border-neon-yellow/45 shadow-[0_0_40px_rgba(234,255,0,0.18)]',
        )}
      >
        <p className="font-display font-black text-2xl sm:text-3xl uppercase tracking-[0.2em] text-neon-yellow">
          Golo!
        </p>

        <div className="mt-6 flex flex-col items-stretch gap-4">
          <div className="flex min-h-[6rem] items-stretch gap-0 overflow-hidden rounded-xl border border-white/10 bg-dark-gray/80 sm:min-h-[6.75rem] sm:gap-0">
            {scorerPortraitSeed ? (
              <TeamStylePortraitColumn
                portraitSeed={scorerPortraitSeed}
                style={scorerCardStyle}
                badgeText={dorsalBadge}
                fullBleed
                className="!w-[6.25rem] rounded-none border-y-0 border-l-0 border-r border-white/10 sm:!w-28 md:!w-32"
              />
            ) : (
              <div
                className={cn(
                  'flex min-h-[6rem] w-[6.25rem] shrink-0 items-center justify-center border-r border-white/10 bg-black/50 font-display text-3xl font-black tabular-nums sm:min-h-[6.75rem] sm:w-28 md:w-32',
                  accent,
                )}
                aria-hidden
              >
                {dorsalBadge}
              </div>
            )}
            <div className="min-w-0 flex flex-1 flex-col justify-center p-3 text-left sm:p-4">
              <p
                className={cn(
                  'font-display text-lg font-black uppercase italic leading-tight tracking-wide sm:text-2xl',
                  accent,
                  'truncate',
                )}
              >
                {scorerName}
              </p>
              <p className="mt-1.5 text-[13px] font-medium leading-snug text-gray-400 sm:text-sm">
                <span className="font-display font-bold tabular-nums text-gray-500">{minute}&apos;</span>
                {storyline ? (
                  <>
                    <span className="mx-1.5 text-gray-600">·</span>
                    <span className="text-gray-300">{storyline}</span>
                  </>
                ) : goalBuildUp === 'counter' ? (
                  <>
                    <span className="mx-1.5 text-gray-600">·</span>
                    <span className="text-gray-400">Contra-ataque</span>
                  </>
                ) : goalBuildUp === 'positional' ? (
                  <>
                    <span className="mx-1.5 text-gray-600">·</span>
                    <span className="text-gray-400">Jogo posicional</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-lg border border-white/10 bg-black/30 px-4 py-3 font-display font-black text-lg tabular-nums">
            <span className={side === 'home' ? 'text-neon-yellow' : 'text-gray-500'}>{homeShort}</span>
            <span className="text-2xl text-white">
              <span className={side === 'home' ? 'text-neon-yellow' : ''}>{homeScore}</span>
              <span className="mx-1 text-gray-600">–</span>
              <span className={side === 'away' ? 'text-white' : 'text-gray-400'}>{awayScore}</span>
            </span>
            <span className={side === 'away' ? 'text-white' : 'text-gray-500'}>{awayShort}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
