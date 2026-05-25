/**
 * OLEFOOT PYTHON MODE — Banner de ausência.
 *
 * Mostra ao manager o que está sendo afetado pela ausência. Aparece só
 * quando tier >= warning_12h. Cor escala com gravidade.
 *
 * Filosofia: NÃO punir silenciosamente. O manager precisa SABER que está
 * perdendo evolução, senão não volta pro app.
 */
import { motion } from 'motion/react';
import { AlertTriangle, AlertOctagon, Flame } from 'lucide-react';
import { useAbsence, useHoursSinceLastLogin } from '@/hooks/useEngagement';
import { cn } from '@/lib/utils';
import type { AbsenceTier } from '@/systems/engagement/types';

const TIER_STYLES: Record<AbsenceTier, {
  hidden?: boolean;
  borderClass: string;
  bgClass: string;
  iconClass: string;
  Icon: typeof AlertTriangle;
  label: string;
}> = {
  normal: { hidden: true, borderClass: '', bgClass: '', iconClass: '', Icon: AlertTriangle, label: '' },
  warning_12h: {
    borderClass: 'border-l-yellow-400',
    bgClass: 'bg-yellow-400/10',
    iconClass: 'text-yellow-400',
    Icon: AlertTriangle,
    label: 'Atenção',
  },
  mild_24h: {
    borderClass: 'border-l-orange-400',
    bgClass: 'bg-orange-400/10',
    iconClass: 'text-orange-400',
    Icon: AlertTriangle,
    label: 'Treinos parados',
  },
  moderate_36h: {
    borderClass: 'border-l-red-400',
    bgClass: 'bg-red-400/12',
    iconClass: 'text-red-400',
    Icon: AlertOctagon,
    label: 'Clube à deriva',
  },
  heavy_48h: {
    borderClass: 'border-l-red-500',
    bgClass: 'bg-red-500/15',
    iconClass: 'text-red-500',
    Icon: AlertOctagon,
    label: 'Crise instalada',
  },
  crisis_72h: {
    borderClass: 'border-l-red-600',
    bgClass: 'bg-red-600/20',
    iconClass: 'text-red-600 animate-pulse',
    Icon: Flame,
    label: 'CRISE',
  },
};

function formatHours(h: number): string {
  if (h < 1) return 'menos de 1h';
  if (h < 24) return `${Math.floor(h)}h`;
  const days = Math.floor(h / 24);
  return days === 1 ? '1 dia' : `${days} dias`;
}

export function AbsenceBanner() {
  const absence = useAbsence();
  const hours = useHoursSinceLastLogin();
  const style = TIER_STYLES[absence.tier];

  if (style.hidden) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'w-full rounded-sm border border-white/8 border-l-4 overflow-hidden',
        style.borderClass,
        style.bgClass,
      )}
      role="alert"
    >
      <div className="px-4 py-3 flex items-start gap-3">
        <div className={cn('shrink-0 mt-0.5', style.iconClass)}>
          <style.Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="ole-eyebrow text-white/60"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            {style.label} · {formatHours(hours)} sem visitar o clube
          </div>
          <div className="font-display text-sm sm:text-base text-white mt-0.5">
            {absence.effect.message}
          </div>
          {absence.tier !== 'warning_12h' && (
            <div className="text-[11px] text-white/55 mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
              {absence.effect.trainingMultiplier === 0 && <span>· Treinos parados</span>}
              {absence.effect.injuryRiskAdditive > 0 && (
                <span>· Risco lesão +{absence.effect.injuryRiskAdditive}</span>
              )}
              {absence.effect.randomInjuryCount > 0 && (
                <span>· {absence.effect.randomInjuryCount} lesão{absence.effect.randomInjuryCount > 1 ? 'ões' : ''} pendente{absence.effect.randomInjuryCount > 1 ? 's' : ''}</span>
              )}
              {absence.effect.crowdSupportDelta < 0 && (
                <span>· Torcida {absence.effect.crowdSupportDelta}%</span>
              )}
              {!absence.effect.marketActivityEnabled && <span>· Mercado parado</span>}
              {absence.effect.starPlayerDepartureRisk && (
                <span className="text-red-400 font-bold">· Estrelas cogitando sair</span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
