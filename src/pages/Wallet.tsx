import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownLeft,
  History,

  Users,
  Gem,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { formatBroDisplay } from '@/systems/economy';
import { olexpSummary } from '@/wallet/olexp';
import { referralSummary } from '@/wallet/referral';
import { gatSummary } from '@/wallet/gat';
import { recentLedger } from '@/wallet/ledger';
import { createInitialWalletState } from '@/wallet/initial';
import type { WalletLedgerEntry } from '@/wallet/types';
import { WalletShell } from './wallet/WalletShell';
import { DepositModal } from './wallet/DepositModal';
import { SendModal } from './wallet/SendModal';
import { useOlefootUsdBrlQuote } from '@/wallet/useOlefootUsdBrlQuote';
import { useTrackScreen } from '@/progression/trackEvent';

function fmtBroCents(cents: number): string {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? '-' : '+';
  return `${sign}${(abs / 100).toFixed(2)} BRO`;
}

function fmtLedgerAmount(entry: WalletLedgerEntry): string {
  if (entry.currency === 'EXP') {
    const sign = entry.amount < 0 ? '-' : '+';
    return `${sign}${Math.abs(entry.amount).toLocaleString('pt-BR')} EXP`;
  }
  return fmtBroCents(entry.amount);
}

function ledgerBadgeColor(type: string): string {
  if (type.startsWith('OLEXP') || type.startsWith('SWAP')) return 'bg-purple-500/20 text-purple-300';
  if (type === 'REFERRAL_GAT_EXP') return 'bg-violet-500/20 text-violet-200';
  if (type.startsWith('REFERRAL')) return 'bg-blue-500/20 text-blue-300';
  if (type.startsWith('GAT')) return 'bg-amber-500/20 text-amber-300';
  if (type === 'MATCH_REWARD') return 'bg-green-500/20 text-green-300';
  if (type === 'PURCHASE') return 'bg-red-500/20 text-red-300';
  return 'bg-white/10 text-gray-300';
}

function formatLedgerDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return iso.slice(0, 10);
  }
}

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
  const recent: WalletLedgerEntry[] = recentLedger(wallet, 5);
  const refValueBro = ((ref.oleGameTotal + ref.nftTotal) / 100).toFixed(2);
  const refValue =
    ref.gatExpTotal > 0
      ? `+${refValueBro} BRO · +${ref.gatExpTotal.toLocaleString('pt-BR')} EXP GAT`
      : `+${refValueBro} BRO`;

  const heroStats = [
    { label: 'Saldo BRO', value: bro.primary, highlight: true },
    { label: 'Em OLEXP', value: `${(olexp.totalPrincipal / 100).toFixed(2)}`, highlight: false },
    { label: 'GAT EXP', value: `${gat.totalAccrued.toLocaleString('pt-BR')}`, highlight: false },
    { label: 'Indicações', value: `${ref.directReferrals}`, highlight: false },
  ];

  const actions = [
    {
      key: 'deposit',
      label: 'Depositar',
      sub: 'Adicionar BRO',
      icon: ArrowDownLeft,
      onClick: () => setDepositOpen(true),
      className: 'hover:border-neon-green/40 hover:bg-neon-green/5',
    },
    {
      key: 'withdraw',
      label: 'Sacar',
      sub: 'Enviar BRL',
      icon: ArrowUpRight,
      onClick: () => setSendOpen(true),
      className: 'hover:border-red-400/40 hover:bg-red-500/5',
    },
    {
      key: 'gat',
      label: 'GAT',
      sub: `${gat.activeCount} posição(ões)`,
      icon: Gem,
      onClick: () => navigate('/wallet/gat'),
      className: 'hover:border-amber-400/40 hover:bg-amber-500/5',
    },
    {
      key: 'extract',
      label: 'Extrato',
      sub: 'Movimentos',
      icon: FileText,
      onClick: () => navigate('/wallet/extract'),
      className: 'hover:border-cyan-400/30 hover:bg-cyan-500/5',
    },
  ];

  const secondaryModules = [
    {
      label: 'Indicações',
      sub: `${ref.directReferrals} direto(s)`,
      value: refValue,
      icon: Users,
      href: '/wallet/referrals',
      border: 'border-blue-400/25',
      color: 'text-blue-300',
    },
    {
      label: 'GAT',
      sub: `${gat.activeCount} posição(ões)`,
      value: `+${gat.totalAccrued.toLocaleString('pt-BR')} EXP`,
      icon: Gem,
      href: '/wallet/gat',
      border: 'border-amber-400/25',
      color: 'text-amber-300',
    },
  ];

  return (
    <WalletShell
      account="spot"
      title="Conta SPOT"
      subtitle="Saldo BRO disponível para compras, transferências e hold OLEXP. Depósitos e saques simulados no MVP."
      heroStats={heroStats}
    >
      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} quote={usdBrlQuote} />
      <SendModal open={sendOpen} onClose={() => setSendOpen(false)} />

      {/* Grelha 2×2 de ações principais — botões emocionantes BVB style */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {actions.map((a) => (
          <motion.button
            key={a.key}
            type="button"
            onClick={a.onClick}
            whileTap={reducedMotion ? undefined : { scale: 0.98 }}
            className={`group relative overflow-hidden bg-black border-2 border-white/10 p-5 sm:p-6 text-left transition-all hover:border-neon-yellow/60 ${a.className}`}
          >
            {/* Diagonal accent */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-neon-yellow/5 transform rotate-12 translate-x-8 -translate-y-8 group-hover:bg-neon-yellow/10 transition-colors" aria-hidden />

            <div className="relative z-10">
              <a.icon className="w-6 h-6 sm:w-7 sm:h-7 text-neon-yellow mb-4" strokeWidth={2.5} />
              <div className="font-display font-black text-base sm:text-lg uppercase tracking-wide text-white mb-1">
                {a.label}
              </div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wider">{a.sub}</div>

              {a.key === 'deposit' && usdBrlQuote.status === 'ok' ? (
                <div className="mt-3 border border-neon-green/20 bg-neon-green/5 px-2.5 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-neon-green/90">Nossa cotação</p>
                  <p className="text-[11px] font-display font-bold tabular-nums text-white mt-0.5">
                    1 USD ≈ R${' '}
                    {usdBrlQuote.olefootVenda.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })}
                  </p>
                  <p className="text-[8px] leading-tight text-gray-600 mt-0.5">API + 5% operacional</p>
                </div>
              ) : null}
            </div>
          </motion.button>
        ))}
      </div>
    </WalletShell>
  );
}
