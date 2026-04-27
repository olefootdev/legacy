/**
 * Componente de Toggle para Modo Competitivo na Partida Rápida
 */

import { motion } from 'motion/react';
import { Trophy, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompetitiveModeToggleProps {
  isCompetitive: boolean;
  onToggle: (value: boolean) => void;
  disabled?: boolean;
}

export function CompetitiveModeToggle({
  isCompetitive,
  onToggle,
  disabled = false,
}: CompetitiveModeToggleProps) {
  return (
    <div className="sports-panel rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex items-center justify-center w-10 h-10 rounded-lg transition-colors',
            isCompetitive ? 'bg-neon-yellow/20' : 'bg-white/5'
          )}>
            <Trophy className={cn(
              'w-5 h-5 transition-colors',
              isCompetitive ? 'text-neon-yellow' : 'text-white/40'
            )} />
          </div>
          <div>
            <p className="font-display text-base font-bold uppercase tracking-wider text-white">
              Modo Competitivo
            </p>
            <p className="text-xs text-text-soft mt-0.5">
              {isCompetitive ? 'Vitória +3pts • Empate +1pt • Conta para o ranking' : 'Partida casual • Não conta pontos'}
            </p>
          </div>
        </div>

        <button
          onClick={() => onToggle(!isCompetitive)}
          disabled={disabled}
          className={cn(
            'relative w-14 h-7 rounded-full transition-all',
            isCompetitive ? 'bg-neon-yellow' : 'bg-white/10',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <motion.div
            layout
            className={cn(
              'absolute top-1 w-5 h-5 rounded-full transition-colors',
              isCompetitive ? 'bg-black right-1' : 'bg-white/60 left-1'
            )}
          />
        </button>
      </div>

      {isCompetitive && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-3 pt-3 border-t border-white/5"
        >
          <div className="flex items-center gap-2 text-xs text-neon-yellow">
            <Target className="w-4 h-4" />
            <span className="font-display font-bold uppercase tracking-wider">
              Modo Ranqueado Ativo
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
