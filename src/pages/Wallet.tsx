import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { olexpSummary } from '@/wallet/olexp';
import { referralSummary } from '@/wallet/referral';
import { gatSummary } from '@/wallet/gat';
import { createInitialWalletState } from '@/wallet/initial';
import { WalletShell } from './wallet/WalletShell';
import { DepositModal } from './wallet/DepositModal';
import { SendModal } from './wallet/SendModal';
import { CryptoCoinCard } from './wallet/CryptoCoinCard';
import { ActivityStrip } from './wallet/ActivityStrip';
import { SquadValuationCard } from './wallet/SquadValuationCard';
import { MatchReceiptCard, type MatchReceiptData } from './wallet/MatchReceiptCard';
import { TrophyShowcase } from './wallet/TrophyShowcase';
import { MiniSwapInline } from './wallet/MiniSwapInline';
import { PlayerWatchlist } from './wallet/PlayerWatchlist';
import { WalletQuickActions, type QuickAction } from './wallet/WalletQuickActions';
import {
  useSquadValuation,
  useTopSquadPlayers,
  useUnlockedTrophies,
} from './wallet/useWalletPlayerData';
import { MatchCountdownChip } from './wallet/MatchCountdownChip';
import { RivalsLeaderboardMini } from './wallet/RivalsLeaderboardMini';
import { MOCK_MARKETS, formatSpotUsd } from './wallet/walletMockMarkets';
import { useOlefootUsdBrlQuote } from '@/wallet/useOlefootUsdBrlQuote';
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

const USDT_BRL_RATE = 5.0;

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
  const [sendOpen, setSendOpen] = useState(false);
  const usdBrlQuote = useOlefootUsdBrlQuote(true);

  const _olexp = olexpSummary({ ...wallet, spotBroCents: finance.broCents });
  const _ref = referralSummary(wallet);
  const gat = gatSummary(wallet);

  // SmartHub usa finance.ole (saldo EXP gastável; nome legado). Mesmo campo aqui pra consistência.
  const expBalance = finance.ole ?? 0;

  // ── DADOS REAIS DO PLANTEL ────────────────────────────────────
  const squadValuation = useSquadValuation();
  const topSquadPlayers = useTopSquadPlayers(3);
  const trophies = useUnlockedTrophies();

  // ── MOCK DATA — substituir por dados reais conforme integração ──
  const mockReceipt: MatchReceiptData = {
    roundLabel: 'Round 22',
    opponent: 'CAM FC',
    result: '2 — 1',
    isHome: true,
    lines: [
      { label: 'Prêmio de vitória', amount: 1200, currency: 'EXP' },
      { label: 'Bilheteria', amount: 120, currency: 'OLE' },
      { label: 'Performance individual', amount: 50, currency: 'EXP' },
      { label: 'Salários do round', amount: -340, currency: 'OLE' },
      { label: 'Manutenção estádio', amount: -80, currency: 'OLE' },
    ],
  };


  // Kickoff mock 4h12min no futuro pro countdown render
  const mockKickoffIso = new Date(Date.now() + 4 * 3600_000 + 12 * 60_000).toISOString();

  const quickActions: QuickAction[] = [
    { key: 'deposit', label: 'Depositar', icon: '↓', accent: 'green', onClick: () => setDepositOpen(true) },
    { key: 'withdraw', label: 'Sacar', icon: '↑', accent: 'red', onClick: () => setSendOpen(true) },
    { key: 'swap', label: 'Swap', icon: '⇄', accent: 'yellow', onClick: () => {} },
    { key: 'gat', label: 'GAT', icon: '✦', accent: 'amber', onClick: () => navigate('/wallet/gat'), badge: gat.activeCount > 0 ? String(gat.activeCount) : undefined },
    { key: 'extract', label: 'Extrato', icon: '☰', accent: 'cyan', onClick: () => navigate('/wallet/extract') },
  ];

  // Squad Valuation — total, destaque, change e spark vindos do store real
  // (playerEvolutionTimeline alimenta sparklines + change ponderado).
  // Fallback: spark mock só se nenhum jogador tiver timeline ainda.
  const squadCardData = {
    totalOle: squadValuation.totalOle,
    change24h: squadValuation.change24h,
    playerCount: squadValuation.playerCount,
    spark: squadValuation.spark.length >= 2 ? squadValuation.spark : MOCK_MARKETS.SQUAD.spark,
    highlight: squadValuation.highest ?? undefined,
  };

  const heroStats = [
    {
      label: 'Patrimônio Total',
      value: formatPatrimonioUsd(finance.broCents),
      highlight: true,
      spark: MOCK_MARKETS.PORTFOLIO.spark,
      sparkPositive: MOCK_MARKETS.PORTFOLIO.change24h >= 0,
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
      ticker: 'BTC',
      name: 'Bitcoin',
      logoSrc: '/wallet-btc-logo.png',
      balance: '0.00000000 BTC',
      fiatRef: '≈ $0.00',
      change24h: MOCK_MARKETS.BTC.change24h,
      spark: MOCK_MARKETS.BTC.spark,
      spotPrice: formatSpotUsd(MOCK_MARKETS.BTC.spotUsd!),
    },
    {
      ticker: 'USDT',
      name: 'Tether',
      logoSrc: '/wallet-usdt-logo.png',
      balance: formatUsdt(finance.broCents),
      fiatRef: formatUsdtUsdRef(finance.broCents),
      badge: 'Ativa',
      change24h: MOCK_MARKETS.USDT.change24h,
      spark: MOCK_MARKETS.USDT.spark,
      spotPrice: formatSpotUsd(MOCK_MARKETS.USDT.spotUsd!),
    },
    {
      ticker: 'BNB',
      name: 'BNB Chain',
      logoSrc: '/wallet-bnb-logo.png',
      balance: '0.0000 BNB',
      fiatRef: '≈ $0.00',
      change24h: MOCK_MARKETS.BNB.change24h,
      spark: MOCK_MARKETS.BNB.spark,
      spotPrice: formatSpotUsd(MOCK_MARKETS.BNB.spotUsd!),
    },
    {
      ticker: 'OLE',
      name: 'Olefoot',
      logoSrc: '/wallet-olefoot-logo.png',
      balance: '0 OLE',
      fiatRef: 'Moeda oficial • compra jogadores',
      highlight: true,
      badge: 'Oficial',
      change24h: MOCK_MARKETS.OLE.change24h,
      spark: MOCK_MARKETS.OLE.spark,
      spotPrice: formatSpotUsd(MOCK_MARKETS.OLE.spotUsd!),
    },
  ];

  return (
    <WalletShell
      account="spot"
      title="Conta SPOT"
      subtitle="Carteira multi-ativos: BTC, USDT, BNB e OLE. Use cripto para comprar EXP ou OLE, e EXP/OLE para contratar jogadores."
      heroStats={heroStats}
      heroVariant="compact"
    >
      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} quote={usdBrlQuote} />
      <SendModal open={sendOpen} onClose={() => setSendOpen(false)} />

      {/* ── MATCH COUNTDOWN ──────────────────────────────────────── */}
      <MatchCountdownChip
        kickoffIso={mockKickoffIso}
        opponent="FLA"
        roundLabel="Round 23"
        isHome={true}
        venue="Maracanã"
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

      {/* ── RIVALS LEADERBOARD MINI ──────────────────────────────── */}
      <RivalsLeaderboardMini
        position={12}
        total={1240}
        gapToNextOle={200}
        nextRivalName="Coach Diogo"
        delta24h={2}
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
          <span className="hidden sm:block text-[10px] uppercase tracking-[0.2em] text-white/35">
            1 USDT ≈ R$ {USDT_BRL_RATE.toFixed(2)}
          </span>
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

      {/* ── RECIBO DA ÚLTIMA PARTIDA ──────────────────────────────── */}
      <MatchReceiptCard data={mockReceipt} />

      {/* ── MINI-SWAP (substitui o card "Como Funciona" estático) ── */}
      <MiniSwapInline />

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
