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
        return 'from-red-500/30 to-orange-500/30 border-red-400/50';
      case 'collapse':
        return 'from-red-600/30 to-pink-500/30 border-red-500/50';
      case 'underdog_fight':
        return 'from-yellow-500/30 to-orange-500/30 border-yellow-400/50';
      case 'dominant_control':
        return 'from-green-500/30 to-teal-500/30 border-green-400/50';
      default:
        return 'from-gray-500/30 to-gray-600/30 border-gray-400/50';
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
          'px-3 py-2 rounded-lg border-2',
          'bg-gradient-to-r',
          getArcColor(),
          'shadow-lg',
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
