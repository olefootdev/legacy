import { motion } from 'motion/react';
import {
  TeamStylePortraitColumn,
  type TeamCardVisualStyle,
} from '@/components/match/TeamStylePortraitColumn';
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';

export interface GoalScorerOverlayProps {
  scorerName: string;
  scorerNumber?: number;
  minute: number;
  side: 'home' | 'away';
  homeShort: string;
  awayShort: string;
  homeScore: number;
  awayScore: number;
  /** Quando false exibe “Defesa!” em vez de “Gol!”. Default true. */
  isGoal?: boolean;
  /** Frase curta emocional sob o nome (substitui o antigo “Jogo posicional”). */
  storyline?: string;
  goalBuildUp?: 'positional' | 'counter';
  /** Seed picsum (igual à partida rápida / Meu Time). */
  scorerPortraitSeed?: string;
  /** URL direta do retrato (prioridade sobre seed picsum). */
  scorerPortraitUrl?: string;
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
  isGoal = true,
  goalBuildUp,
  scorerPortraitSeed,
  scorerPortraitUrl,
  scorerCardStyle = 'gray-400',
  className,
}: GoalScorerOverlayProps) {
  const nosso = side === 'home';
  const dorsalBadge =
    scorerNumber != null && scorerNumber > 0 ? String(scorerNumber) : '—';
  const titulo = isGoal ? (nosso ? L('Gol!', 'Goal!') : L('Tomamos gol...', 'We conceded...')) : L('Defesa!', 'Save!');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={cn('w-full', className)}
      role="status"
      aria-live="assertive"
      aria-label={L(`Gol de ${scorerName}`, `Goal by ${scorerName}`)}
    >
      <div
        className={cn(
          'relative w-full overflow-hidden px-5 pb-5 pt-4 text-center',
          nosso ? 'bg-rua text-asfalto-27' : 'rua-grao bg-concreto text-papel border-l-[4px] border-baixa',
        )}
      >
        {nosso ? (
          <span aria-hidden className="rua-alambrado pointer-events-none absolute inset-x-0 top-0 h-24 [--alambrado:rgba(13,13,12,0.24)]" />
        ) : (
          <>
            <img
              src="/test-pitch/tomamos-o-gol.jpg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-20 grayscale"
            />
            {/* Escurece a foto pra leitura (preto → transparente). */}
            <div className="absolute inset-0 bg-gradient-to-t from-asfalto-27/90 via-asfalto-27/50 to-asfalto-27/70" />
          </>
        )}

        {/* GOL em spray — pichado no muro */}
        <p
          className={cn(
            'relative z-10 font-spray font-black uppercase leading-[0.85]',
            nosso ? 'text-asfalto-27' : isGoal ? 'text-papel' : 'text-rua',
          )}
          style={{ fontSize: nosso || !isGoal ? 'clamp(64px, 22vw, 112px)' : 'clamp(40px, 12vw, 64px)' }}
        >
          {titulo}
        </p>

        <div className="relative z-10 mt-4 flex min-w-0 items-center gap-4 text-left">
          {/* Lambe do artilheiro: foto colada torta + fita adesiva */}
          <div className="relative shrink-0 -rotate-3">
            <span aria-hidden className="absolute -top-2.5 left-1/2 z-10 h-5 w-14 -translate-x-1/2 rotate-[5deg] bg-papel/70" />
            <div className={cn('relative h-24 w-20 overflow-hidden border-4 sm:h-28 sm:w-24', nosso ? 'border-asfalto-27 bg-asfalto-27' : 'border-papel bg-asfalto-27')}>
              {scorerPortraitUrl ? (
                <img
                  src={scorerPortraitUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-top"
                  referrerPolicy="no-referrer"
                />
              ) : scorerPortraitSeed ? (
                <TeamStylePortraitColumn
                  portraitSeed={scorerPortraitSeed}
                  style={scorerCardStyle}
                  badgeText={dorsalBadge}
                  fullBleed
                  className="!h-full !w-full rounded-none border-0"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-spray font-black text-[40px] leading-none tabular-nums text-rua" aria-hidden>
                  {dorsalBadge}
                </span>
              )}
              {scorerPortraitUrl ? (
                <span className="absolute bottom-0 left-0 z-[1] bg-asfalto-27 px-1.5 py-0.5 font-impact text-[12px] leading-none tabular-nums text-rua">
                  {dorsalBadge}
                </span>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-voz text-[clamp(28px,8vw,40px)] leading-[0.98] [overflow-wrap:anywhere]">
              {scorerName}
            </p>
            <p className={cn('mt-1.5 text-[13px] leading-snug', nosso ? 'text-asfalto-27/80' : 'text-suave')}>
              <span className="font-spray font-black text-[20px] tabular-nums">{minute}&apos;</span>
              {storyline ? (
                <>
                  <span className="mx-1.5 opacity-50">·</span>
                  <span>{storyline}</span>
                </>
              ) : goalBuildUp === 'counter' ? (
                <>
                  <span className="mx-1.5 opacity-50">·</span>
                  <span>{L('Contra-ataque', 'Counter-attack')}</span>
                </>
              ) : goalBuildUp === 'positional' ? (
                <>
                  <span className="mx-1.5 opacity-50">·</span>
                  <span>{L('Jogo posicional', 'Build-up play')}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        {/* Placar */}
        <div
          className={cn(
            'relative z-10 mt-5 flex min-w-0 items-center justify-center gap-3 px-3 py-2',
            nosso ? 'bg-asfalto-27 text-papel' : 'bg-asfalto-27/80 text-papel',
          )}
        >
          <span className={cn('min-w-0 truncate font-impact text-[16px] uppercase leading-none', nosso ? 'text-rua' : 'text-mudo')}>{homeShort}</span>
          <span className="shrink-0 font-spray font-black text-[34px] leading-none tabular-nums">
            <span className={nosso ? 'text-rua' : ''}>{homeScore}</span>
            <span className="mx-1 text-[0.6em] text-mudo">×</span>
            <span className={nosso ? 'text-suave' : 'text-papel'}>{awayScore}</span>
          </span>
          <span className={cn('min-w-0 truncate font-impact text-[16px] uppercase leading-none', nosso ? 'text-mudo' : 'text-papel')}>{awayShort}</span>
        </div>
      </div>
    </motion.div>
  );
}
