import { type ReactNode, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';
import { useGameStore } from '@/game/store';
import { matchdayHomeCrestUrl } from '@/settings/matchdayCrest';

/**
 * Dígito animado: quando o valor muda, o número novo "cai" de cima com bounce,
 * o placar pulsa com scale, e um bloco de rua pisca atrás por 1s (DS 2027: sem glow).
 */
function AnimatedScore({ value, side }: { value: number; side: 'home' | 'away' }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (value !== prev.current) {
      prev.current = value;
      setKey((k) => k + 1);
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span className="relative inline-flex items-center justify-center">
      {/* fundo verde que pisca no gol */}
      <AnimatePresence>
        {flash && (
          <motion.span
            key="flash"
            initial={{ opacity: 0.85, scale: 1.6 }}
            animate={{ opacity: 0, scale: 2.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className={cn(
              'pointer-events-none absolute inset-0',
              side === 'home' ? 'bg-rua/60' : 'bg-rua/40',
            )}
          />
        )}
      </AnimatePresence>

      {/* número com pulse */}
      <motion.span
        key={key}
        initial={{ y: -28, opacity: 0, scale: 0.7 }}
        animate={
          flash
            ? { y: 0, opacity: 1, scale: [0.7, 1.35, 0.95, 1.08, 1] }
            : { y: 0, opacity: 1, scale: 1 }
        }
        transition={{ type: 'spring', stiffness: 420, damping: 18 }}
        className="relative font-spray font-black tabular-nums text-rua"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </motion.span>
    </span>
  );
}

const crestSize = {
  /** Linhas compactas / placar */
  sm: 'h-8 w-8 min-h-8 min-w-8 max-h-8 max-w-8 object-contain shrink-0',
  /** Partida rápida / live ribbon */
  md: 'h-10 w-10 min-h-10 min-w-10 sm:h-11 sm:w-11 sm:min-h-11 sm:min-w-11 object-contain shrink-0',
  /**
   * Faixa [casa][relógio][visitante] numa única linha (mobile → desktop).
   * Brasões mais pequenos no telemóvel para caber sem quebrar linha.
   */
  quick:
    'h-7 w-7 min-h-7 min-w-7 max-h-7 max-w-7 object-contain shrink-0 min-[400px]:h-9 min-[400px]:w-9 min-[400px]:min-h-9 min-[400px]:min-w-9 min-[400px]:max-h-9 min-[400px]:max-w-9 sm:h-10 sm:w-10 sm:min-h-10 sm:min-w-10 sm:max-h-10 sm:max-w-10 md:h-11 md:w-11 md:min-h-11 md:min-w-11 md:max-h-11 md:max-w-11',
  /** Banner matchday — compacto para caber nomes completos na mesma linha (brasão largo limitado). */
  lg: 'h-[1.3rem] w-auto max-h-[1.45rem] max-w-[min(2.85rem,14vw)] object-contain object-left shrink-0 sm:h-[1.5rem] sm:max-h-[1.65rem] sm:max-w-[min(3.35rem,16vw)] md:h-[1.7rem] md:max-h-[1.9rem] md:max-w-[min(4rem,14vw)] lg:h-[1.85rem] lg:max-h-[2.05rem] lg:max-w-[min(4.75rem,11vw)]',
  /**
   * Título “OLE … vs …” no banner da Home — brasões maiores para aproveitar logos HD (ex.: API-Sports ~150px).
   * `object-contain` + teto de largura evita esmagar nomes longos em mobile.
   */
  banner:
    'h-9 w-auto max-h-9 max-w-[min(3.25rem,18vw)] object-contain object-center shrink-0 sm:h-10 sm:max-h-10 sm:max-w-[min(3.75rem,16vw)] md:h-11 md:max-h-11 md:max-w-[min(4.25rem,14vw)] lg:h-12 lg:max-h-12 lg:max-w-[min(4.75rem,12vw)] xl:h-[3.25rem] xl:max-h-[3.35rem] xl:max-w-[min(5.25rem,11vw)]',
} as const;

/** Brasão sintético do adversário (IA). */
export function AwayCrestBadge({
  seed,
  className,
  size = 'md',
}: {
  seed: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'quick' | 'banner';
}) {
  const letter = (seed.trim().charAt(0) || '?').toUpperCase();
  const box =
    size === 'sm'
      ? 'h-8 w-8 min-w-8 text-[11px]'
      : size === 'banner'
        ? 'h-9 w-9 min-w-9 text-xs sm:h-10 sm:w-10 sm:min-w-10 sm:text-sm md:h-11 md:w-11 md:min-w-11 md:text-sm lg:h-12 lg:w-12 lg:min-w-12 lg:text-base xl:h-[3.25rem] xl:w-[3.25rem] xl:min-w-[3.25rem] xl:text-lg'
        : size === 'lg'
          ? 'h-[1.2rem] w-[1.2rem] min-w-[1.2rem] text-[9px] sm:h-[1.4rem] sm:w-[1.4rem] sm:min-w-[1.4rem] sm:text-[10px] md:h-[1.55rem] md:w-[1.55rem] md:min-w-[1.55rem] md:text-[11px] lg:h-[1.7rem] lg:w-[1.7rem] lg:min-w-[1.7rem] lg:text-xs'
          : size === 'quick'
            ? 'h-7 w-7 min-w-7 text-[10px] min-[400px]:h-8 min-[400px]:w-8 min-[400px]:min-w-8 min-[400px]:text-[11px] sm:h-10 sm:w-10 sm:min-w-10 sm:text-xs md:h-11 md:w-11 md:min-w-11'
            : 'h-10 w-10 min-w-10 text-xs sm:h-11 sm:w-11 sm:min-w-11';
  return (
    <span
      className={cn(
        // DS 2027: escudo sintético é um adesivo de cal — sem matiz aleatório.
        'inline-flex aspect-square items-center justify-center bg-cal font-impact leading-none text-asfalto-27',
        box,
        className,
      )}
      aria-hidden
    >
      {letter}
    </span>
  );
}

/** Escudo real do adversário (`nextFixture.opponent.supporterCrestUrl`) ou badge sintético. */
function AwayCrestOrPhoto({
  seed,
  imageUrl,
  className,
  size = 'md',
}: {
  seed: string;
  imageUrl?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'quick' | 'banner';
}) {
  const u = imageUrl?.trim();
  if (u) {
    return (
      <img
        src={u}
        alt=""
        className={cn(crestSize[size], className)}
        draggable={false}
        decoding="async"
      />
    );
  }
  return <AwayCrestBadge seed={seed} size={size} className={className} />;
}

/**
 * Duelo no banner: nomes completos (sem truncar), em Anton.
 */
export function MatchdayVersusTitle({
  homeName,
  awayName,
  awaySeed,
  className,
  vsClassName,
}: {
  homeName: string;
  awayName: string;
  awaySeed?: string;
  className?: string;
  vsClassName?: string;
}) {
  const crest = useGameStore((s) => matchdayHomeCrestUrl(s.userSettings));
  const fallbackAway = useGameStore((s) => s.nextFixture.opponent.id);
  const awayCrestUrl = useGameStore((s) => s.nextFixture.opponent.supporterCrestUrl?.trim() ?? null);
  const seed = awaySeed ?? fallbackAway;

  const nameText =
    'min-w-0 max-w-full whitespace-normal break-words text-pretty text-papel [word-spacing:normal]';

  return (
    <h2
      className={cn(
        'font-impact uppercase leading-snug tracking-normal',
        className,
      )}
      style={{ letterSpacing: '0.01em' }}
    >
      <span className="flex w-full min-w-0 items-center justify-center gap-1 px-0.5 sm:gap-1.5 sm:px-1 md:gap-3">
        {/* Metade esquerda: bloco [brasão + nome] junto ao “vs”, sem esticar o nome e isolar o brasão */}
        <span className="flex min-w-0 min-h-0 flex-1 justify-end">
          <span className="flex max-w-full min-w-0 items-center justify-end gap-1 sm:gap-1.5 md:gap-2">
            {crest ? (
              <img
                src={crest}
                alt=""
                className={cn(crestSize.banner, 'shrink-0')}
                draggable={false}
                decoding="async"
              />
            ) : null}
            <span className={cn(nameText, 'text-end')}>{homeName}</span>
          </span>
        </span>
        <span
          aria-label="versus"
          className={cn(
            'shrink-0 font-voz normal-case leading-none text-rua',
            vsClassName,
          )}
          style={{
            fontSize: '1.6em',
            transform: 'translateY(-0.06em)',
          }}
        >
          x
        </span>
        {/* Metade direita: bloco [nome + brasão] colado ao “vs” */}
        <span className="flex min-w-0 min-h-0 flex-1 justify-start">
          <span className="flex max-w-full min-w-0 items-center justify-start gap-1 sm:gap-1.5 md:gap-2">
            <span className={cn(nameText, 'text-start')}>{awayName}</span>
            <AwayCrestOrPhoto seed={seed} imageUrl={awayCrestUrl} size="banner" className="shrink-0" />
          </span>
        </span>
      </span>
    </h2>
  );
}

/** Linha compacta (pré-match, countdown, pós-jogo). */
export function MatchdayVersusInline({
  homeShort,
  awayShort,
  awaySeed,
  className,
}: {
  homeShort: string;
  awayShort: string;
  awaySeed?: string;
  className?: string;
}) {
  const crest = useGameStore((s) => matchdayHomeCrestUrl(s.userSettings));
  const fallbackAway = useGameStore((s) => s.nextFixture.opponent.id);
  const awayCrestUrl = useGameStore((s) => s.nextFixture.opponent.supporterCrestUrl?.trim() ?? null);
  const seed = awaySeed ?? fallbackAway;

  return (
    <span
      className={cn(
        'inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-display font-bold tracking-wide',
        className,
      )}
    >
      <span className="inline-flex min-w-0 max-w-[min(100%,14rem)] items-center gap-2">
        {crest ? <img src={crest} alt="" className={crestSize.sm} /> : null}
        <span className="text-papel [overflow-wrap:anywhere]">{homeShort}</span>
      </span>
      <span className="shrink-0 font-voz text-mudo">x</span>
      <span className="inline-flex min-w-0 max-w-[min(100%,14rem)] flex-row-reverse items-center gap-2">
        <AwayCrestOrPhoto seed={seed} imageUrl={awayCrestUrl} size="sm" />
        <span className="text-right text-papel [overflow-wrap:anywhere]">{awayShort}</span>
      </span>
    </span>
  );
}

/**
 * Barra com relógio (partida rápida) — nomes completos opcionais, logos maiores.
 * `scoreboardCountdownSec`: contagem 10→1 por baixo do cronómetro (só 1–10).
 */
export function MatchdayVersusWithClock({
  homeShort,
  awayShort,
  homeName,
  awayName,
  awaySeed,
  clock,
  scoreboardCountdownSec,
  rowClassName,
  showTeamCrests = true,
}: {
  homeShort: string;
  awayShort: string;
  homeName?: string;
  awayName?: string;
  awaySeed?: string;
  clock: string | ReactNode;
  /** Segundos restantes (1–10) por baixo do relógio oficial, em amarelo; omitir fora desse intervalo. */
  scoreboardCountdownSec?: number | null;
  rowClassName?: string;
  /** Quando falso, só nomes/siglas (ex.: partida rápida sem brasões). */
  showTeamCrests?: boolean;
}) {
  const crest = useGameStore((s) => matchdayHomeCrestUrl(s.userSettings));
  const fallbackAway = useGameStore((s) => s.nextFixture.opponent.id);
  const awayCrestUrl = useGameStore((s) => s.nextFixture.opponent.supporterCrestUrl?.trim() ?? null);
  const seed = awaySeed ?? fallbackAway;
  const homeLabel = homeName?.trim() || homeShort;
  const awayLabel = awayName?.trim() || awayShort;
  const showRibbonCountdown =
    typeof scoreboardCountdownSec === 'number'
    && scoreboardCountdownSec >= 1
    && scoreboardCountdownSec <= 10
    && Number.isInteger(scoreboardCountdownSec);

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-row flex-nowrap items-center justify-between gap-1.5 min-[360px]:gap-2 sm:gap-3 md:gap-4',
        'py-0.5 sm:py-0',
        rowClassName,
      )}
    >
      <div className="flex min-w-0 flex-1 basis-0 items-center justify-end gap-1 min-[360px]:gap-1.5 sm:gap-2 md:gap-3">
        {showTeamCrests && crest ? <img src={crest} alt="" className={crestSize.quick} /> : null}
        <span
          className="min-w-0 truncate text-end font-impact leading-tight text-papel uppercase"
          style={{
            fontSize: 'clamp(11px, 2.2vw, 18px)',
            letterSpacing: '0.01em',
          }}
        >
          {homeLabel}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-center justify-center gap-0 leading-none">
        <span className="bg-concreto px-1.5 py-0.5 font-spray text-[14px] font-black tabular-nums text-papel min-[400px]:px-2 min-[400px]:py-1 min-[400px]:text-[16px] sm:text-[18px]">
          {clock}
        </span>
        {showRibbonCountdown ? (
          <span
            className="mt-0.5 font-spray text-[12px] font-black tabular-nums text-rua min-[400px]:text-sm sm:text-base"
            aria-live="polite"
            aria-label={L(`Contagem regressiva: ${scoreboardCountdownSec} segundos`, `Countdown: ${scoreboardCountdownSec} seconds`)}
          >
            {scoreboardCountdownSec}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 basis-0 items-center justify-start gap-1 min-[360px]:gap-1.5 sm:gap-2 md:gap-3">
        <span
          className="min-w-0 truncate text-start font-impact leading-tight text-suave uppercase"
          style={{
            fontSize: 'clamp(11px, 2.2vw, 18px)',
            letterSpacing: '0.01em',
          }}
        >
          {awayLabel}
        </span>
        {showTeamCrests ? <AwayCrestOrPhoto seed={seed} imageUrl={awayCrestUrl} size="quick" /> : null}
      </div>
    </div>
  );
}

/** Faixa de placar ao vivo (3D). */
export function MatchdayLiveScoreRibbon({
  minuteDisplay,
  homeShort,
  awayShort,
  awaySeed,
  homeScore,
  awayScore,
}: {
  minuteDisplay: string | number;
  homeShort: string;
  awayShort: string;
  awaySeed?: string;
  homeScore: number;
  awayScore: number;
}) {
  const crest = useGameStore((s) => matchdayHomeCrestUrl(s.userSettings));
  const fallbackAway = useGameStore((s) => s.nextFixture.opponent.id);
  const awayCrestUrl = useGameStore((s) => s.nextFixture.opponent.supporterCrestUrl?.trim() ?? null);
  const seed = awaySeed ?? fallbackAway;

  return (
    <div className="pointer-events-auto flex max-w-[min(100dvw-2rem,42rem)] min-w-0 items-stretch">
      <div className="flex shrink-0 items-center justify-center bg-rua px-3 py-2 font-spray text-xl font-black text-asfalto-27 tabular-nums sm:px-4 sm:text-2xl">
        {minuteDisplay}&apos;
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3 bg-concreto px-3 py-2 sm:gap-6 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-lg sm:gap-3 sm:text-xl">
          <span className="inline-flex min-w-0 items-center gap-2">
            {crest ? <img src={crest} alt="" className={crestSize.md} /> : null}
            <span className="truncate font-impact uppercase text-papel">{homeShort}</span>
          </span>
          <span className="shrink-0 font-spray text-2xl font-black tabular-nums text-rua sm:text-3xl">
            {homeScore}
          </span>
        </div>
        <div className="h-6 w-0.5 shrink-0 bg-linha" />
        <div className="flex min-w-0 flex-1 items-center gap-2 text-lg sm:gap-3 sm:text-xl">
          <span className="shrink-0 font-spray text-2xl font-black tabular-nums text-papel sm:text-3xl">
            {awayScore}
          </span>
          <span className="inline-flex min-w-0 flex-row-reverse items-center gap-2">
            <AwayCrestOrPhoto seed={seed} imageUrl={awayCrestUrl} size="md" />
            <span className="truncate font-impact uppercase text-suave">{awayShort}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function MatchdayResultScores({
  homeShort,
  awayShort,
  homeName,
  awayName,
  homeScore,
  awayScore,
  awaySeed,
  className,
  showTeamCrests = true,
}: {
  homeShort: string;
  awayShort: string;
  homeName?: string;
  awayName?: string;
  homeScore: number;
  awayScore: number;
  awaySeed?: string;
  className?: string;
  showTeamCrests?: boolean;
}) {
  const crest = useGameStore((s) => matchdayHomeCrestUrl(s.userSettings));
  const fallbackAway = useGameStore((s) => s.nextFixture.opponent.id);
  const awayCrestUrl = useGameStore((s) => s.nextFixture.opponent.supporterCrestUrl?.trim() ?? null);
  const seed = awaySeed ?? fallbackAway;
  const homeLabel = homeName?.trim() || homeShort;
  const awayLabel = awayName?.trim() || awayShort;

  return (
    <p
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-2 gap-y-2 font-impact uppercase text-papel sm:gap-x-3',
        className,
      )}
    >
      <span className="inline-flex max-w-[min(100%,16rem)] items-center gap-2 sm:max-w-[min(100%,20rem)] sm:gap-2.5">
        {showTeamCrests && crest ? <img src={crest} alt="" className={crestSize.md} /> : null}
        <span className="text-center leading-tight [overflow-wrap:anywhere]">{homeLabel}</span>
      </span>
      <AnimatedScore value={homeScore} side="home" />
      <span className="shrink-0 font-spray font-black text-mudo">×</span>
      <AnimatedScore value={awayScore} side="away" />
      <span className="inline-flex max-w-[min(100%,16rem)] flex-row-reverse items-center gap-2 sm:max-w-[min(100%,20rem)] sm:gap-2.5">
        {showTeamCrests ? <AwayCrestOrPhoto seed={seed} imageUrl={awayCrestUrl} size="md" /> : null}
        <span className="text-center leading-tight [overflow-wrap:anywhere]">{awayLabel}</span>
      </span>
    </p>
  );
}

/** Cabeçalho de coluna de alinhamento (casa / visitante). */
export function MatchdayLineupColumnTitle({
  side,
  name,
  className,
  awaySeed,
  teamCrestSize = 'md',
  showTeamCrest = true,
}: {
  side: 'home' | 'away';
  name: string;
  className?: string;
  awaySeed?: string;
  teamCrestSize?: 'sm' | 'md';
  /** Quando falso, só o nome do clube (sem escudo). */
  showTeamCrest?: boolean;
}) {
  const crest = useGameStore((s) => matchdayHomeCrestUrl(s.userSettings));
  const fallbackAway = useGameStore((s) => s.nextFixture.opponent.id);
  const awayCrestUrl = useGameStore((s) => s.nextFixture.opponent.supporterCrestUrl?.trim() ?? null);
  const seed = awaySeed ?? fallbackAway;
  const imgCls = teamCrestSize === 'sm' ? crestSize.sm : crestSize.md;

  return (
    <span
      className={cn(
        'inline-flex min-w-0 max-w-full items-center gap-2 sm:gap-2.5',
        side === 'away' && 'flex-row-reverse text-right',
        className,
      )}
    >
      {showTeamCrest ? (
        side === 'home' ? (
          crest ? <img src={crest} alt="" className={imgCls} /> : null
        ) : (
          <AwayCrestOrPhoto
            seed={seed}
            imageUrl={awayCrestUrl}
            size={teamCrestSize === 'sm' ? 'sm' : 'md'}
          />
        )
      ) : null}
      <span className="min-w-0 font-impact uppercase leading-snug [overflow-wrap:anywhere]">{name}</span>
    </span>
  );
}
