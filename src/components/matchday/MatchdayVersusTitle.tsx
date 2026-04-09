import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';

function hueFromSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 360;
}

const crestSize = {
  /** Linhas compactas / placar */
  sm: 'h-8 w-8 min-h-8 min-w-8 max-h-8 max-w-8 object-contain shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]',
  /** Partida rápida / live ribbon */
  md: 'h-10 w-10 min-h-10 min-w-10 sm:h-11 sm:w-11 sm:min-h-11 sm:min-w-11 object-contain shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]',
  /** Banner matchday — ~35% menor que a versão anterior (mobile). Brasão pode ser horizontal. */
  lg: 'h-[1.95rem] w-auto max-h-[2.28rem] sm:h-[2.28rem] sm:max-h-[2.44rem] max-w-[min(7.15rem,28vw)] object-contain object-left shrink-0 drop-shadow-[0_3px_10px_rgba(0,0,0,0.6)]',
} as const;

/** Brasão sintético do adversário (IA). */
export function AwayCrestBadge({
  seed,
  className,
  size = 'md',
}: {
  seed: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const hue = hueFromSeed(seed || 'away');
  const letter = (seed.trim().charAt(0) || '?').toUpperCase();
  const box =
    size === 'sm'
      ? 'h-8 w-8 min-w-8 text-[11px]'
      : size === 'lg'
        ? 'h-[1.79rem] w-[1.79rem] min-w-[1.79rem] text-[11px] sm:h-[2.11rem] sm:w-[2.11rem] sm:min-w-[2.11rem] sm:text-xs'
        : 'h-10 w-10 min-w-10 text-xs sm:h-11 sm:w-11 sm:min-w-11';
  return (
    <span
      className={cn(
        'inline-flex aspect-square items-center justify-center rounded-sm border border-white/35 font-display font-black leading-none text-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]',
        box,
        className,
      )}
      style={{
        background: `linear-gradient(145deg, hsla(${hue}, 58%, 46%, 0.95), hsla(${hue}, 45%, 18%, 0.98))`,
      }}
      aria-hidden
    >
      {letter}
    </span>
  );
}

/**
 * Título central tipo: [brasão] CASA vs FORA [badge] — nomes completos, quebra de linha, sem truncar.
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
  const crest = useGameStore((s) => s.userSettings.managerCrestPngDataUrl);
  const fallbackAway = useGameStore((s) => s.nextFixture.opponent.id);
  const seed = awaySeed ?? fallbackAway;

  return (
    <h2
      className={cn(
        'font-display font-black italic uppercase leading-tight tracking-tight text-balance',
        className,
      )}
    >
      <span className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-6 sm:gap-y-3">
        <span className="flex min-w-0 flex-col items-center gap-2 sm:max-w-[min(100%,22rem)] sm:flex-1 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          {crest ? <img src={crest} alt="" className={crestSize.lg} /> : null}
          <span className="text-center text-white sm:text-right sm:leading-[1.05]">{homeName}</span>
        </span>
        <span
          className={cn(
            'text-center font-black not-italic text-neon-yellow sm:shrink-0 sm:self-center',
            vsClassName,
          )}
        >
          vs
        </span>
        <span className="flex min-w-0 flex-col items-center gap-2 sm:max-w-[min(100%,22rem)] sm:flex-1 sm:flex-row-reverse sm:items-center sm:justify-end sm:gap-3">
          <AwayCrestBadge seed={seed} size="lg" />
          <span className="text-center text-white sm:text-left sm:leading-[1.05]">{awayName}</span>
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
  const crest = useGameStore((s) => s.userSettings.managerCrestPngDataUrl);
  const fallbackAway = useGameStore((s) => s.nextFixture.opponent.id);
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
        <span className="text-white [overflow-wrap:anywhere]">{homeShort}</span>
      </span>
      <span className="shrink-0 font-bold text-gray-500">x</span>
      <span className="inline-flex min-w-0 max-w-[min(100%,14rem)] flex-row-reverse items-center gap-2">
        <AwayCrestBadge seed={seed} size="sm" />
        <span className="text-right text-white [overflow-wrap:anywhere]">{awayShort}</span>
      </span>
    </span>
  );
}

/**
 * Barra com relógio (partida rápida) — nomes completos opcionais, logos maiores.
 */
export function MatchdayVersusWithClock({
  homeShort,
  awayShort,
  homeName,
  awayName,
  awaySeed,
  clock,
  rowClassName,
}: {
  homeShort: string;
  awayShort: string;
  homeName?: string;
  awayName?: string;
  awaySeed?: string;
  clock: string;
  rowClassName?: string;
}) {
  const crest = useGameStore((s) => s.userSettings.managerCrestPngDataUrl);
  const fallbackAway = useGameStore((s) => s.nextFixture.opponent.id);
  const seed = awaySeed ?? fallbackAway;
  const homeLabel = homeName?.trim() || homeShort;
  const awayLabel = awayName?.trim() || awayShort;

  return (
    <div
      className={cn(
        'grid w-full grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-2 md:gap-4',
        rowClassName,
      )}
    >
      <div className="flex min-w-0 items-center justify-center gap-2.5 sm:justify-start md:gap-3">
        {crest ? <img src={crest} alt="" className={crestSize.md} /> : null}
        <span className="text-center font-display font-bold leading-snug text-white [overflow-wrap:anywhere] sm:text-left sm:text-base md:text-lg">
          {homeLabel}
        </span>
      </div>
      <span className="mx-auto shrink-0 rounded bg-white/5 px-2 py-1 font-mono text-xs tabular-nums tracking-tight text-gray-300">
        {clock}
      </span>
      <div className="flex min-w-0 items-center justify-center gap-2.5 sm:justify-end md:gap-3">
        <span className="text-center font-display font-bold leading-snug text-gray-200 [overflow-wrap:anywhere] sm:text-right sm:text-base md:text-lg">
          {awayLabel}
        </span>
        <AwayCrestBadge seed={seed} size="md" />
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
  const crest = useGameStore((s) => s.userSettings.managerCrestPngDataUrl);
  const fallbackAway = useGameStore((s) => s.nextFixture.opponent.id);
  const seed = awaySeed ?? fallbackAway;

  return (
    <div className="pointer-events-auto flex max-w-[min(100vw-2rem,42rem)] items-stretch shadow-2xl">
      <div className="flex shrink-0 items-center justify-center bg-white px-3 py-2 font-display text-xl font-black text-black tabular-nums sm:px-4 sm:text-2xl">
        {minuteDisplay}&apos;
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3 border border-l-0 border-white/10 bg-[#111] px-3 py-2 sm:gap-6 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-lg sm:gap-3 sm:text-xl">
          <span className="inline-flex min-w-0 items-center gap-2">
            {crest ? <img src={crest} alt="" className={crestSize.md} /> : null}
            <span className="truncate font-display font-bold tracking-wider">{homeShort}</span>
          </span>
          <span className="shrink-0 font-display text-2xl font-black tabular-nums text-neon-yellow sm:text-3xl">
            {homeScore}
          </span>
        </div>
        <div className="h-6 w-px shrink-0 bg-white/20" />
        <div className="flex min-w-0 flex-1 items-center gap-2 text-lg sm:gap-3 sm:text-xl">
          <span className="shrink-0 font-display text-2xl font-black tabular-nums text-white sm:text-3xl">
            {awayScore}
          </span>
          <span className="inline-flex min-w-0 flex-row-reverse items-center gap-2">
            <AwayCrestBadge seed={seed} size="md" />
            <span className="truncate font-display font-bold tracking-wider text-gray-400">{awayShort}</span>
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
}: {
  homeShort: string;
  awayShort: string;
  homeName?: string;
  awayName?: string;
  homeScore: number;
  awayScore: number;
  awaySeed?: string;
  className?: string;
}) {
  const crest = useGameStore((s) => s.userSettings.managerCrestPngDataUrl);
  const fallbackAway = useGameStore((s) => s.nextFixture.opponent.id);
  const seed = awaySeed ?? fallbackAway;
  const homeLabel = homeName?.trim() || homeShort;
  const awayLabel = awayName?.trim() || awayShort;

  return (
    <p
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-2 gap-y-2 font-display font-black text-white sm:gap-x-3',
        className,
      )}
    >
      <span className="inline-flex max-w-[min(100%,16rem)] items-center gap-2 sm:max-w-[min(100%,20rem)] sm:gap-2.5">
        {crest ? <img src={crest} alt="" className={crestSize.md} /> : null}
        <span className="text-center leading-tight [overflow-wrap:anywhere]">{homeLabel}</span>
      </span>
      <span className="shrink-0 tabular-nums text-neon-yellow">{homeScore}</span>
      <span className="shrink-0 text-gray-600">–</span>
      <span className="shrink-0 tabular-nums text-neon-yellow">{awayScore}</span>
      <span className="inline-flex max-w-[min(100%,16rem)] flex-row-reverse items-center gap-2 sm:max-w-[min(100%,20rem)] sm:gap-2.5">
        <AwayCrestBadge seed={seed} size="md" />
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
}: {
  side: 'home' | 'away';
  name: string;
  className?: string;
  awaySeed?: string;
  teamCrestSize?: 'sm' | 'md';
}) {
  const crest = useGameStore((s) => s.userSettings.managerCrestPngDataUrl);
  const fallbackAway = useGameStore((s) => s.nextFixture.opponent.id);
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
      {side === 'home' ? (
        crest ? <img src={crest} alt="" className={imgCls} /> : null
      ) : (
        <AwayCrestBadge seed={seed} size={teamCrestSize === 'sm' ? 'sm' : 'md'} />
      )}
      <span className="min-w-0 font-display font-bold leading-snug [overflow-wrap:anywhere]">{name}</span>
    </span>
  );
}
