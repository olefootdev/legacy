import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import { matchdayHomeCrestUrl } from '@/settings/matchdayCrest';

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
  /**
   * Faixa [casa][relógio][visitante] numa única linha (mobile → desktop).
   * Brasões mais pequenos no telemóvel para caber sem quebrar linha.
   */
  quick:
    'h-7 w-7 min-h-7 min-w-7 max-h-7 max-w-7 object-contain shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] min-[400px]:h-9 min-[400px]:w-9 min-[400px]:min-h-9 min-[400px]:min-w-9 min-[400px]:max-h-9 min-[400px]:max-w-9 sm:h-10 sm:w-10 sm:min-h-10 sm:min-w-10 sm:max-h-10 sm:max-w-10 md:h-11 md:w-11 md:min-h-11 md:min-w-11 md:max-h-11 md:max-w-11',
  /** Banner matchday — compacto para caber nomes completos na mesma linha (brasão largo limitado). */
  lg: 'h-[1.3rem] w-auto max-h-[1.45rem] max-w-[min(2.85rem,14vw)] object-contain object-left shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] sm:h-[1.5rem] sm:max-h-[1.65rem] sm:max-w-[min(3.35rem,16vw)] md:h-[1.7rem] md:max-h-[1.9rem] md:max-w-[min(4rem,14vw)] lg:h-[1.85rem] lg:max-h-[2.05rem] lg:max-w-[min(4.75rem,11vw)]',
} as const;

/** Brasão sintético do adversário (IA). */
export function AwayCrestBadge({
  seed,
  className,
  size = 'md',
}: {
  seed: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'quick';
}) {
  const hue = hueFromSeed(seed || 'away');
  const letter = (seed.trim().charAt(0) || '?').toUpperCase();
  const box =
    size === 'sm'
      ? 'h-8 w-8 min-w-8 text-[11px]'
      : size === 'lg'
        ? 'h-[1.2rem] w-[1.2rem] min-w-[1.2rem] text-[9px] sm:h-[1.4rem] sm:w-[1.4rem] sm:min-w-[1.4rem] sm:text-[10px] md:h-[1.55rem] md:w-[1.55rem] md:min-w-[1.55rem] md:text-[11px] lg:h-[1.7rem] lg:w-[1.7rem] lg:min-w-[1.7rem] lg:text-xs'
        : size === 'quick'
          ? 'h-7 w-7 min-w-7 text-[10px] min-[400px]:h-8 min-[400px]:w-8 min-[400px]:min-w-8 min-[400px]:text-[11px] sm:h-10 sm:w-10 sm:min-w-10 sm:text-xs md:h-11 md:w-11 md:min-w-11'
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
  size?: 'sm' | 'md' | 'lg' | 'quick';
}) {
  const u = imageUrl?.trim();
  if (u) {
    return <img src={u} alt="" className={cn(crestSize[size], className)} />;
  }
  return <AwayCrestBadge seed={seed} size={size} className={className} />;
}

/**
 * Duelo no banner: nomes completos (sem truncar). Itálico evitado nos nomes para o espaço não “colar” (ex.: OLE FC).
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
    'min-w-0 max-w-full whitespace-normal break-words text-pretty not-italic text-white [word-spacing:normal]';

  return (
    <h2
      className={cn(
        'font-display font-black uppercase leading-snug tracking-normal',
        className,
      )}
    >
      <span className="flex w-full min-w-0 items-center justify-center gap-1 px-0.5 sm:gap-1.5 sm:px-1 md:gap-3">
        {/* Metade esquerda: bloco [brasão + nome] junto ao “vs”, sem esticar o nome e isolar o brasão */}
        <span className="flex min-w-0 min-h-0 flex-1 justify-end">
          <span className="flex max-w-full min-w-0 items-center justify-end gap-1 sm:gap-1.5 md:gap-2">
            {crest ? <img src={crest} alt="" className={cn(crestSize.lg, 'shrink-0')} /> : null}
            <span className={cn(nameText, 'text-end')}>{homeName}</span>
          </span>
        </span>
        <span
          className={cn(
            'shrink-0 font-black italic text-neon-yellow',
            vsClassName,
          )}
        >
          vs
        </span>
        {/* Metade direita: bloco [nome + brasão] colado ao “vs” */}
        <span className="flex min-w-0 min-h-0 flex-1 justify-start">
          <span className="flex max-w-full min-w-0 items-center justify-start gap-1 sm:gap-1.5 md:gap-2">
            <span className={cn(nameText, 'text-start')}>{awayName}</span>
            <AwayCrestOrPhoto seed={seed} imageUrl={awayCrestUrl} size="lg" className="shrink-0" />
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
        <span className="text-white [overflow-wrap:anywhere]">{homeShort}</span>
      </span>
      <span className="shrink-0 font-bold text-gray-500">x</span>
      <span className="inline-flex min-w-0 max-w-[min(100%,14rem)] flex-row-reverse items-center gap-2">
        <AwayCrestOrPhoto seed={seed} imageUrl={awayCrestUrl} size="sm" />
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
  showTeamCrests = true,
}: {
  homeShort: string;
  awayShort: string;
  homeName?: string;
  awayName?: string;
  awaySeed?: string;
  clock: string;
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
          className={cn(
            'min-w-0 truncate text-end font-display font-bold leading-tight text-white',
            'text-[11px] min-[380px]:text-xs sm:text-sm md:text-base lg:text-lg',
          )}
        >
          {homeLabel}
        </span>
      </div>
      <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] tabular-nums tracking-tight text-gray-300 min-[400px]:px-2 min-[400px]:py-1 min-[400px]:text-xs sm:text-sm">
        {clock}
      </span>
      <div className="flex min-w-0 flex-1 basis-0 items-center justify-start gap-1 min-[360px]:gap-1.5 sm:gap-2 md:gap-3">
        <span
          className={cn(
            'min-w-0 truncate text-start font-display font-bold leading-tight text-gray-200',
            'text-[11px] min-[380px]:text-xs sm:text-sm md:text-base lg:text-lg',
          )}
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
    <div className="pointer-events-auto flex max-w-[min(100dvw-2rem,42rem)] min-w-0 items-stretch shadow-2xl">
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
            <AwayCrestOrPhoto seed={seed} imageUrl={awayCrestUrl} size="md" />
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
        'flex flex-wrap items-center justify-center gap-x-2 gap-y-2 font-display font-black text-white sm:gap-x-3',
        className,
      )}
    >
      <span className="inline-flex max-w-[min(100%,16rem)] items-center gap-2 sm:max-w-[min(100%,20rem)] sm:gap-2.5">
        {showTeamCrests && crest ? <img src={crest} alt="" className={crestSize.md} /> : null}
        <span className="text-center leading-tight [overflow-wrap:anywhere]">{homeLabel}</span>
      </span>
      <span className="shrink-0 tabular-nums text-neon-yellow">{homeScore}</span>
      <span className="shrink-0 text-gray-600">–</span>
      <span className="shrink-0 tabular-nums text-neon-yellow">{awayScore}</span>
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
      <span className="min-w-0 font-display font-bold leading-snug [overflow-wrap:anywhere]">{name}</span>
    </span>
  );
}
