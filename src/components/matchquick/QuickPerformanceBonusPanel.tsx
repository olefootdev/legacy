/**
 * Sprint 1: Painel de Bônus de Performance
 * Exibido ao final da partida com animações
 */

import { motion } from 'motion/react';
import type { PerformanceBonus } from '@/match/quickPerformanceBonuses';
import { cn } from '@/lib/utils';

interface Props {
  bonuses: PerformanceBonus[];
  totalOle: number;
  totalExp: number;
}

export function QuickPerformanceBonusPanel({ bonuses, totalOle, totalExp }: Props) {
  if (bonuses.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🏆</span>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Bônus de Performance
        </h3>
      </div>

      <div className="space-y-2">
        {bonuses.map((bonus, i) => (
          <motion.div
            key={bonus.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
            className={cn(
              'p-3 border',
              'bg-panel',
              'border-white/10',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1">
                <span className="text-2xl">{bonus.icon}</span>
                <div>
                  <div className="text-sm font-bold text-white">{bonus.name}</div>
                  <div className="text-xs text-white/60">{bonus.description}</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-sm font-medium text-neon-yellow">+{bonus.ole} OLE</div>
                {bonus.exp > 0 && (
                  <div className="font-mono text-xs text-giz">+{bonus.exp} EXP</div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Total */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: bonuses.length * 0.15 + 0.2 }}
        className={cn(
          'p-4 border-2',
          'bg-card',
          'border-neon-yellow',
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white uppercase tracking-wider">
            Total de Bônus
          </span>
          <div className="text-right">
            <div className="font-mono text-lg font-medium text-neon-yellow">+{totalOle} OLE</div>
            {totalExp > 0 && <div className="font-mono text-sm text-giz">+{totalExp} EXP</div>}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
