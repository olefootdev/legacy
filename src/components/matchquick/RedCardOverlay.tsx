/**
 * Overlay de cartão vermelho - pausa o jogo por 3 segundos
 * Mostra card vermelho com nome do jogador expulso
 */
import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

interface RedCardOverlayProps {
  player: {
    name: string;
    number: number;
    position: string;
  };
  reason?: 'second_yellow' | 'direct_red' | 'violent_conduct';
}

export function RedCardOverlay({ player, reason }: RedCardOverlayProps) {
  const reasonLabel = reason === 'second_yellow'
    ? 'Segundo Cartão Amarelo'
    : reason === 'violent_conduct'
    ? 'Conduta Violenta'
    : 'Falta Grave';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-deep-black/95"
    >
      <motion.div
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 20 }}
        className="flex flex-col items-center gap-6 px-6"
      >
        {/* Ícone de alerta pulsante */}
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatDelay: 0.5
          }}
        >
          <AlertTriangle className="h-16 w-16 sm:h-20 sm:w-20 text-red-500" strokeWidth={2.5} />
        </motion.div>

        {/* Card principal */}
        <motion.div
          initial={{ rotateY: -90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="relative flex flex-col items-center gap-4 bg-[var(--color-event-card-red)] p-8 sm:p-10 min-w-[280px] sm:min-w-[320px]"
        >

          {/* Conteúdo */}
          <div className="relative z-10 flex flex-col items-center gap-4">
            {/* Número do jogador */}
            <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-deep-black border-4 border-white">
              <span className="ole-num text-3xl sm:text-4xl text-white">
                {player.number}
              </span>
            </div>

            {/* Título */}
            <div className="text-center">
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="font-impact text-3xl sm:text-4xl uppercase leading-[1.1] text-white mb-2"
              >
                Cartão vermelho
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="font-display text-lg sm:text-xl font-bold text-white leading-tight mb-1"
              >
                {player.name}
              </motion.p>

              <p className="text-xs sm:text-sm text-white/70 uppercase tracking-wider">
                {player.position}
              </p>
            </div>

            {/* Motivo */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-deep-black px-4 py-2"
            >
              <p className="text-xs text-white uppercase tracking-wider font-bold">
                {reasonLabel}
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* Contador */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex items-center gap-2"
        >
          <div className="h-1 w-20 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 3, ease: 'linear' }}
              className="h-full bg-red-500"
            />
          </div>
        </motion.div>

        {/* Texto de aviso */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center text-sm text-white/60 max-w-xs"
        >
          Jogador expulso. Time jogará com um a menos.
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
