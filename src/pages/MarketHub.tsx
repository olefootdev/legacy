import { Link } from 'react-router-dom';
import { ArrowRightLeft, Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import { useGameStore } from '@/game/store';
import { useTrackScreen } from '@/progression/trackEvent';
import { HubSectionCard } from '@/components/ui/HubSectionCard';
import { L, LOCALE } from '@/i18n/L';

export function MarketHub() {
  useTrackScreen('screen_market_hub');
  const finance = useGameStore((s) => s.finance);

  const expDisplay = Math.floor(finance.ole ?? 0).toLocaleString(LOCALE);
  const broDisplay = (finance.broCents / 100).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-10">
      {/* ── HERO — bloco amarelo no layer final ────────────────────────────
          Antes: centralizado, com "comprar · vender · trocar" em serifa
          itálica do tamanho da manchete e uma régua decorativa. A serifa
          itálica é assinatura de nome de lenda, e o subtítulo competia com o
          título. Agora o saldo — que é o dado real — ocupa esse lugar. */}
      <section
        aria-label={L('Mercado Olefoot', 'Olefoot Market')}
        className="relative w-full overflow-hidden bg-neon-yellow"
        style={{ borderRadius: 'var(--radius-poster)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 px-5 sm:px-8"
          style={{ paddingBlock: 'clamp(28px, 6vw, 52px)' }}
        >
          <span className="ole-eyebrow-poster" data-on="yellow" style={{ fontSize: '12px' }}>
            {L('Transações', 'Transactions')}
          </span>

          <h1
            className="mt-2 font-impact uppercase"
            style={{
              color: 'var(--color-deep-black)',
              fontSize: 'clamp(44px, 12vw, 92px)',
              lineHeight: 0.84,
              letterSpacing: '-0.01em',
            }}
          >
            {L('Mercado', 'Market')}
          </h1>

          {/* Saldo: o número manda, o rótulo acompanha. */}
          <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <span className="font-impact tabular-nums" style={{ fontSize: '30px', lineHeight: 0.85, color: 'var(--color-deep-black)' }}>
              {expDisplay}
              <span className="ml-1.5 font-display font-black" style={{ fontSize: '11px', letterSpacing: '0.14em' }}>
                EXP
              </span>
            </span>
            <span className="font-impact tabular-nums" style={{ fontSize: '30px', lineHeight: 0.85, color: 'rgba(13,13,13,0.55)' }}>
              {broDisplay}
              <span className="ml-1.5 font-display font-black" style={{ fontSize: '11px', letterSpacing: '0.14em' }}>
                BRO
              </span>
            </span>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/wallet"
              className="inline-flex items-center gap-2 bg-black px-7 py-3 text-neon-yellow font-bold uppercase tracking-[0.2em] text-[12px] hover:bg-deep-black/80 transition-colors"
              style={{
                fontFamily: 'var(--font-display)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Wallet className="w-4 h-4" />
              {L('Carteira', 'Wallet')}
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

      {/* Se\u00e7\u00f5es do mercado \u2014 o Transfer \u00e9 o destaque amarelo. */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubSectionCard
          to="/mercado/transfer"
          eyebrow={L('Jogadores', 'Players')}
          title="Transfer Market"
          description={L('Compra e venda entre clubes', 'Buy and sell between clubs')}
          cta={L('Explorar mercado', 'Explore market')}
          destaque
          delay={0.1}
        />
        <HubSectionCard
          to="/mercado/vivo"
          eyebrow={L('Bolsa', 'Exchange')}
          title={L('Mercado ao Vivo', 'Live Market')}
          description={L('Ticker, OLE-100 e leilão do MVP', 'Ticker, OLE-100 and MVP auction')}
          cta={L('Ver a bolsa', 'View exchange')}
          delay={0.2}
        />
        <HubSectionCard
          to="/mercado/loja"
          eyebrow={L('Itens', 'Items')}
          title={L('Loja', 'Store')}
          description={L('Packs, boosters e extras', 'Packs, boosters and extras')}
          cta={L('Abrir loja', 'Open store')}
          delay={0.3}
        />
      </section>
    </div>
  );
}
