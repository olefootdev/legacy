import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { formatBroDisplay } from '@/systems/economy';
import { olexpSummary } from '@/wallet/olexp';
import { referralSummary } from '@/wallet/referral';
import { gatSummary } from '@/wallet/gat';
import { createInitialWalletState } from '@/wallet/initial';
import { WalletShell } from './wallet/WalletShell';
import { DepositModal } from './wallet/DepositModal';
import { SendModal } from './wallet/SendModal';
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

export function Wallet() {
  useTrackScreen('screen_wallet');
  const navigate = useNavigate();
  const finance = useGameStore((s) => s.finance);
  const wallet = finance.wallet ?? createInitialWalletState();
  const reducedMotion = usePrefersReducedMotion();
  const [depositOpen, setDepositOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const usdBrlQuote = useOlefootUsdBrlQuote(true);

  const bro = formatBroDisplay(finance.broCents);
  const olexp = olexpSummary({ ...wallet, spotBroCents: finance.broCents });
  const ref = referralSummary(wallet);
  const gat = gatSummary(wallet);

  const heroStats = [
    { label: 'Saldo BRO', value: bro.primary, highlight: true },
    { label: 'Em OLEXP', value: `${(olexp.totalPrincipal / 100).toFixed(2)}`, highlight: false },
    { label: 'GAT EXP', value: `${gat.totalAccrued.toLocaleString('pt-BR')}`, highlight: false },
    { label: 'Indicações', value: `${ref.directReferrals}`, highlight: false },
  ];

  const actions: Array<{
    key: string;
    label: string;
    sub: string;
    onClick: () => void;
    /** Sprint B Legacy Tech: trilho lateral colorido em vez de icone solto. */
    rail: string;
    showQuote?: boolean;
  }> = [
    {
      key: 'deposit',
      label: 'Depositar',
      sub: 'Adicionar BRO à carteira',
      onClick: () => setDepositOpen(true),
      rail: 'bg-neon-green',
      showQuote: true,
    },
    {
      key: 'withdraw',
      label: 'Sacar',
      sub: 'Enviar BRL pra conta bancária',
      onClick: () => setSendOpen(true),
      rail: 'bg-red-400',
    },
    {
      key: 'gat',
      label: 'GAT',
      sub: `${gat.activeCount} posição(ões) ativas`,
      onClick: () => navigate('/wallet/gat'),
      rail: 'bg-amber-400',
    },
    {
      key: 'extract',
      label: 'Extrato',
      sub: 'Histórico completo de movimentos',
      onClick: () => navigate('/wallet/extract'),
      rail: 'bg-cyan-400',
    },
  ];

  // (secondaryModules e recent ledger removidos: dead code antes do Sprint B)

  return (
    <WalletShell
      account="spot"
      title="Conta SPOT"
      subtitle="Saldo BRO disponível para compras, transferências e hold OLEXP. Depósitos e saques simulados no MVP."
      heroStats={heroStats}
    >
      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} quote={usdBrlQuote} />
      <SendModal open={sendOpen} onClose={() => setSendOpen(false)} />

      {/* Ações principais — Sprint B Legacy Tech: rail colorido + título grande + texto-claro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {actions.map((a) => (
          <motion.button
            key={a.key}
            type="button"
            onClick={a.onClick}
            whileTap={reducedMotion ? undefined : { scale: 0.98 }}
            className="group relative isolate flex h-full flex-col overflow-hidden border border-white/[0.05] text-left transition-all duration-300 hover:border-white/15 hover:-translate-y-0.5"
            style={{
              borderRadius: 'var(--radius-card)',
              background: 'var(--color-panel-elevated)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            {/* Trilho lateral — sem icone solto */}
            <span aria-hidden className={`absolute left-0 top-0 h-full w-[3px] ${a.rail}`} />

            <div className="relative flex h-full flex-col gap-3 p-5 pl-6 sm:p-6 sm:pl-7">
              <span
                className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80"
                style={{ fontFamily: 'var(--font-ui)' }}
              >
                Ação
              </span>
              <h3
                className="font-display text-[24px] font-black uppercase leading-[0.95] tracking-tight text-white transition-colors group-hover:text-neon-yellow"
                style={{ letterSpacing: '0.005em' }}
              >
                {a.label}
              </h3>
              <p className="text-[12px] leading-relaxed text-white/55">{a.sub}</p>

              {a.showQuote && usdBrlQuote.status === 'ok' ? (
                <div className="mt-auto rounded-[var(--radius-sm)] border border-neon-green/25 bg-neon-green/[0.06] px-3 py-2">
                  <p className="font-display text-[9px] font-bold uppercase tracking-[0.18em] text-neon-green/90">
                    Nossa cotação
                  </p>
                  <p
                    className="mt-1 tabular-nums text-white"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontStyle: 'italic',
                      fontSize: '18px',
                      lineHeight: 1,
                    }}
                  >
                    1 USD ≈ R${' '}
                    {usdBrlQuote.olefootVenda.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })}
                  </p>
                  <p className="mt-1 text-[9px] leading-tight text-white/35">API + 5% operacional</p>
                </div>
              ) : null}
            </div>
          </motion.button>
        ))}
      </div>
    </WalletShell>
  );
}
