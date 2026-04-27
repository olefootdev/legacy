/**
 * Overlay de substituição - pausa o jogo por 3 segundos
 * Mostra cards "SAI" e "ENTRA" com nomes dos jogadores
 */
import { motion } from 'motion/react';
import { ArrowRightLeft } from 'lucide-react';

interface SubstitutionOverlayProps {
  playerOut: {
    name: string;
    number: number;
    position: string;
  };
  playerIn: {
    name: string;
    number: number;
    position: string;
  };
  reason?: 'injury' | 'tactical' | 'red_card';
}

export function SubstitutionOverlay({ playerOut, playerIn, reason }: SubstitutionOverlayProps) {
  const reasonLabel = reason === 'injury'
    ? '🚑 Substituição por Lesão'
    : reason === 'red_card'
    ? '🟥 Substituição por Expulsão'
    : '⚡ Substituição Tática';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 20 }}
        className="flex flex-col items-center gap-6 px-6"
      >
        {/* Título */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center"
        >
          <p className="font-display text-xs font-bold uppercase tracking-wider text-neon-yellow/80">
            {reasonLabel}
          </p>
        </motion.div>

        {/* Cards de substituição */}
        <div className="flex items-center gap-4 sm:gap-6">
          {/* SAI */}
          <motion.div
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center gap-3 rounded-lg border-2 border-red-500/60 bg-gradient-to-br from-red-500/20 via-red-600/10 to-black/80 p-4 sm:p-6 min-w-[140px] sm:min-w-[160px]"
          >
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-red-500/30 border-2 border-red-500">
              <span className="font-display text-xl sm:text-2xl font-black text-red-400">
                {playerOut.number}
              </span>
            </div>
            <div className="text-center">
              <p className="font-display text-xs font-black uppercase tracking-wider text-red-400 mb-1">
                SAI
              </p>
              <p className="font-display text-sm sm:text-base font-bold text-white leading-tight">
                {playerOut.name}
              </p>
              <p className="text-[10px] text-white/50 uppercase tracking-wider mt-1">
                {playerOut.position}
              </p>
            </div>
          </motion.div>

          {/* Ícone de troca */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
          >
            <ArrowRightLeft className="h-8 w-8 sm:h-10 sm:w-10 text-neon-yellow" strokeWidth={2.5} />
          </motion.div>

          {/* ENTRA */}
          <motion.div
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center gap-3 rounded-lg border-2 border-neon-green/60 bg-gradient-to-br from-neon-green/20 via-emerald-600/10 to-black/80 p-4 sm:p-6 min-w-[140px] sm:min-w-[160px]"
          >
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-neon-green/30 border-2 border-neon-green">
              <span className="font-display text-xl sm:text-2xl font-black text-neon-green">
                {playerIn.number}
              </span>
            </div>
            <div className="text-center">
              <p className="font-display text-xs font-black uppercase tracking-wider text-neon-green mb-1">
                ENTRA
              </p>
              <p className="font-display text-sm sm:text-base font-bold text-white leading-tight">
                {playerIn.name}
              </p>
              <p className="text-[10px] text-white/50 uppercase tracking-wider mt-1">
                {playerIn.position}
              </p>
            </div>
          </motion.div>
        </div>

        {/* Contador */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-2"
        >
          <div className="h-1 w-16 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 3, ease: 'linear' }}
              className="h-full bg-neon-yellow"
            />
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
