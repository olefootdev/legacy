import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, Layers, Repeat, Menu } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { createInitialWalletState } from '@/wallet/initial';
import { WalletShell } from './wallet/WalletShell';
import { DepositModal } from './wallet/DepositModal';
import { PixCheckoutModal } from '@/components/PixCheckoutModal';
import { CryptoCoinCard } from './wallet/CryptoCoinCard';
import { ActivityStrip } from './wallet/ActivityStrip';
import { SquadValuationCard } from './wallet/SquadValuationCard';
import { TrophyShowcase } from './wallet/TrophyShowcase';
import { PlayerWatchlist } from './wallet/PlayerWatchlist';
import { WalletQuickActions, type QuickAction } from './wallet/WalletQuickActions';
import {
  useSquadValuation,
  useTopSquadPlayers,
  useUnlockedTrophies,
} from './wallet/useWalletPlayerData';
import { useOlefootUsdBrlQuote } from '@/wallet/useOlefootUsdBrlQuote';
import { fetchLegacyBalance } from '@/wallet/applyLegacyOlefootCredit';
import { OLE_INTERNAL_PRICE_DISPLAY, oleToUsd } from '@/wallet/constants';
import { useTrackScreen } from '@/progression/trackEvent';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return reduced;
}

function formatUsdt(cents: number): string {
  const value = cents / 100;
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
}

function formatUsdtUsdRef(cents: number): string {
  const value = cents / 100;
  return `≈ ${value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`;
}

function formatPatrimonioUsd(cents: number): string {
  const value = cents / 100;
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** 11.965.198 → "11.9M"; 1.234 → "1.2K"; 950 → "950" — trunca, não arredonda. */
function formatCompact(n: number): string {
  if (n >= 1e9) {
    const v = Math.floor(n / 1e8) / 10;
    return `${v.toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (n >= 1e6) {
    const v = Math.floor(n / 1e5) / 10;
    return `${v.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (n >= 1e3) {
    const v = Math.floor(n / 1e2) / 10;
    return `${v.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return n.toLocaleString('pt-BR');
}

export function Wallet() {
  useTrackScreen('screen_wallet');
  const navigate = useNavigate();
  const finance = useGameStore((s) => s.finance);
  const wallet = finance.wallet ?? createInitialWalletState();
  const reducedMotion = usePrefersReducedMotion();
  const [depositOpen, setDepositOpen] = useState(false);
  const [pixOpen, setPixOpen] = useState(false);
  const [pixAmountCents, setPixAmountCents] = useState(0);
  const usdBrlQuote = useOlefootUsdBrlQuote(true);

  const [legacyBalance, setLegacyBalance] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchLegacyBalance().then((lb) => {
      if (!cancelled && lb.balanceHuman) setLegacyBalance(lb.balanceHuman);
    });
    return () => { cancelled = true; };
  }, []);

  const expBalance = finance.ole ?? 0;
  const olefootBalance = legacyBalance != null ? Number(legacyBalance) : 0;

  // ── DADOS REAIS DO PLANTEL ────────────────────────────────────
  const squadValuation = useSquadValuation();
  const topSquadPlayers = useTopSquadPlayers(3);
  const trophies = useUnlockedTrophies();

  const quickActions: QuickAction[] = [
    { key: 'deposit', label: 'Depositar', icon: <ArrowDown className="h-5 w-5" strokeWidth={2.2} />, accent: 'green', onClick: () => setDepositOpen(true) },
    { key: 'collection', label: 'Coleção', icon: <Layers className="h-5 w-5" strokeWidth={2.2} />, accent: 'yellow', onClick: () => navigate('/wallet/colecao') },
    { key: 'referrals', label: 'Indicações', icon: <Repeat className="h-5 w-5" strokeWidth={2.2} />, accent: 'amber', onClick: () => navigate('/wallet/referrals') },
    { key: 'extract', label: 'Extrato', icon: <Menu className="h-5 w-5" strokeWidth={2.2} />, accent: 'cyan', onClick: () => navigate('/wallet/extract') },
  ];

  // Squad Valuation — tudo vem do store real (playerEvolutionTimeline alimenta
  // spark + change ponderado). Sem timeline, `spark` fica vazio e o gráfico
  // simplesmente não renderiza: [0,0] desenhava uma linha reta verde inventada.
  const squadCardData = {
    totalOle: squadValuation.totalOle,
    change24h: squadValuation.change24h,
    playerCount: squadValuation.playerCount,
    spark: squadValuation.spark,
    highlight: squadValuation.highest ?? undefined,
  };

  const heroStats = [
    {
      label: 'Saldo USDT',
      value: formatPatrimonioUsd(finance.broCents),
      highlight: true,
    },
    {
      label: 'EXP',
      value: formatCompact(expBalance),
      subValue: `${expBalance.toLocaleString('pt-BR')} EXP`,
      highlight: false,
    },
  ];

  const cryptoCoins: Array<{
    ticker: string;
    name: string;
    logoSrc: string;
    balance: string;
    fiatRef?: string;
    highlight?: boolean;
    badge?: string;
    change24h?: number;
    spark?: number[];
    spotPrice?: string;
  }> = [
    {
      ticker: 'USDT',
      name: 'Tether',
      logoSrc: '/wallet-usdt-logo.png',
      balance: formatUsdt(finance.broCents),
      fiatRef: formatUsdtUsdRef(finance.broCents),
    },
    {
      ticker: 'OLEFOOT',
      name: 'Olefoot Token',
      logoSrc: '/wallet-olefoot-logo.png',
      balance: `${formatCompact(olefootBalance)} OLEFOOT`,
      // Preço interno fixo, não cotação de mercado — por isso não vai em `spotPrice`.
      fiatRef: `≈ $${oleToUsd(olefootBalance).toFixed(6)} · ${OLE_INTERNAL_PRICE_DISPLAY}/OLE (preço interno)`,
      highlight: true,
    },
  ];

  return (
    <WalletShell
      title="Conta SPOT"
      subtitle="Carteira multi-ativos: USDT e OLEFOOT. Use USDT para comprar EXP ou OLE, e EXP/OLE para contratar jogadores."
      heroStats={heroStats}
      heroVariant="compact"
    >
      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        quote={usdBrlQuote}
        onContinueToPix={(cents) => {
          setPixAmountCents(cents);
          setPixOpen(true);
        }}
      />
      <PixCheckoutModal
        open={pixOpen}
        productKind="recharge"
        amountCents={pixAmountCents}
        title="Depósito Olefoot"
        description={`Saldo BRO instantâneo após confirmação · R$ ${(pixAmountCents / 100).toFixed(2).replace('.', ',')}`}
        onClose={() => setPixOpen(false)}
        onSuccess={() => {
          setPixOpen(false);
          // applyPendingCredits no Layout vai pegar o wallet_credit criado pelo webhook
        }}
      />

      {/* ── QUICK ACTIONS (Revolut-style strip) ──────────────────── */}
      <WalletQuickActions actions={quickActions} />

      {/* ── PATRIMÔNIO ESPORTIVO (Squad Valuation — dados reais) ── */}
      <SquadValuationCard
        totalOle={squadCardData.totalOle}
        change24h={squadCardData.change24h}
        playerCount={squadCardData.playerCount}
        spark={squadCardData.spark}
        highlight={squadCardData.highlight}
      />

      {/* ── SUAS CRYPTOS ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80">
              Suas Cryptos
            </p>
            <h2
              className="mt-1 font-display text-[22px] font-black uppercase leading-none tracking-tight text-white sm:text-[26px]"
              style={{ letterSpacing: '0.005em' }}
            >
              Carteira Multi-Ativos
            </h2>
          </div>
          {usdBrlQuote.status === 'ok' && (
            <span className="hidden sm:block text-[10px] uppercase tracking-[0.2em] text-white/35 tabular-nums">
              1 USDT ≈ R$ {usdBrlQuote.olefootVenda.toFixed(2)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {cryptoCoins.map((coin, i) => (
            <CryptoCoinCard
              key={coin.ticker}
              ticker={coin.ticker}
              name={coin.name}
              logoSrc={coin.logoSrc}
              balance={coin.balance}
              fiatRef={coin.fiatRef}
              highlight={coin.highlight}
              badge={coin.badge}
              change24h={coin.change24h}
              spark={coin.spark}
              spotPrice={coin.spotPrice}
              delay={reducedMotion ? 0 : i * 0.06}
            />
          ))}
        </div>
      </section>

      {/* ── ATIVIDADE RECENTE ─────────────────────────────────────── */}
      <ActivityStrip ledger={wallet.ledger ?? []} limit={3} />

      {/* ── TOP DO PLANTEL (dados reais) ──────────────────────────── */}
      <PlayerWatchlist
        players={topSquadPlayers}
        variant="topSquad"
        onScout={() => navigate('/team')}
      />

      {/* ── VITRINE DE TROFÉUS (dados reais via memorableTrophyUnlockedIds) ─ */}
      <TrophyShowcase trophies={trophies} />
    </WalletShell>
  );
}
