/**
 * Painel de Pontos Competitivos - Mostra pontos ganhos após partida
 */

import { motion } from 'motion/react';
import { Trophy, TrendingUp, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompetitivePointsResultProps {
  homeScore: number;
  awayScore: number;
  pointsGained: number;
  isWin: boolean;
  isDraw: boolean;
  currentStreak?: number;
}

export function CompetitivePointsResult({
  homeScore,
  awayScore,
  pointsGained,
  isWin,
  isDraw,
  currentStreak = 0,
}: CompetitivePointsResultProps) {
  const resultText = isWin ? 'Vitória' : isDraw ? 'Empate' : 'Derrota';
  const resultColor = isWin ? 'text-neon-green' : isDraw ? 'text-neon-yellow' : 'text-red-500';
  const bgColor = isWin ? 'bg-neon-green/10' : isDraw ? 'bg-neon-yellow/10' : 'bg-red-500/10';
  const borderColor = isWin ? 'border-neon-green/30' : isDraw ? 'border-neon-yellow/30' : 'border-red-500/30';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'sports-panel rounded-lg p-6 border-2',
        borderColor,
        bgColor
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex items-center justify-center w-12 h-12 rounded-lg',
            isWin ? 'bg-neon-green/20' : isDraw ? 'bg-neon-yellow/20' : 'bg-red-500/20'
          )}>
            <Trophy className={cn('w-6 h-6', resultColor)} />
          </div>
          <div>
            <p className={cn('font-display text-2xl font-bold uppercase tracking-wider', resultColor)}>
              {resultText}
            </p>
            <p className="text-sm text-text-soft">
              Modo Competitivo
            </p>
          </div>
        </div>

        {/* Pontos Ganhos */}
        <div className="text-right">
          <p className="text-xs text-text-soft uppercase tracking-wider font-display mb-1">
            Pontos
          </p>
          <motion.p
            initial={{ scale: 1.5 }}
            animate={{ scale: 1 }}
            className={cn('font-serif-hero text-5xl font-bold', resultColor)}
          >
            +{pointsGained}
          </motion.p>
        </div>
      </div>

      {/* Detalhes */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
        <div>
          <p className="text-xs text-text-soft uppercase tracking-wider font-display mb-1">
            Placar
          </p>
          <p className="font-serif-hero text-2xl font-bold text-white">
            {homeScore} × {awayScore}
          </p>
        </div>

        {isWin && currentStreak > 0 && (
          <div>
            <p className="text-xs text-text-soft uppercase tracking-wider font-display mb-1">
              Sequência
            </p>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-neon-green" />
              <p className="font-serif-hero text-2xl font-bold text-neon-green">
                {currentStreak}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mensagem motivacional */}
      {isWin && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 flex items-center gap-2 text-sm text-neon-green"
        >
          <Award className="w-4 h-4" />
          <span className="font-display font-bold uppercase tracking-wider">
            {currentStreak >= 3 ? 'Sequência incrível!' : 'Continue assim!'}
          </span>
        </motion.div>
      )}

      {isDraw && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 text-sm text-text-soft"
        >
          Ponto conquistado! Próxima partida você consegue a vitória.
        </motion.div>
      )}

      {!isWin && !isDraw && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 text-sm text-text-soft"
        >
          Não desista! Analise a partida e volte mais forte.
        </motion.div>
      )}
    </motion.div>
  );
}
