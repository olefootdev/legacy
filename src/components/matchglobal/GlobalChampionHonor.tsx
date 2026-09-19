/**
 * GlobalChampionHonor — o pódio do campeão da Liga Global.
 *
 * Dá HONRA de verdade a quem vence: preto + volt chapado, Anton grande,
 * imagem Legacy ao fundo (com scrim), o TIME em destaque e o MANAGER
 * logo abaixo. Dois formatos:
 *   • variant="hero"    → banner cheio no topo de /match/global (pós-coroação)
 *   • variant="compact" → módulo da Home ("Último Campeão Liga Global")
 */
import { motion } from 'motion/react';
import { Crown, Trophy, ChevronRight } from 'lucide-react';
import { Hashtag } from '@/components/ui';

const IMPACT = 'var(--font-impact)';

export interface GlobalChampionHonorProps {
  clubName: string;
  clubShort?: string;
  managerName?: string | null;
  dailyDate?: string;
  runnerUpClubName?: string;
  finalScoreHome?: number;
  finalScoreAway?: number;
  finalWentToPens?: boolean;
  variant?: 'hero' | 'compact';
  onClick?: () => void;
}

function formatDatePt(iso?: string): string | null {
  if (!iso) return null;
  const p = iso.split('-');
  if (p.length !== 3) return iso;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

export function GlobalChampionHonor({
  clubName,
  managerName,
  dailyDate,
  runnerUpClubName,
  finalScoreHome,
  finalScoreAway,
  finalWentToPens,
  variant = 'hero',
  onClick,
}: GlobalChampionHonorProps) {
  const hasFinal = runnerUpClubName && finalScoreHome != null && finalScoreAway != null;
  const dateLabel = formatDatePt(dailyDate);

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group relative w-full overflow-hidden rounded-lg border border-neon-yellow/30 bg-panel text-left transition-colors hover:border-white/30"
      >
        <img
          src="/hero-legacy-full.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-full w-1/2 object-cover opacity-25"
          style={{ maskImage: 'linear-gradient(to left, black, transparent)', WebkitMaskImage: 'linear-gradient(to left, black, transparent)' }}
        />
        <div className="relative z-10 flex items-center gap-4 p-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-neon-yellow/40 bg-black/60">
            <Trophy className="h-6 w-6 text-neon-yellow" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <Hashtag className="text-neon-yellow/80">#ligaglobal · último campeão</Hashtag>
            <p
              className="truncate text-white"
              style={{ fontFamily: IMPACT, fontSize: 'clamp(20px, 6vw, 28px)', lineHeight: 1, letterSpacing: '0.01em' }}
            >
              {clubName}
            </p>
            <p className="mt-1 flex items-center gap-2 text-[11px] text-white/55">
              {managerName ? (
                <span className="truncate">
                  Manager <span className="font-bold text-white/80">{managerName}</span>
                </span>
              ) : (
                <span className="truncate text-white/40">Campeão coroado</span>
              )}
              {dateLabel && <span className="shrink-0 text-white/30">· {dateLabel}</span>}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-white/30 transition-colors group-hover:text-neon-yellow" />
        </div>
      </button>
    );
  }

  // ── HERO ──
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-lg border border-neon-yellow/40 bg-deep-black"
    >
      <img
        src="/hero-legacy-full.png"
        alt=""
        aria-hidden
        loading="eager"
        className="absolute inset-0 h-full w-full object-cover opacity-40"
        style={{ objectPosition: 'center 20%' }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(13,13,13,0.72) 0%, rgba(13,13,13,0.88) 55%, #0D0D0D 100%)' }}
      />

      <div className="relative z-10 flex flex-col items-center px-5 py-8 text-center">
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-neon-yellow/40 bg-black/50 px-3 py-1">
          <Crown className="h-3.5 w-3.5 text-neon-yellow" strokeWidth={2.5} aria-hidden />
          <span className="font-display text-[9px] font-bold uppercase tracking-[0.28em] text-neon-yellow">
            Campeão da Liga Global
          </span>
        </span>

        <Trophy
          className="mb-4 h-14 w-14 text-neon-yellow"
          strokeWidth={1.5}
          aria-hidden
        />

        <h3
          className="text-neon-yellow"
          style={{ fontFamily: IMPACT, fontSize: 'clamp(40px, 12vw, 76px)', lineHeight: 1.05, letterSpacing: '0.01em' }}
        >
          {clubName}
        </h3>

        {managerName && (
          <p className="mt-3 text-white/70" style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(16px, 4vw, 22px)' }}>
            comandado por {managerName}
          </p>
        )}

        <span aria-hidden className="mt-5 mb-4 block h-[3px] w-12 bg-neon-yellow" />

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-white/55">
          {hasFinal && (
            <span className="font-mono text-sm">
              Final <span className="font-bold text-white">{finalScoreHome}–{finalScoreAway}</span> vs {runnerUpClubName}
              {finalWentToPens ? ' (pên.)' : ''}
            </span>
          )}
          {dateLabel && <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">{dateLabel}</span>}
        </div>
      </div>
    </motion.div>
  );
}

export default GlobalChampionHonor;
