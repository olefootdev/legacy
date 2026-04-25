import { cn } from '@/lib/utils';
import { Badge } from './Badge';

interface MiniStat {
  label: string;
  value: number | string;
}

/**
 * PlayerCard "carta colecionável" — layout vertical split:
 *   [foto 120px] [linha amarela 3px] [info+OVR]
 * Hover: lift + glow amarelo. OVR em Moret italic.
 *
 * Compatível com `.ole-player-card` (já no tema) — pode coexistir com hero
 * cards existentes na Home (que usam o mesmo CSS base).
 */
export function PlayerCard({
  name,
  position,
  ovr,
  meta,
  photoUrl,
  initials,
  miniStats,
  onClick,
  className,
  highlighted = false,
}: {
  name: string;
  /** Sigla da posição (ex.: "ATA", "MEI"). */
  position: string;
  ovr: number;
  /** Subtítulo curto: "27 anos · Brasil". */
  meta?: string;
  photoUrl?: string;
  /** Iniciais usadas como fallback (1-2 chars). */
  initials?: string;
  miniStats?: MiniStat[];
  onClick?: () => void;
  className?: string;
  /** Borda amarela permanente (jogador da vez). */
  highlighted?: boolean;
}) {
  const fallback =
    initials ??
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('');

  return (
    <article
      onClick={onClick}
      className={cn(
        'ole-player-card relative cursor-pointer transition-all duration-200',
        'hover:border-neon-yellow hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(253,225,0,0.15)]',
        highlighted && 'border-neon-yellow shadow-[0_0_0_1px_var(--yellow)]',
        className,
      )}
    >
      <Badge className="absolute top-3 right-3 z-20 px-2.5 py-1 text-[11px] tracking-[0.15em]">
        {position}
      </Badge>

      <div className="grid grid-cols-[120px_3px_1fr] min-h-[140px]">
        {/* Foto */}
        <div className="relative bg-deep-black flex items-center justify-center overflow-hidden">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              className="ole-player-photo-bw w-full h-full object-cover object-top"
              referrerPolicy="no-referrer"
              draggable={false}
            />
          ) : (
            <span
              className="font-display font-black text-3xl uppercase text-text-soft tracking-wide"
              aria-hidden
            >
              {fallback}
            </span>
          )}
        </div>

        {/* Divisor amarelo 3px */}
        <div className="ole-y-divider-3" aria-hidden />

        {/* Info + OVR */}
        <div className="flex flex-col justify-between p-3 pr-3">
          <div>
            <h3 className="ole-player-card__name text-[18px] sm:text-[22px] leading-tight pr-12">
              {name}
            </h3>
            {meta ? (
              <p className="text-text-soft text-[11px] mt-1 tracking-wide">{meta}</p>
            ) : null}
          </div>
          <div className="flex items-end justify-between gap-2 mt-2">
            <div className="flex flex-col leading-none">
              <span className="text-text-soft uppercase text-[10px] font-medium tracking-[0.12em]">
                OVR
              </span>
              <span
                className="text-neon-yellow leading-none"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontStyle: 'italic',
                  fontSize: '32px',
                }}
              >
                {ovr}
              </span>
            </div>
            {miniStats && miniStats.length > 0 ? (
              <div className="flex gap-2.5">
                {miniStats.slice(0, 3).map((s) => (
                  <div key={s.label} className="text-center leading-none">
                    <p className="font-display font-black text-white text-[16px]">
                      {s.value}
                    </p>
                    <p className="text-text-soft uppercase text-[9px] tracking-[0.08em] mt-0.5">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
