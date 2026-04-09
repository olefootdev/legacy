import { motion } from 'motion/react';
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  TrendingUp,
  Users,
  Gem,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { NavBalanceStrip } from '@/components/NavBalanceStrip';
import { formatBroDisplay } from '@/systems/economy';
import { olexpSummary } from '@/wallet/olexp';
import { referralSummary } from '@/wallet/referral';
import { gatSummary } from '@/wallet/gat';
import { recentLedger } from '@/wallet/ledger';
import { createInitialWalletState } from '@/wallet/initial';
import type { WalletLedgerEntry } from '@/wallet/types';

function fmtBroCents(cents: number): string {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? '-' : '+';
  return `${sign}${(abs / 100).toFixed(2)} BRO`;
}

function ledgerBadgeColor(type: string): string {
  if (type.startsWith('OLEXP')) return 'bg-purple-500/20 text-purple-300';
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

export function Wallet() {
  const navigate = useNavigate();
  const finance = useGameStore((s) => s.finance);
  const wallet = finance.wallet ?? createInitialWalletState();

  const bro = formatBroDisplay(finance.broCents);

  const olexp = olexpSummary({ ...wallet, spotBroCents: finance.broCents });
  const ref = referralSummary(wallet);
  const gat = gatSummary(wallet);
  const recent: WalletLedgerEntry[] = recentLedger(wallet, 5);

  const cards = [
    {
      label: 'OLEXP',
      sublabel: `${olexp.activeCount} ativa(s)`,
      value: `${(olexp.totalPrincipal / 100).toFixed(2)} BRO`,
      secondaryValue: `Yield: +${(olexp.totalYieldAccrued / 100).toFixed(2)}`,
      icon: TrendingUp,
      color: 'text-purple-400',
      border: 'border-purple-400/30',
      href: '/wallet/olexp',
    },
    {
      label: 'Indicações',
      sublabel: `${ref.directReferrals} direto(s)`,
      value: `+${((ref.oleGameTotal + ref.nftTotal) / 100).toFixed(2)} BRO`,
      secondaryValue: `OLE: ${ref.oleGameCount} | NFT: ${ref.nftCount}`,
      icon: Users,
      color: 'text-blue-400',
      border: 'border-blue-400/30',
      href: '/wallet/referrals',
    },
    {
      label: 'GAT',
      sublabel: `${gat.activeCount} posição(ões)`,
      value: `+${(gat.totalAccrued / 100).toFixed(2)} BRO`,
      secondaryValue: `Base: ${(gat.totalBase / 100).toFixed(2)}`,
      icon: Gem,
      color: 'text-amber-400',
      border: 'border-amber-400/30',
      href: '/wallet/gat',
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-8">
      <h2 className="text-2xl font-bold neon-text mb-6">Carteira</h2>

      <NavBalanceStrip />

      {/* SPOT balances */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-6 bg-gradient-to-br from-dark-gray to-deep-black border-neon-yellow/20"
      >
        <div className="flex items-center gap-2 text-gray-400 mb-2">
          <WalletIcon className="w-5 h-5" />
          <span>Saldo BRO (valor na plataforma)</span>
        </div>
        <div className="text-2xl font-bold text-white mb-1">{bro.primary}</div>
        <p className="text-[10px] text-gray-500 mb-4 leading-snug">{bro.footnote}</p>

        <button
          type="button"
          onClick={() => navigate('/wallet/gat')}
          className="w-full flex items-center justify-between gap-3 rounded-xl border border-amber-400/25 bg-amber-500/5 hover:bg-amber-500/10 px-4 py-3 text-left transition-colors mb-4"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Gem className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate">Game Assets Treasury</div>
              <div className="text-[10px] text-gray-500">
                Ver ativos que rendem (custo vs reward acumulado)
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
        </button>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            className="bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowDownLeft className="w-4 h-4 text-neon-green" />
            Depositar
          </button>
          <button
            type="button"
            className="bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowUpRight className="w-4 h-4 text-red-500" />
            Sacar
          </button>
        </div>

      </motion.div>

      {/* Module cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <motion.button
            key={c.label}
            type="button"
            onClick={() => navigate(c.href)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
            className={`glass-panel p-5 text-left border ${c.border} hover:bg-white/5 transition-colors group`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <c.icon className={`w-5 h-5 ${c.color}`} />
                <span className="font-bold text-sm">{c.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
            </div>
            <div className="text-xl font-bold text-white">{c.value}</div>
            <div className="text-xs text-gray-400 mt-1">{c.secondaryValue}</div>
            <div className="text-[10px] text-gray-500 mt-1">{c.sublabel}</div>
          </motion.button>
        ))}
      </div>

      {/* Recent ledger */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <History className="w-5 h-5" />
            Extrato Recente
          </h3>
          <button
            type="button"
            onClick={() => navigate('/wallet/extract')}
            className="text-xs text-neon-yellow hover:underline flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5" />
            Ver tudo
          </button>
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma transação registrada.</p>
        ) : (
          <div className="space-y-3">
            {recent.map((entry) => (
              <div
                key={entry.id}
                className="flex justify-between items-center p-3 rounded-lg bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${ledgerBadgeColor(entry.type)}`}
                  >
                    {entry.type}
                  </span>
                  <div>
                    <div className="font-medium text-sm">{entry.source}</div>
                    <div className="text-[10px] text-gray-500">{formatLedgerDate(entry.createdAt)}</div>
                  </div>
                </div>
                <div
                  className={`font-bold text-sm ${entry.amount >= 0 ? 'text-neon-green' : 'text-red-500'}`}
                >
                  {fmtBroCents(entry.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
