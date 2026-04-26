import { Link } from 'react-router-dom';
import { ArrowRightLeft, Repeat2, ShoppingBag, Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import { useGameStore } from '@/game/store';
import { useTrackScreen } from '@/progression/trackEvent';

export function MarketHub() {
  useTrackScreen('screen_market_hub');
  const finance = useGameStore((s) => s.finance);

  const expDisplay = Math.floor(finance.ole ?? 0).toLocaleString('pt-BR');
  const broDisplay = (finance.broCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-10">
      {/* HERO EDITORIAL — padrão /exchange: eyebrow + headline duo + régua + saldos */}
      <section
        aria-label="Mercado Olefoot"
        className="relative w-full overflow-hidden bg-neon-yellow rounded-sm"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 mx-auto max-w-3xl px-5 sm:px-8 py-10 sm:py-14 text-center"
        >
          {/* Eyebrow */}
          <div
            className="ole-eyebrow !text-black mb-5 sm:mb-6"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            <span className="!text-black">Transações e mercado</span>
          </div>

          {/* Headline duo: MERCADO + italic */}
          <h1 className="leading-[0.95]">
            <span
              className="block font-bold uppercase text-black"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.75rem, 8vw, 6rem)',
                letterSpacing: '0.005em',
              }}
            >
              Mercado
            </span>
            <span
              className="block italic text-black mt-1"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 400,
                fontSize: 'clamp(2rem, 6vw, 4.5rem)',
                letterSpacing: '-0.01em',
              }}
            >
              comprar · vender · trocar
            </span>
          </h1>

          {/* Régua decorativa */}
          <span aria-hidden className="mx-auto mt-6 block w-16 h-[3px] bg-black" />

          {/* Saldos vivos */}
          <p
            className="mt-6 text-black/70 mx-auto max-w-md"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'clamp(0.85rem, 1vw, 0.95rem)',
              lineHeight: 1.55,
            }}
          >
            saldo {expDisplay} EXP · {broDisplay} BRO
          </p>

          {/* CTAs — botões amarelos invertidos (preto sobre amarelo) */}
          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/wallet"
              className="inline-flex items-center gap-2 bg-black px-7 py-3 text-neon-yellow font-bold uppercase tracking-[0.2em] text-[12px] hover:bg-deep-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
              style={{
                fontFamily: 'var(--font-display)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Wallet className="w-4 h-4" />
              Carteira
            </Link>
            <Link
              to="/mercado/transfer"
              className="inline-flex items-center gap-2 border border-black/70 bg-transparent px-7 py-3 text-black font-bold uppercase tracking-[0.2em] text-[12px] hover:bg-black/10 transition-colors"
              style={{
                fontFamily: 'var(--font-display)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Transfer
            </Link>
          </div>
        </motion.div>
      </section>

      {/* CARD HEROES — padrão /store: 3 cards com botões amarelos */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Transfer Market */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link
            to="/mercado/transfer"
            className="group block bg-[var(--color-card)] border border-white/8 hover:border-neon-yellow/40 rounded-sm overflow-hidden transition-all hover:scale-[1.01]"
          >
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded bg-neon-yellow/10 border border-neon-yellow/20">
                  <ArrowRightLeft className="w-6 h-6 text-neon-yellow" />
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest text-neon-yellow/70"
                  style={{ fontFamily: 'var(--font-ui)' }}
                >
                  Jogadores
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-white text-xl mb-2 group-hover:text-neon-yellow transition-colors">
                  Transfer Market
                </h3>
                <p className="text-sm text-white/55 leading-relaxed">
                  Comprar e vender jogadores no mercado global. Negocia com outros clubes e monta o plantel ideal.
                </p>
              </div>
              <div className="mt-auto pt-2">
                <span
                  className="inline-flex items-center gap-2 bg-neon-yellow text-black px-5 py-2.5 font-bold uppercase tracking-[0.2em] text-[11px] group-hover:bg-white transition-colors shadow-[0_4px_12px_rgba(253,225,0,0.25)]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  Explorar mercado
                </span>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Card 2: Exchange */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Link
            to="/mercado/exchange"
            className="group block bg-[var(--color-card)] border border-white/8 hover:border-neon-yellow/40 rounded-sm overflow-hidden transition-all hover:scale-[1.01]"
          >
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded bg-blue-400/10 border border-blue-400/20">
                  <Repeat2 className="w-6 h-6 text-blue-400" />
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest text-blue-400/70"
                  style={{ fontFamily: 'var(--font-ui)' }}
                >
                  Câmbio
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-white text-xl mb-2 group-hover:text-neon-yellow transition-colors">
                  Exchange
                </h3>
                <p className="text-sm text-white/55 leading-relaxed">
                  Câmbio paralelo EXP ↔ BRO. Anuncia lotes de EXP ou compra ofertas de outros managers.
                </p>
              </div>
              <div className="mt-auto pt-2">
                <span
                  className="inline-flex items-center gap-2 bg-neon-yellow text-black px-5 py-2.5 font-bold uppercase tracking-[0.2em] text-[11px] group-hover:bg-white transition-colors shadow-[0_4px_12px_rgba(253,225,0,0.25)]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  Ver ofertas
                </span>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Card 3: Loja */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Link
            to="/mercado/loja"
            className="group block bg-[var(--color-card)] border border-white/8 hover:border-neon-yellow/40 rounded-sm overflow-hidden transition-all hover:scale-[1.01]"
          >
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="p-3 rounded bg-purple-400/10 border border-purple-400/20">
                  <ShoppingBag className="w-6 h-6 text-purple-400" />
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest text-purple-400/70"
                  style={{ fontFamily: 'var(--font-ui)' }}
                >
                  Itens
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-white text-xl mb-2 group-hover:text-neon-yellow transition-colors">
                  Loja
                </h3>
                <p className="text-sm text-white/55 leading-relaxed">
                  Packs de jogadores, boosters de partida e itens especiais. Tudo num só lugar.
                </p>
              </div>
              <div className="mt-auto pt-2">
                <span
                  className="inline-flex items-center gap-2 bg-neon-yellow text-black px-5 py-2.5 font-bold uppercase tracking-[0.2em] text-[11px] group-hover:bg-white transition-colors shadow-[0_4px_12px_rgba(253,225,0,0.25)]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  Abrir loja
                </span>
              </div>
            </div>
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
