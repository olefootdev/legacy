/**
 * GlobalChampionHonor — o pódio do campeão da Liga Global.
 *
 * DS 2027: campeão é LENDA — ouro chapado, o topo da escada. Anton grande,
 * o TIME em destaque, o MANAGER na voz, o 9 de respeito e retícula de cartaz.
 * Sem foto com scrim degradê, sem brilho. Dois formatos:
 *   • variant="hero"    → banner cheio no topo de /match/global (pós-coroação)
 *   • variant="compact" → módulo da Home ("Último Campeão Liga Global")
 */
import { L, emIngles } from '@/i18n/L';
import { motion } from 'motion/react';
import { Crown } from 'lucide-react';
import { MarcaRua } from '@/components/ui/Rua';

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
  return emIngles() ? `${p[1]}/${p[2]}/${p[0]}` : `${p[2]}/${p[1]}/${p[0]}`;
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
        className="group relative flex w-full min-w-0 items-center gap-4 overflow-hidden border-[3px] border-ouro-27 bg-asfalto-27 p-4 text-left transition-colors hover:bg-concreto"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center bg-ouro-27 text-asfalto-27">
          <Crown className="h-6 w-6" strokeWidth={2.2} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.16em] text-mudo">
            — {L('#ligaglobal · último campeão', '#globalleague · latest champion')}
          </span>
          <p className="truncate font-impact uppercase leading-none text-ouro-27" style={{ fontSize: 'clamp(22px, 6vw, 30px)' }}>
            {clubName}
          </p>
          <p className="flex min-w-0 items-center gap-2 font-prova text-[11px] text-suave">
            {managerName ? (
              <span className="truncate">Manager <span className="font-bold text-papel">{managerName}</span></span>
            ) : (
              <span className="truncate">{L('Campeão coroado', 'Champion crowned')}</span>
            )}
            {dateLabel && <span className="shrink-0 text-mudo">· {dateLabel}</span>}
          </p>
        </div>
        <span aria-hidden className="shrink-0 font-impact text-[22px] text-ouro-27 transition-transform group-hover:translate-x-0.5">→</span>
      </button>
    );
  }

  // ── HERO — LENDA ──
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative flex min-w-0 items-end justify-between gap-4 overflow-hidden bg-ouro-27 p-5 text-asfalto-27 sm:p-7"
    >
      <span
        aria-hidden
        className="rua-reticula absolute -right-4 -top-4 h-44 w-56 [--reticula:rgba(13,13,12,0.4)]"
        style={{
          WebkitMaskImage: 'radial-gradient(circle at 100% 0%, #000 0%, transparent 72%)',
          maskImage: 'radial-gradient(circle at 100% 0%, #000 0%, transparent 72%)',
        }}
      />
      <div className="relative flex min-w-0 flex-col gap-2">
        <span className="inline-flex items-center gap-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.22em]">
          <Crown className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          {L('Campeão da Liga Global', 'Global League Champion')}
        </span>
        <h3 className="font-impact uppercase leading-[0.86] [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(42px, 12vw, 80px)' }}>
          {clubName}
        </h3>
        {managerName && (
          <p className="font-voz leading-none" style={{ fontSize: 'clamp(22px, 6vw, 30px)' }}>
            {L('comandado por', 'managed by')} {managerName}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-prova text-[12px] font-bold uppercase tracking-[0.08em]">
          {hasFinal && (
            <span>
              Final <span className="font-spray text-[20px] font-black">{finalScoreHome}×{finalScoreAway}</span> vs {runnerUpClubName}
              {finalWentToPens ? L(' (pên.)', ' (pens)') : ''}
            </span>
          )}
          {dateLabel && <span className="opacity-70">{dateLabel}</span>}
        </div>
      </div>
      <MarcaRua tipo="nove" className="relative h-24 shrink-0 bg-asfalto-27 sm:h-32" />
    </motion.div>
  );
}

export default GlobalChampionHonor;
