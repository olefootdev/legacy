import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, FileText, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { NavBalanceStrip } from '@/components/NavBalanceStrip';
import { queryLedger } from '@/wallet/ledger';
import { createInitialWalletState } from '@/wallet/initial';
import type { WalletLedgerType, WalletCurrencyExt, WalletLedgerEntry } from '@/wallet/types';

const LEDGER_TYPE_OPTIONS: { value: WalletLedgerType | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'SPOT_EXP', label: 'SPOT EXP' },
  { value: 'SPOT_BRO', label: 'SPOT BRO' },
  { value: 'OLEXP_PRINCIPAL', label: 'OLEXP Principal' },
  { value: 'OLEXP_YIELD', label: 'OLEXP Yield' },
  { value: 'SWAP_SPOT_TO_OLEXP', label: 'SWAP → OLEXP' },
  { value: 'SWAP_OLEXP_TO_SPOT', label: 'SWAP → SPOT' },
  { value: 'REFERRAL_OLE_GAME', label: 'Referral OLE' },
  { value: 'REFERRAL_NFT', label: 'Referral NFT' },
  { value: 'GAT_REWARD', label: 'GAT Reward' },
  { value: 'GAT_BASE_DEBIT', label: 'GAT Base' },
  { value: 'MATCH_REWARD', label: 'Match Reward' },
  { value: 'PURCHASE', label: 'Compra' },
  { value: 'TRANSFER', label: 'Transferência' },
  { value: 'STRUCTURE_UPGRADE', label: 'Estrutura' },
  { value: 'FIAT_DEPOSIT', label: 'Depósito (simulado)' },
  { value: 'FIAT_WITHDRAWAL', label: 'Saque (simulado)' },
];

const CURRENCY_OPTIONS: { value: WalletCurrencyExt | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'BRO', label: 'BRO' },
  { value: 'EXP', label: 'EXP' },
  { value: 'OLEXP', label: 'OLEXP' },
  { value: 'GAT', label: 'GAT' },
];

function badgeColor(type: WalletLedgerType): string {
  if (type.startsWith('SWAP')) return 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/30';
  if (type.startsWith('OLEXP')) return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
  if (type.startsWith('REFERRAL')) return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  if (type.startsWith('GAT')) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  if (type === 'MATCH_REWARD') return 'bg-green-500/20 text-green-300 border-green-500/30';
  if (type === 'PURCHASE' || type === 'STRUCTURE_UPGRADE') return 'bg-red-500/20 text-red-300 border-red-500/30';
  if (type === 'TRANSFER') return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
  if (type === 'FIAT_DEPOSIT') return 'bg-emerald-500/20 text-emerald-200 border-emerald-500/35';
  if (type === 'FIAT_WITHDRAWAL') return 'bg-rose-500/20 text-rose-200 border-rose-500/35';
  return 'bg-white/10 text-gray-300 border-white/10';
}

function statusDot(status: string): string {
  if (status === 'confirmed') return 'bg-neon-green';
  if (status === 'pending') return 'bg-yellow-400';
  return 'bg-red-400';
}

function formatLedgerDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return iso.slice(0, 10);
  }
}

export function ExtractTab() {
  const navigate = useNavigate();
  const finance = useGameStore((s) => s.finance);
  const wallet = finance.wallet ?? createInitialWalletState();

  const [filterType, setFilterType] = useState<WalletLedgerType | ''>('');
  const [filterCurrency, setFilterCurrency] = useState<WalletCurrencyExt | ''>('');

  const entries: WalletLedgerEntry[] = queryLedger(wallet, {
    ...(filterType ? { type: filterType } : {}),
    ...(filterCurrency ? { currency: filterCurrency } : {}),
  });

  const sorted = [...entries].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-8">
      <button
        type="button"
        onClick={() => navigate('/wallet')}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-2"
      >
        <ArrowLeft className="w-4 h-4" /> Carteira
      </button>

      <NavBalanceStrip />

      <div className="flex items-center gap-3 mb-2">
        <FileText className="w-6 h-6 text-white" />
        <h2 className="text-2xl font-bold text-white">Extrato Completo</h2>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-4 flex flex-wrap gap-3 items-center"
      >
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as WalletLedgerType | '')}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-yellow transition-colors appearance-none"
        >
          {LEDGER_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-black">
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={filterCurrency}
          onChange={(e) => setFilterCurrency(e.target.value as WalletCurrencyExt | '')}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-yellow transition-colors appearance-none"
        >
          {CURRENCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-black">
              {o.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500 ml-auto">{sorted.length} registros</span>
      </motion.div>

      {/* Entries */}
      {sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          Nenhuma transação encontrada.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/[0.07] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot(entry.status)}`} />
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${badgeColor(entry.type)}`}
                >
                  {entry.type}
                </span>
                <div className="min-w-0">
                  <div className="text-sm text-gray-300 truncate">{entry.source}</div>
                  <div className="text-[10px] text-gray-500">
                    {formatLedgerDate(entry.createdAt)} · {entry.currency}
                  </div>
                </div>
              </div>
              <div
                className={`font-bold text-sm shrink-0 ml-4 ${
                  entry.amount >= 0 ? 'text-neon-green' : 'text-red-500'
                }`}
              >
                {entry.amount >= 0 ? '+' : ''}{(entry.amount / 100).toFixed(2)}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
