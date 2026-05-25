import { useMemo, useState } from 'react';
import { motion } from 'motion/react';

const FROM_OPTIONS = [
  { ticker: 'USDT', logo: '/wallet-usdt-logo.png' },
  { ticker: 'BTC', logo: '/wallet-btc-logo.png' },
  { ticker: 'BNB', logo: '/wallet-bnb-logo.png' },
];

const TO_OPTIONS = [
  { ticker: 'OLE', logo: '/wallet-olefoot-logo.png', rate: 5 },
  { ticker: 'EXP', logo: '/wallet-olefoot-logo.png', rate: 1000 },
];

/**
 * Mini-swap inline — UI only (calcula preview com taxas mock).
 * Substituirá o card "Como Funciona" estático.
 */
export function MiniSwapInline() {
  const [fromTicker, setFromTicker] = useState('USDT');
  const [toTicker, setToTicker] = useState('OLE');
  const [amount, setAmount] = useState('100');

  const to = useMemo(() => TO_OPTIONS.find((t) => t.ticker === toTicker)!, [toTicker]);
  const numeric = Number(amount.replace(',', '.')) || 0;
  const preview = numeric * to.rate;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80">
            Swap rápido
          </p>
          <h2
            className="mt-1 font-display text-[22px] font-black uppercase leading-none tracking-tight text-white sm:text-[26px]"
            style={{ letterSpacing: '0.005em' }}
          >
            Cripto → In-Game
          </h2>
        </div>
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">
          1 USDT ≈ 5 OLE · mock
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="border border-white/[0.06] p-4 sm:p-5"
        style={{
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-panel-elevated,#0b0b0b)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
          {/* FROM */}
          <div className="rounded-md border border-white/[0.06] bg-black/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-[9px] font-bold uppercase tracking-[0.22em] text-white/40">
                De
              </span>
              <select
                value={fromTicker}
                onChange={(e) => setFromTicker(e.target.value)}
                className="bg-transparent text-[12px] font-bold text-white outline-none"
              >
                {FROM_OPTIONS.map((o) => (
                  <option key={o.ticker} value={o.ticker} className="bg-deep-black">
                    {o.ticker}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
              className="mt-2 w-full bg-transparent tabular-nums text-white outline-none"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontStyle: 'italic',
                fontSize: '24px',
                lineHeight: 1,
              }}
            />
          </div>

          {/* Switch */}
          <div className="flex sm:flex-col items-center justify-center text-neon-yellow/70">
            <span aria-hidden className="text-xl">↓</span>
            <span aria-hidden className="hidden sm:block text-xl rotate-180 mt-1">↓</span>
          </div>

          {/* TO */}
          <div className="rounded-md border border-neon-yellow/30 bg-neon-yellow/[0.06] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-[9px] font-bold uppercase tracking-[0.22em] text-neon-yellow">
                Para
              </span>
              <select
                value={toTicker}
                onChange={(e) => setToTicker(e.target.value)}
                className="bg-transparent text-[12px] font-bold text-white outline-none"
              >
                {TO_OPTIONS.map((o) => (
                  <option key={o.ticker} value={o.ticker} className="bg-deep-black">
                    {o.ticker}
                  </option>
                ))}
              </select>
            </div>
            <p
              className="mt-2 tabular-nums text-white"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontStyle: 'italic',
                fontSize: '24px',
                lineHeight: 1,
              }}
            >
              ~ {preview.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled
          className="mt-4 w-full rounded-md bg-neon-yellow/90 px-4 py-3 font-display text-[12px] font-black uppercase tracking-[0.18em] text-deep-black opacity-60 cursor-not-allowed"
          title="Swap habilitará quando paridades reais forem ligadas"
        >
          Trocar agora · em breve
        </button>
      </motion.div>
    </section>
  );
}
