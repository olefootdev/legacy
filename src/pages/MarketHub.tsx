import { Link } from 'react-router-dom';
import { ArrowRightLeft, Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import { useGameStore } from '@/game/store';
import { useTrackScreen } from '@/progression/trackEvent';
import { HubSectionCard } from '@/components/ui/HubSectionCard';

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

      {/* CARDS DE SE\u00c7\u00c3O \u2014 Sprint B: trilho lateral + t\u00edtulo editorial + CTA texto-claro */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubSectionCard
          to="/mercado/transfer"
          eyebrow="Jogadores"
          title="Transfer Market"
          description="Comprar e vender jogadores no mercado global. Negocia com outros clubes e monta o plantel ideal."
          cta="Explorar mercado"
          rail="bg-neon-yellow"
          delay={0.1}
        />
        <HubSectionCard
          to="/mercado/exchange"
          eyebrow="Câmbio"
          title="Exchange"
          description="Câmbio paralelo EXP ↔ BRO. Anuncia lotes de EXP ou compra ofertas de outros managers."
          cta="Ver ofertas"
          rail="bg-cyan-300"
          delay={0.2}
        />
        <HubSectionCard
          to="/mercado/loja"
          eyebrow="Itens"
          title="Loja"
          description="Packs de jogadores, boosters de partida e itens especiais. Tudo num só lugar."
          cta="Abrir loja"
          rail="bg-fuchsia-400"
          delay={0.3}
        />
      </section>
    </div>
  );
}
