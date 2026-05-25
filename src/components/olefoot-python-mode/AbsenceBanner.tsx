/**
 * OLEFOOT PYTHON MODE — Banner de ausência (Legacy Tech).
 *
 * Mostra ao manager o que está sendo afetado pela ausência. Aparece só
 * quando tier >= warning_12h. Cor escala com gravidade via tokens:
 *   warning_12h           → --color-warning (amarelo institucional)
 *   mild_24h / moderate   → --color-warning (mais intenso)
 *   heavy / crisis        → --color-danger (vermelho)
 *
 * Filosofia: NÃO punir silenciosamente. O manager precisa SABER o que
 * está perdendo, senão não volta. Headline em Moret italic, eyebrow
 * Agency uppercase, métricas Moret italic tabular-nums.
 */
import { motion } from 'motion/react';
import { AlertTriangle, AlertOctagon, Flame } from 'lucide-react';
import { useAbsence, useHoursSinceLastLogin } from '@/hooks/useEngagement';
import { cn } from '@/lib/utils';
import type { AbsenceTier } from '@/systems/engagement/types';

interface TierStyle {
  hidden?: boolean;
  borderLeft: string;
  bgClass: string;
  iconColor: string;
  Icon: typeof AlertTriangle;
  label: string;
  /** Cor usada nas pílulas de efeitos. */
  accentClass: string;
}

const TIER_STYLES: Record<AbsenceTier, TierStyle> = {
  normal: {
    hidden: true,
    borderLeft: '',
    bgClass: '',
    iconColor: '',
    Icon: AlertTriangle,
    label: '',
    accentClass: '',
  },
  warning_12h: {
    borderLeft: 'border-l-[var(--color-warning)]',
    bgClass: 'bg-[var(--color-warning)]/8',
    iconColor: 'text-[var(--color-warning)]',
    Icon: AlertTriangle,
    label: 'Atenção',
    accentClass: 'text-[var(--color-warning)]',
  },
  mild_24h: {
    borderLeft: 'border-l-[var(--color-warning)]',
    bgClass: 'bg-[var(--color-warning)]/10',
    iconColor: 'text-[var(--color-warning)]',
    Icon: AlertTriangle,
    label: 'Treinos parados',
    accentClass: 'text-[var(--color-warning)]',
  },
  moderate_36h: {
    borderLeft: 'border-l-[var(--color-danger)]',
    bgClass: 'bg-[var(--color-danger)]/10',
    iconColor: 'text-[var(--color-danger)]',
    Icon: AlertOctagon,
    label: 'Clube à deriva',
    accentClass: 'text-[var(--color-danger)]',
  },
  heavy_48h: {
    borderLeft: 'border-l-[var(--color-danger)]',
    bgClass: 'bg-[var(--color-danger)]/14',
    iconColor: 'text-[var(--color-danger)]',
    Icon: AlertOctagon,
    label: 'Crise instalada',
    accentClass: 'text-[var(--color-danger)]',
  },
  crisis_72h: {
    borderLeft: 'border-l-[var(--color-danger)]',
    bgClass: 'bg-[var(--color-danger)]/18',
    iconColor: 'text-[var(--color-danger)] animate-pulse',
    Icon: Flame,
    label: 'Crise',
    accentClass: 'text-[var(--color-danger)]',
  },
};

function formatHours(h: number): string {
  if (h < 1) return 'menos de 1h';
  if (h < 24) return `${Math.floor(h)}h`;
  const days = Math.floor(h / 24);
  return days === 1 ? '1 dia' : `${days} dias`;
}

function Pill({
  children,
  emphasis = 'normal',
}: {
  children: React.ReactNode;
  emphasis?: 'normal' | 'strong';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 border bg-deep-black/40',
        emphasis === 'strong'
          ? 'border-[var(--color-danger)]/45 text-[var(--color-danger)]'
          : 'border-white/12 text-white/70',
      )}
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: '9px',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {children}
    </span>
  );
}

export function AbsenceBanner() {
  const absence = useAbsence();
  const hours = useHoursSinceLastLogin();
  const style = TIER_STYLES[absence.tier];

  if (style.hidden) return null;

  const showDetails = absence.tier !== 'warning_12h';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'w-full border border-l-[3px] border-white/8 overflow-hidden',
        style.borderLeft,
        style.bgClass,
      )}
      style={{
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      }}
      role="alert"
    >
      <div className="px-4 sm:px-5 py-4 flex items-start gap-3">
        <div className={cn('shrink-0 mt-1', style.iconColor)}>
          <style.Icon size={18} />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Eyebrow Agency tracking-wide */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={style.accentClass}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '10px',
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
              }}
            >
              {style.label}
            </span>
            <span aria-hidden className="block h-px w-4 bg-white/20" />
            <span
              className="text-white/55 tabular-nums"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '10px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
              }}
            >
              {formatHours(hours)} sem visitar
            </span>
          </div>

          {/* Headline Moret italic — mensagem editorial */}
          <p
            className="text-white leading-snug"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontWeight: 700,
              fontSize: 'clamp(15px, 2.6vw, 18px)',
              letterSpacing: '-0.01em',
            }}
          >
            {absence.effect.message}
          </p>

          {/* Pílulas de efeitos */}
          {showDetails && (
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {absence.effect.trainingMultiplier === 0 && <Pill>Treinos parados</Pill>}
              {absence.effect.injuryRiskAdditive > 0 && (
                <Pill>Risco lesão +{absence.effect.injuryRiskAdditive}</Pill>
              )}
              {absence.effect.randomInjuryCount > 0 && (
                <Pill emphasis="strong">
                  {absence.effect.randomInjuryCount} lesão
                  {absence.effect.randomInjuryCount > 1 ? 'ões' : ''} pendente
                  {absence.effect.randomInjuryCount > 1 ? 's' : ''}
                </Pill>
              )}
              {absence.effect.crowdSupportDelta < 0 && (
                <Pill>Torcida {absence.effect.crowdSupportDelta}%</Pill>
              )}
              {!absence.effect.marketActivityEnabled && <Pill>Mercado parado</Pill>}
              {absence.effect.starPlayerDepartureRisk && (
                <Pill emphasis="strong">Estrelas cogitando sair</Pill>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
