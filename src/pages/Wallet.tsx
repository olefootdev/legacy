import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { createInitialWalletState } from '@/wallet/initial';
import { WalletShell } from './wallet/WalletShell';
import { WalletAtalhos } from './wallet/WalletAtalhos';
import { CryptoCoinCard } from './wallet/CryptoCoinCard';
import { ActivityStrip } from './wallet/ActivityStrip';
import { SquadValuationCard } from './wallet/SquadValuationCard';
import { TrophyShowcase } from './wallet/TrophyShowcase';
import { PlayerWatchlist } from './wallet/PlayerWatchlist';
import {
  useSquadValuation,
  useTopSquadPlayers,
  useUnlockedTrophies,
} from './wallet/useWalletPlayerData';
import { useOlefootUsdBrlQuote } from '@/wallet/useOlefootUsdBrlQuote';
import { fetchLegacyBalance } from '@/wallet/applyLegacyOlefootCredit';
import { fetchMyLinkedSolanaWallet } from '@/supabase/solanaWallet';
import { fetchSaldoOnChain, olefootMintAddress } from '@/token/olefootMint';
import { lerMinhaPosicao, type PosicaoOlefoot } from '@/supabase/presalePosicao';
import { aoMudarAPosicao } from '@/wallet/eventosDaCarteira';
import { moedaDoJogo } from '@/wallet/constants';
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
  const usdBrlQuote = useOlefootUsdBrlQuote(true);

  const [legacyBalance, setLegacyBalance] = useState<string | null>(null);
  /** Saldo on-chain de $OLEFOOT da carteira vinculada. null = pré-TGE / sem leitura. */
  const [onchainOlefoot, setOnchainOlefoot] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchLegacyBalance().then((lb) => {
      if (!cancelled && lb.balanceHuman) setLegacyBalance(lb.balanceHuman);
    });
    // $OLEFOOT ON-CHAIN: só existe depois do TGE (VITE_OLEFOOT_MINT setado).
    // A carteira recebe token desde o dia zero — o que mostramos aqui é o que
    // o explorer mostra pra carteira VINCULADA, não um saldo interno.
    if (olefootMintAddress()) {
      void fetchMyLinkedSolanaWallet().then(async (link) => {
        if (cancelled || !link?.walletAddress) return;
        const saldo = await fetchSaldoOnChain(link.walletAddress);
        if (!cancelled && saldo != null) setOnchainOlefoot(saldo.olefoot);
      });
    }
    return () => { cancelled = true; };
  }, []);

  // OLEFOOT comprado na pré-venda. Fica na posição (travado) até liberar e ir
  // pra carteira vinculada — mas é da pessoa desde o Pix, e a primeira tela da
  // carteira TEM que mostrar. Antes só a aba DEX mostrava, e quem pagou abria a
  // SPOT e não achava o que comprou (1ª venda real, 02/10).
  const [posicao, setPosicao] = useState<PosicaoOlefoot | null>(null);
  useEffect(() => {
    let vivo = true;
    const ler = () => { void lerMinhaPosicao().then((p) => { if (vivo) setPosicao(p); }); };
    ler();
    const parar = aoMudarAPosicao(ler);
    return () => { vivo = false; parar(); };
  }, []);
  const temPosicao = posicao != null && posicao.tokens > 0n;
  const brInt = (v: bigint) => v.toLocaleString('pt-BR');
  const dolarCents = (c: number) => `$${(c / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;

  const expBalance = finance.ole ?? 0;
  const olefootBalance = legacyBalance != null ? Number(legacyBalance) : 0;

  // ── DADOS REAIS DO PLANTEL ────────────────────────────────────
  const squadValuation = useSquadValuation();
  const topSquadPlayers = useTopSquadPlayers(3);
  const trophies = useUnlockedTrophies();

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
    ...(temPosicao && posicao
      ? [{ label: 'OLEFOOT', value: brInt(posicao.tokens), highlight: true }]
      : []),
    {
      label: 'Crédito (BRO)',
      value: formatBroCompacto(finance.broCents),
      highlight: !temPosicao,
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
    // OLEFOOT DA PRÉ-VENDA — o que a pessoa comprou no Pix. Primeiro da lista
    // porque é o que ela pagou pra ter.
    ...(temPosicao && posicao
      ? [{
          ticker: 'OLEFOOT',
          name: 'Comprado na pré-venda',
          logoSrc: '/token/olefoot-token.svg',
          balance: `${brInt(posicao.tokens)} OLEFOOT`,
          fiatRef: posicao.travado > 0n
            ? `${dolarCents(posicao.compradoUsdCents)} pagos · ${brInt(posicao.travado)} travados — liberam com o tempo ou com nova compra`
            : `${dolarCents(posicao.compradoUsdCents)} pagos · liberado`,
          badge: 'Seu',
          highlight: true,
        }]
      : []),
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
      ticker: moedaDoJogo(),
      name: 'Saldo do jogo',
      logoSrc: '/wallet-olefoot-logo.png',
      balance: `${formatCompact(olefootBalance)} ${moedaDoJogo()}`,
      // SEM preço em dólar. Trazia `≈ $0.000000 · $0.000001/OLEXP (preço interno)`
      // embaixo do saldo. OLEXP é saldo de jogo e não converte em nada: um valor
      // em dólar ao lado dele é a própria confusão que o rename veio matar, e na
      // véspera do token na Solana isso volta como cobrança. Com esta linha
      // fora, `OLE_INTERNAL_PRICE_USD` ficou SEM NENHUM consumidor no app.
      fiatRef: undefined,
      highlight: !temPosicao,
    },
    // $OLEFOOT ON-CHAIN — aparece sozinho quando o mint existir (pós-TGE).
    // Antes da liquidez o token não tem preço de mercado e a linha diz isso.
    ...(olefootMintAddress() && onchainOlefoot != null
      ? [{
          ticker: '$OLEFOOT',
          name: 'Token na Solana (on-chain)',
          logoSrc: '/token/olefoot-token.svg',
          balance: `${formatCompact(onchainOlefoot)} OLEFOOT`,
          fiatRef: 'na tua carteira vinculada · preço de mercado chega com a pool de liquidez',
          badge: 'Solana',
        }]
      : []),
  ];

  return (
    <WalletShell
      title="Conta SPOT"
      heroStats={heroStats}
      heroVariant="compact"
    >
      {/* ── ATALHOS: os mesmos quatro em SPOT e em DEX ───────────────
          O vínculo com a carteira Solana saiu daqui: ele é da conta DEX. */}
      <WalletAtalhos />

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
              1 BRO = US$ 1 = R$ {usdBrlQuote.olefootVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
