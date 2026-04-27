/**
 * Hero Section para Pack Mítico
 * Seção cinematográfica com Moret italic para destacar o pack lendário
 */

import { motion } from 'motion/react';
import { Sparkles, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { MythicPackModal } from './MythicPackModal';

export function MythicPackHero() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handlePurchase = () => {
    // TODO: integrar com sistema de compra
    console.log('Compra da Cápsula Lendária');
    setIsModalOpen(false);
  };

  return (
    <>
      <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, type: 'spring', stiffness: 200 }}
      className="relative overflow-hidden rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-950/30 via-orange-950/20 to-black/90 p-8"
    >
      {/* Glow animado de fundo */}
      <motion.div
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        {/* Texto principal */}
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-300" strokeWidth={2.5} />
            <span className="font-display text-[9px] font-black uppercase tracking-widest text-amber-300/80">
              Edição Limitada
            </span>
          </div>

          <h2 className="leading-[0.95]">
            <span
              className="block text-white/90"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontStyle: 'italic',
                fontSize: 'clamp(2.5rem, 6vw, 4rem)',
                letterSpacing: '-0.02em',
              }}
            >
              Cápsula
            </span>
            <span
              className="block bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontStyle: 'italic',
                fontSize: 'clamp(2.5rem, 6vw, 4rem)',
                letterSpacing: '-0.02em',
              }}
            >
              Lendária
            </span>
          </h2>

          <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-400">
            Pack exclusivo com jogadores míticos e itens raros. Apenas 23 unidades restantes.
          </p>
        </div>

        {/* Stats e CTA */}
        <div className="flex flex-col items-start gap-3 md:items-end">
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-display text-[9px] font-bold uppercase tracking-wider text-amber-300/70">
                Restantes
              </p>
              <p className="font-mono text-2xl font-bold text-amber-200">23</p>
            </div>
            <div className="h-12 w-px bg-amber-400/30" />
            <div className="text-right">
              <p className="font-display text-[9px] font-bold uppercase tracking-wider text-amber-300/70">
                Preço
              </p>
              <p className="font-mono text-2xl font-bold text-amber-200">¢79.00</p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-amber-400/60 bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-display text-xs font-black uppercase tracking-wider text-black shadow-[0_4px_16px_rgba(251,191,36,0.4)] transition-shadow hover:shadow-[0_6px_24px_rgba(251,191,36,0.6)]"
          >
            <TrendingUp className="h-4 w-4" strokeWidth={2.5} />
            Ver Detalhes
          </motion.button>
        </div>
      </div>
    </motion.div>

      <MythicPackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPurchase={handlePurchase}
      />
    </>
  );
}
