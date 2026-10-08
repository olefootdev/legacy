import { L } from '@/i18n/L';

interface MomentumBarProps {
  /** Momentum value 0-1, where 0.5 is neutral, 0 is full away, 1 is full home */
  momentum: number;
  homeShort: string;
  awayShort: string;
  homeColor?: string;
  awayColor?: string;
}

/** Segmentos da barra — chapada, sem degradê (DS 2027 · BarraSegmentos). */
const SEGMENTOS = 20;

/**
 * Barra de domínio — DS 2027 "RESPEITO É OURO": segmentos chapados, a casa em
 * rua entrando pela esquerda, o visitante em papel entrando pela direita. Sem
 * degradê, sem pulso infinito (performance + o DS proíbe brilho).
 */
export function MomentumBar({
  momentum,
  homeShort,
  awayShort,
  homeColor = 'var(--color-rua)',
  awayColor = 'var(--color-papel)',
}: MomentumBarProps) {
  const homePercent = Math.round(Math.max(0, Math.min(1, momentum)) * 100);
  const awayPercent = 100 - homePercent;

  const homeDominant = homePercent >= 65;
  const awayDominant = awayPercent >= 65;
  const balanced = !homeDominant && !awayDominant;

  const homeSegs = Math.round((homePercent / 100) * SEGMENTOS);

  return (
    <div
      className="mx-auto w-full max-w-md"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={homePercent}
      aria-label={L(`Domínio: ${homeShort} ${homePercent}%, ${awayShort} ${awayPercent}%`, `Dominance: ${homeShort} ${homePercent}%, ${awayShort} ${awayPercent}%`)}
    >
      <div className="mb-1.5 flex min-w-0 items-baseline justify-between gap-2 px-0.5">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate font-impact text-[14px] uppercase leading-none" style={{ color: homeColor, opacity: homeDominant || balanced ? 1 : 0.65 }}>
            {homeShort}
          </span>
          <span className="font-spray font-black text-[18px] leading-none tabular-nums" style={{ color: homeColor }}>
            {homePercent}
          </span>
          {homeDominant && <span aria-hidden className="font-impact text-[12px] leading-none" style={{ color: homeColor }}>▲</span>}
        </span>

        <span className="shrink-0 font-prova text-[10px] font-bold uppercase tracking-[0.2em] text-mudo">
          {balanced ? L('Equilibrado', 'Balanced') : L('Domínio', 'Dominance')}
        </span>

        <span className="flex min-w-0 items-baseline justify-end gap-1.5">
          {awayDominant && <span aria-hidden className="font-impact text-[12px] leading-none" style={{ color: awayColor }}>▲</span>}
          <span className="font-spray font-black text-[18px] leading-none tabular-nums" style={{ color: awayColor }}>
            {awayPercent}
          </span>
          <span className="truncate font-impact text-[14px] uppercase leading-none" style={{ color: awayColor, opacity: awayDominant || balanced ? 1 : 0.65 }}>
            {awayShort}
          </span>
        </span>
      </div>

      <div
        aria-hidden
        className="relative grid h-3.5 gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${SEGMENTOS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: SEGMENTOS }, (_, i) => (
          <span
            key={i}
            className="transition-colors duration-500"
            style={{ backgroundColor: i < homeSegs ? homeColor : awayColor, opacity: i < homeSegs ? 1 : 0.55 }}
          />
        ))}
        {/* meio-campo */}
        <span className="pointer-events-none absolute -bottom-1 -top-1 left-1/2 w-[2px] -translate-x-1/2 bg-asfalto-27" />
      </div>
    </div>
  );
}
