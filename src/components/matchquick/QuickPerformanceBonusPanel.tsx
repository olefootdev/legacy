/**
 * Sprint 1: Painel de Bônus de Performance
 * Exibido ao final da partida com animações
 */

import { motion } from 'motion/react';
import type { PerformanceBonus } from '@/match/quickPerformanceBonuses';
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';

interface Props {
  bonuses: PerformanceBonus[];
  totalOle: number;
  totalExp: number;
}

export function QuickPerformanceBonusPanel({ bonuses, totalOle, totalExp }: Props) {
  if (bonuses.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">
        — {L('Bônus de performance', 'Performance bonus')}
      </h3>

      <ul className="flex flex-col">
        {bonuses.map((bonus, i) => (
          <motion.li
            key={bonus.id}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12 }}
            className="flex min-w-0 items-start justify-between gap-3 border-b border-linha py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p className="font-voz text-[21px] leading-none text-papel">{bonus.name}</p>
              <p className="mt-1 text-[12.5px] leading-snug text-suave">{bonus.description}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-impact text-[18px] leading-none tabular-nums text-papel">+{bonus.ole} OLE</p>
              {bonus.exp > 0 && (
                <p className="mt-1 font-prova text-[11px] font-bold text-mudo">+{bonus.exp} EXP</p>
              )}
            </div>
          </motion.li>
        ))}
      </ul>

      {/* Total — lambe de papel colado torto */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: bonuses.length * 0.12 + 0.15 }}
        className={cn('-rotate-1 bg-cal px-4 py-3 text-asfalto-27')}
      >
        <div className="flex min-w-0 items-end justify-between gap-3">
          <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em]">
            {L('Total de bônus', 'Total bonus')}
          </span>
          <div className="text-right">
            <p className="font-spray font-black text-[34px] leading-none tabular-nums">+{totalOle} OLE</p>
            {totalExp > 0 && <p className="font-prova text-[12px] font-bold">+{totalExp} EXP</p>}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
