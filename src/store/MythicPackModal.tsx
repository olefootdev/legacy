/**
 * Modal de Detalhes da Cápsula Lendária
 * Exibe informações completas, conteúdo do pack e CTA de compra
 */

import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Package, TrendingUp, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MythicPackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase: () => void;
}

export function MythicPackModal({ isOpen, onClose, onPurchase }: MythicPackModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-4 z-50 mx-auto my-auto max-h-[90vh] max-w-4xl overflow-y-auto rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-950/95 via-orange-950/90 to-black/95 shadow-2xl backdrop-blur-xl md:inset-8"
          >
            {/* Glow animado de fundo */}
            <motion.div
              animate={{
                opacity: [0.2, 0.4, 0.2],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-400/20 blur-3xl"
            />

            {/* Header */}
            <div className="relative border-b border-amber-400/20 p-6 md:p-8">
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                  <Package className="h-8 w-8 text-amber-300" strokeWidth={2} />
                </div>

                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-300" strokeWidth={2.5} />
                    <span className="font-display text-[9px] font-black uppercase tracking-widest text-amber-300/80">
                      Edição Limitada
                    </span>
                  </div>

                  <h2
                    className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontStyle: 'italic',
                      fontSize: 'clamp(2rem, 5vw, 3rem)',
                      letterSpacing: '-0.02em',
                      lineHeight: 0.95,
                    }}
                  >
                    Cápsula Lendária
                  </h2>

                  <p className="mt-2 text-sm text-gray-400">
                    Pack exclusivo com os melhores jogadores e itens raros do jogo
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="relative space-y-6 p-6 md:p-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-amber-400/20 bg-black/40 p-4 text-center">
                  <Package className="mx-auto mb-2 h-5 w-5 text-amber-300" />
                  <p className="font-display text-[9px] font-bold uppercase tracking-wider text-amber-300/70">
                    Itens
                  </p>
                  <p className="mt-1 font-mono text-xl font-bold text-amber-200">12</p>
                </div>

                <div className="rounded-lg border border-amber-400/20 bg-black/40 p-4 text-center">
                  <Star className="mx-auto mb-2 h-5 w-5 text-amber-300" />
                  <p className="font-display text-[9px] font-bold uppercase tracking-wider text-amber-300/70">
                    Míticos
                  </p>
                  <p className="mt-1 font-mono text-xl font-bold text-amber-200">3+</p>
                </div>

                <div className="rounded-lg border border-amber-400/20 bg-black/40 p-4 text-center">
                  <TrendingUp className="mx-auto mb-2 h-5 w-5 text-amber-300" />
                  <p className="font-display text-[9px] font-bold uppercase tracking-wider text-amber-300/70">
                    Restantes
                  </p>
                  <p className="mt-1 font-mono text-xl font-bold text-amber-200">23</p>
                </div>

                <div className="rounded-lg border border-amber-400/20 bg-black/40 p-4 text-center">
                  <Zap className="mx-auto mb-2 h-5 w-5 text-amber-300" />
                  <p className="font-display text-[9px] font-bold uppercase tracking-wider text-amber-300/70">
                    Raridade
                  </p>
                  <p className="mt-1 font-mono text-xl font-bold text-amber-200">0.5%</p>
                </div>
              </div>

              {/* Conteúdo do Pack */}
              <div>
                <h3 className="mb-4 font-display text-sm font-black uppercase tracking-wider text-amber-200">
                  O que você recebe
                </h3>

                <div className="space-y-3">
                  {[
                    { icon: Star, label: '3 Jogadores Míticos', desc: 'Overall 90+ garantido' },
                    { icon: Package, label: '5 Jogadores Épicos', desc: 'Overall 85-89' },
                    { icon: Zap, label: '2 Boosters Premium', desc: 'Fadiga + Lesão' },
                    { icon: Sparkles, label: '2 Itens Especiais', desc: 'Cosméticos exclusivos' },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/10">
                        <item.icon className="h-5 w-5 text-amber-300" strokeWidth={2} />
                      </div>
                      <div className="flex-1">
                        <p className="font-display text-xs font-bold uppercase tracking-wide text-white">
                          {item.label}
                        </p>
                        <p className="mt-0.5 text-[10px] text-gray-500">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Descrição */}
              <div className="rounded-lg border border-amber-400/20 bg-black/40 p-4">
                <p className="text-xs leading-relaxed text-gray-400">
                  A <span className="font-bold text-amber-300">Cápsula Lendária</span> é o pack mais
                  exclusivo da OLEFOOT. Com apenas 100 unidades produzidas, cada cápsula contém uma
                  seleção premium de jogadores míticos, boosters raros e itens cosméticos únicos.
                  Perfeito para quem quer montar um time de elite rapidamente.
                </p>
              </div>
            </div>

            {/* Footer com preço e CTA */}
            <div className="relative border-t border-amber-400/20 bg-black/40 p-6 md:p-8">
              <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
                <div>
                  <p className="font-display text-[9px] font-bold uppercase tracking-wider text-amber-300/70">
                    Preço
                  </p>
                  <p
                    className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontStyle: 'italic',
                      fontSize: 'clamp(2rem, 4vw, 2.5rem)',
                      letterSpacing: '-0.02em',
                      lineHeight: 0.9,
                    }}
                  >
                    ¢79.00
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onPurchase}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-400/60 bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-4 font-display text-sm font-black uppercase tracking-wider text-black shadow-[0_4px_16px_rgba(251,191,36,0.4)] transition-shadow hover:shadow-[0_6px_24px_rgba(251,191,36,0.6)] md:w-auto"
                >
                  <ShoppingBag className="h-5 w-5" strokeWidth={2.5} />
                  Comprar Agora
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ShoppingBag({ className, strokeWidth }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      className={className}
      fill="none"
      strokeWidth={strokeWidth}
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
      />
    </svg>
  );
}
