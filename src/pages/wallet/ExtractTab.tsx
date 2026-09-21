import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, FileText, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';

import { queryLedger } from '@/wallet/ledger';
import { createInitialWalletState } from '@/wallet/initial';
import type { WalletLedgerType, WalletCurrencyExt, WalletLedgerEntry } from '@/wallet/types';
import { MOEDA_JOGO } from '@/wallet/constants';

const LEDGER_TYPE_OPTIONS: { value: WalletLedgerType | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'SPOT_EXP', label: 'SPOT EXP' },
  { value: 'SPOT_BRO', label: 'SPOT BRO' },
  { value: 'REFERRAL_OLE_GAME', label: 'Referral OLE' },
  { value: 'REFERRAL_NFT', label: 'Referral NFT' },
  { value: 'MATCH_REWARD', label: 'Match Reward' },
  { value: 'PURCHASE', label: 'Compra' },
  { value: 'TRANSFER', label: 'Transferência' },
  { value: 'STRUCTURE_UPGRADE', label: 'Estrutura' },
];

const CURRENCY_OPTIONS: { value: WalletCurrencyExt | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'BRO', label: 'BRO' },
  { value: 'EXP', label: 'EXP' },
  { value: 'OLEFOOT', label: MOEDA_JOGO },
];

/**
 * Chip do tipo de lançamento — NEUTRO de propósito.
 *
 * Antes cada tipo tinha sua cor (referral azul, partida verde, compra vermelha,
 * transferência ciano). Só que quem lê um extrato quer saber se o dinheiro
 * ENTROU ou SAIU — e isso o valor já diz, em verde ou vermelho, logo ao lado.
 * O chip colorido repetia a informação num vocabulário diferente e disputava a
 * atenção com o número, que é o que importa.
 */
function badgeColor(_type: WalletLedgerType): string {
  return 'bg-white/8 text-white/65 border-white/10';
}

function statusDot(status: string): string {
  if (status === 'confirmed') return 'bg-alta';
  if (status === 'pending') return 'bg-atencao';
  return 'bg-baixa';
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
    <div className="mx-auto min-w-0 max-w-3xl space-y-6 pb-8">
      <button
        type="button"
        onClick={() => navigate('/wallet')}
        className="flex items-center gap-2 text-sm text-cimento hover:text-white transition-colors mb-2"
      >
        <ArrowLeft className="w-4 h-4" /> Carteira
      </button>

      <div className="flex items-center gap-3 mb-2">
        <FileText className="w-6 h-6 text-white" />
        <h2 className="font-impact text-2xl uppercase leading-[1.1] text-white">Extrato Completo</h2>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel border border-white/10 bg-panel p-4 flex flex-wrap gap-3 items-center"
      >
        <Filter className="w-4 h-4 text-cimento" />
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
        <span className="ml-auto font-mono text-[11px] text-cimento">{sorted.length} registros</span>
      </motion.div>

      {/* Entries */}
      {sorted.length === 0 ? (
        <div className="text-center py-12 text-cimento text-sm">
          Nenhuma transação encontrada.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between border border-white/10 bg-panel p-4 hover:border-white/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot(entry.status)}`} />
                <span
                  className={`font-mono text-[10px] font-medium px-2 py-0.5 border shrink-0 ${badgeColor(entry.type)}`}
                >
                  {entry.type}
                </span>
                <div className="min-w-0">
                  <div className="text-sm text-giz truncate">{entry.source}</div>
                  <div className="font-mono text-[10.5px] text-poeira">
                    {formatLedgerDate(entry.createdAt)} · {entry.currency}
                  </div>
                </div>
              </div>
              <div
                className={`font-mono font-medium text-sm tabular-nums shrink-0 ml-4 ${
                  entry.amount >= 0 ? 'text-alta' : 'text-baixa'
                }`}
              >
                {entry.currency === 'EXP'
                  ? `${entry.amount < 0 ? '-' : '+'}${Math.abs(entry.amount).toLocaleString('pt-BR')}`
                  : `${entry.amount >= 0 ? '+' : ''}${(entry.amount / 100).toFixed(2)}`}
                <span className="text-[10px] font-normal text-poeira ml-1">
                  {entry.currency === 'BRO' ? 'USDT' : entry.currency}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
