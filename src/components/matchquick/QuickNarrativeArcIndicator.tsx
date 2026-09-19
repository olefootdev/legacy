/**
 * Sprint 2: Indicador de Arco Narrativo
 * Mostra o arco detectado e ajusta a intensidade visual
 */

import { motion, AnimatePresence } from 'motion/react';
import type { NarrativeArc } from '@/match/quickNarrativeArcs';
import { getArcDescription } from '@/match/quickNarrativeArcs';
import { cn } from '@/lib/utils';

interface Props {
  arc: NarrativeArc;
  intensity: number;
}

export function QuickNarrativeArcIndicator({ arc, intensity }: Props) {
  if (arc === 'balanced') return null;

  const getArcColor = () => {
    switch (arc) {
      case 'late_drama':
        return 'bg-panel border-atencao';
      case 'collapse':
        return 'bg-panel border-baixa';
      case 'underdog_fight':
        return 'bg-panel border-neon-yellow';
      case 'dominant_control':
        return 'bg-panel border-alta';
      default:
        return 'bg-panel border-white/30';
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
        className={cn(
          'px-3 py-2 border-2',
          getArcColor(),
        )}
      >
        <div className="flex items-center gap-2">
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-lg"
          >
            {getArcIcon()}
          </motion.span>
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            {getArcDescription(arc)}
          </span>
          <div className="flex-1 h-1 bg-black/30 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${intensity * 100}%` }}
              className="h-full bg-white/80 rounded-full"
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
