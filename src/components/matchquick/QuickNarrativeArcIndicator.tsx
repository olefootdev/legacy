/**
 * Sprint 2: Indicador de Arco Narrativo
 * Mostra o arco detectado e ajusta a intensidade visual
 */

import { motion, AnimatePresence } from 'motion/react';
import type { NarrativeArc } from '@/match/quickNarrativeArcs';
import { getArcDescription } from '@/match/quickNarrativeArcs';
import { cn } from '@/lib/utils';
import { emIngles } from '@/i18n/L';

interface Props {
  arc: NarrativeArc;
  intensity: number;
}

const ARC_EN: Record<NarrativeArc, string> = {
  late_drama: 'Late drama!',
  collapse: 'The lead is slipping away...',
  underdog_fight: 'Fighting against the odds!',
  dominant_control: 'Total dominance!',
  balanced: 'Even match',
};

export function QuickNarrativeArcIndicator({ arc, intensity }: Props) {
  if (arc === 'balanced') return null;

  const getArcColor = () => {
    switch (arc) {
      case 'late_drama':
        return 'border-l-rua';
      case 'collapse':
        return 'border-l-baixa';
      case 'underdog_fight':
        return 'border-l-rua';
      case 'dominant_control':
        return 'border-l-alta';
      default:
        return 'border-l-fio';
    }
  };

  const getArcIcon = () => {
    switch (arc) {
      case 'late_drama':
        return '↑';
      case 'collapse':
        return '↓';
      case 'underdog_fight':
        return '↗';
      case 'dominant_control':
        return '▲';
      default:
        return '●';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={cn('border-l-[4px] bg-concreto px-3 py-2', getArcColor())}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="shrink-0 font-impact text-[18px] leading-none text-papel">
            {getArcIcon()}
          </span>
          <span className="min-w-0 truncate font-voz text-[19px] leading-none text-papel">
            {emIngles() ? ARC_EN[arc] : getArcDescription(arc)}
          </span>
          <div className="h-1.5 min-w-[2.5rem] flex-1 overflow-hidden bg-linha">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${intensity * 100}%` }}
              className="h-full bg-papel"
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
