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
    >
      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} quote={usdBrlQuote} />
      <SendModal open={sendOpen} onClose={() => setSendOpen(false)} />

      {/* Cartão principal glass — mesmo design da OLEXP */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative min-w-0 w-full overflow-x-hidden overflow-y-visible rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl md:p-8"
      >
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-neon-yellow/10 blur-3xl"
          aria-hidden
        />
        <div className="relative space-y-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-display font-bold mb-1">
              Saldo BRO
            </p>
            <p className="text-3xl md:text-4xl font-display font-black text-white tracking-tight">{bro.primary}</p>
            <p className="text-[10px] text-gray-500 mt-2 max-w-sm leading-relaxed">{bro.footnote}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => navigate('/wallet/gat')}
              className="rounded-2xl bg-black/30 border border-amber-400/15 hover:border-amber-400/30 px-4 py-3 text-left transition-colors group"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <Gem className="w-4 h-4 text-amber-400" />
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Game Assets Treasury</p>
              </div>
              <p className="text-xl font-display font-bold text-amber-300">
                +{gat.totalAccrued.toLocaleString('pt-BR')} EXP
              </p>
              <p className="text-[10px] text-gray-600 mt-1">
                {gat.activeCount} posição(ões) ativa(s) — EXP acumulado (treasury)
              </p>
            </button>
            <div className="rounded-2xl bg-black/30 border border-white/5 px-4 py-3 flex flex-col justify-center">
              <p className="text-[10px] text-gray-500 leading-relaxed">
                BRO em OLEXP hold: <span className="text-white font-bold">{(olexp.totalPrincipal / 100).toFixed(2)} BRO</span>.{' '}
                Yield acumulado: <span className="text-neon-green font-bold">+{(olexp.totalYieldAccrued / 100).toFixed(2)}</span>.{' '}
                Usa <span className="text-neon-yellow">SWAP</span> para mover entre contas.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Grelha 2×2 de ações — mesmas classes da OLEXP */}
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <motion.button
            key={a.key}
            type="button"
            onClick={a.onClick}
            whileTap={reducedMotion ? undefined : { scale: 0.98 }}
            className={`rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-4 text-left transition-colors ${a.className}`}
          >
            <a.icon className="w-5 h-5 text-neon-yellow mb-3" />
            <div className="font-display font-bold text-sm text-white tracking-wide">{a.label}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{a.sub}</div>
            {a.key === 'deposit' && usdBrlQuote.status === 'ok' ? (
              <div className="mt-2 rounded-lg border border-neon-green/20 bg-neon-green/5 px-2 py-1.5">
                <p className="text-[9px] font-bold uppercase tracking-wide text-neon-green/90">Nossa cotação</p>
                <p className="text-[11px] font-display font-bold tabular-nums text-white">
                  1 USD ≈ R${' '}
                  {usdBrlQuote.olefootVenda.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}
                </p>
                <p className="text-[8px] leading-tight text-gray-600">API + 5% operacional</p>
              </div>
            ) : null}
            {a.key === 'deposit' && usdBrlQuote.status === 'loading' ? (
              <p className="text-[9px] text-gray-600 mt-2">A carregar cotação…</p>
            ) : null}
            {a.key === 'deposit' && usdBrlQuote.status === 'error' ? (
              <p className="text-[9px] text-amber-500/90 mt-2 leading-tight">Cotação indisponível — vê no modal</p>
            ) : null}
          </motion.button>
        ))}
      </div>

      {/* Outros produtos — espelho da OLEXP */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-display font-bold mb-3">Outros produtos</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {secondaryModules.map((c) => (
            <Link
              key={c.label}
              to={c.href}
              className={`group rounded-2xl border ${c.border} bg-white/[0.03] backdrop-blur-sm p-4 hover:bg-white/[0.06] transition-colors`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <c.icon className={`w-4 h-4 ${c.color}`} />
                  <span className="font-display font-bold text-xs text-white">{c.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
              </div>
              <div className={`text-lg font-bold ${c.color} truncate`}>{c.value}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{c.sub}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Extrato recente — mesmo layout glass da OLEXP */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 md:p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-sm uppercase tracking-wider flex items-center gap-2 text-white">
            <History className="w-4 h-4 text-gray-400" />
            Extrato recente
          </h3>
          <button
            type="button"
            onClick={() => navigate('/wallet/extract')}
            className="text-[10px] font-display font-bold uppercase tracking-wider text-neon-yellow hover:underline"
          >
            Ver tudo
          </button>
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma transação registrada.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((entry) => (
              <div
                key={entry.id}
                className="flex justify-between items-center p-3 rounded-xl bg-black/25 border border-white/5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded shrink-0 ${ledgerBadgeColor(entry.type)}`}
                  >
                    {entry.type}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-white truncate">{entry.source}</div>
                    <div className="text-[10px] text-gray-500">{formatLedgerDate(entry.createdAt)}</div>
                  </div>
                </div>
                <div
                  className={`font-bold text-sm shrink-0 ${entry.amount >= 0 ? 'text-neon-green' : 'text-red-400'}`}
                >
                  {fmtLedgerAmount(entry)}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </WalletShell>
  );
}
