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
import { SolanaWalletCard } from './wallet/SolanaWalletCard';
import {
  useSquadValuation,
  useTopSquadPlayers,
  useUnlockedTrophies,
} from './wallet/useWalletPlayerData';
import { useOlefootUsdBrlQuote } from '@/wallet/useOlefootUsdBrlQuote';
import { fetchLegacyBalance } from '@/wallet/applyLegacyOlefootCredit';
import { MOEDA_JOGO } from '@/wallet/constants';
import { useTrackScreen } from '@/progression/trackEvent';
import { SecaoVolt } from '@/components/ui';

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

/** Crédito interno em BRO. Trazia o sufixo "USDT" — não é Tether, é crédito do jogo. */
function formatBro(cents: number): string {
  const value = cents / 100;
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BRO`;
}

function formatUsdtUsdRef(cents: number): string {
  const value = cents / 100;
  return `≈ ${value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`;
}

/** Mesmo número do card abaixo, mesma unidade: o topo dizia "$0.00" embaixo do
 *  rótulo "Crédito (BRO)" — dois nomes pro mesmo saldo na mesma tela. */
function formatBroCompacto(cents: number): string {
  const value = cents / 100;
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BRO`;
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
      label: 'Crédito (BRO)',
      value: formatBroCompacto(finance.broCents),
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
      // Era "USDT · Tether", com o logo da Tether, em cima de `finance.broCents`
      // — que é crédito INTERNO comprado no PIX, não Tether nenhum. Com o
      // stablecoin de verdade chegando na Solana, esse rótulo deixaria de ser gafe.
      ticker: 'BRO',
      name: 'Crédito Olefoot',
      logoSrc: '/wallet-olefoot-logo.png',
      balance: formatBro(finance.broCents),
      fiatRef: formatUsdtUsdRef(finance.broCents),
    },
    {
      // Era "OLEFOOT · Olefoot Token" — o mesmo nome do token da Solana, com a
      // palavra "Token" no rótulo. Agora é OLEXP: saldo do jogo (constants.ts).
      ticker: MOEDA_JOGO,
      name: 'Saldo do jogo',
      logoSrc: '/wallet-olefoot-logo.png',
      balance: `${formatCompact(olefootBalance)} ${MOEDA_JOGO}`,
      // SEM preço em dólar. Trazia `≈ $0.000000 · $0.000001/OLEXP (preço interno)`
      // embaixo do saldo. OLEXP é saldo de jogo e não converte em nada: um valor
      // em dólar ao lado dele é a própria confusão que o rename veio matar, e na
      // véspera do token na Solana isso volta como cobrança. Com esta linha
      // fora, `OLE_INTERNAL_PRICE_USD` ficou SEM NENHUM consumidor no app.
      fiatRef: undefined,
      highlight: true,
    },
  ];

  return (
    <WalletShell
      title="Conta SPOT"
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

      {/* ── CARTEIRA SOLANA (vínculo, não é claim real ainda) ─────── */}
      <SolanaWalletCard />

      {/* ── PATRIMÔNIO ESPORTIVO (Squad Valuation — dados reais) ── */}
      <SquadValuationCard
        totalOle={squadCardData.totalOle}
        change24h={squadCardData.change24h}
        playerCount={squadCardData.playerCount}
        spark={squadCardData.spark}
        highlight={squadCardData.highlight}
      />

      {/* ── SEUS SALDOS ───────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <SecaoVolt label="Seus saldos" tone="neutro" className="min-w-0 grow" />
          {usdBrlQuote.status === 'ok' && (
            <span className="hidden shrink-0 font-mono text-[10.5px] tabular-nums text-poeira sm:block">
              1 BRO ≈ US$ 1 ≈ R$ {usdBrlQuote.olefootVenda.toFixed(2)}
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
