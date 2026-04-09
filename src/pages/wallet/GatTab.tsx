import { motion } from 'motion/react';
import { ArrowLeft, Gem, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useGameStore } from '@/game/store';
import { NavBalanceStrip } from '@/components/NavBalanceStrip';
import { gatSummary } from '@/wallet/gat';
import { GAT_CATEGORY_LABELS, GAT_DAILY_RATE, GAT_DURATION_MONTHS } from '@/wallet/constants';
import { queryLedger } from '@/wallet/ledger';
import { createInitialWalletState } from '@/wallet/initial';
import type { GatPosition } from '@/wallet/types';

function formatLedgerDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatShortDate(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function positionTitle(pos: GatPosition): string {
  return pos.assetLabel?.trim() || GAT_CATEGORY_LABELS[pos.sourceCategory];
}

export function GatTab() {
  const navigate = useNavigate();
  const finance = useGameStore((s) => s.finance);
  const wallet = finance.wallet ?? createInitialWalletState();

  const summary = gatSummary(wallet);
  const rewardEntries = queryLedger(wallet, { type: 'GAT_REWARD' });

  const sortedPositions = useMemo(() => {
    return [...wallet.gatPositions].sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  }, [wallet.gatPositions]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

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
        <Gem className="w-6 h-6 text-amber-400" />
        <h2 className="text-2xl font-bold text-white">Game Assets Treasury</h2>
      </div>
      <p className="text-sm text-gray-400">
        Reward diário de {(GAT_DAILY_RATE * 100).toFixed(3)}% sobre BRO gasto em categorias elegíveis, por {GAT_DURATION_MONTHS} meses.
      </p>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-400/20 rounded-xl p-4">
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-200/80">
          Os valores exibidos representam rewards calculados sobre compras realizadas. Este <b>não é um saldo em custódia</b>; o GAT é um programa de recompensa sobre gastos no ecossistema.
        </p>
      </div>

      {/* Summary */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-5 border border-amber-400/20"
      >
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-gray-400 mb-1">Base Elegível</div>
            <div className="text-lg font-bold text-white">{(summary.totalBase / 100).toFixed(2)}</div>
            <div className="text-[10px] text-gray-500">BRO</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Reward Acumulado</div>
            <div className="text-lg font-bold text-amber-300">+{(summary.totalAccrued / 100).toFixed(2)}</div>
            <div className="text-[10px] text-gray-500">BRO</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Posições</div>
            <div className="text-lg font-bold text-white">{summary.positionCount}</div>
            <div className="text-[10px] text-gray-500">{summary.activeCount} ativa(s)</div>
          </div>
        </div>
      </motion.div>

      {/* Per-asset yield */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm">Ativos que rendem</h3>
        <p className="text-xs text-gray-500 -mt-1">
          Custo em BRO que gerou base elegível e reward acumulado até agora (creditado ao SPOT conforme o accrual diário).
        </p>
        {sortedPositions.length === 0 ? (
          <p className="text-xs text-gray-500">
            Ainda não há posições GAT. Compras elegíveis em BRO (ex.: upgrade de estádio 3→5, pacote de EXP) passam a aparecer aqui com custo e rendimento.
          </p>
        ) : (
          <div className="space-y-3">
            {sortedPositions.map((pos) => {
              const active = todayStr < pos.endDate;
              return (
                <motion.div
                  key={pos.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-panel p-4 border border-white/10 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-white text-sm">{positionTitle(pos)}</div>
                      <div className="text-[10px] text-amber-200/70 mt-0.5">
                        {GAT_CATEGORY_LABELS[pos.sourceCategory]}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                        active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-gray-400'
                      }`}
                    >
                      {active ? 'Ativo' : 'Período encerrado'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Investiu (base)</div>
                      <div className="font-bold text-white">{(pos.baseEligibleCents / 100).toFixed(2)} BRO</div>
                    </div>
                    <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-400/15">
                      <div className="text-[10px] text-amber-200/70 uppercase tracking-wide mb-1">Rendeu</div>
                      <div className="font-bold text-amber-300">+{(pos.accruedCents / 100).toFixed(2)} BRO</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
                    <span>
                      Taxa: {(pos.dailyRate * 100).toFixed(3)}% / dia
                    </span>
                    <span>
                      {formatShortDate(pos.startDate)} — {formatShortDate(pos.endDate)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reward history */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm">Histórico de Rewards</h3>
        {rewardEntries.length === 0 ? (
          <p className="text-xs text-gray-500">Nenhum reward GAT registrado.</p>
        ) : (
          <div className="space-y-2">
            {rewardEntries.slice(-15).reverse().map((e) => (
              <div
                key={e.id}
                className="flex justify-between items-center p-3 rounded-lg bg-white/5 text-sm"
              >
                <div>
                  <div className="text-gray-300">{e.source}</div>
                  <div className="text-[10px] text-gray-500">{formatLedgerDate(e.createdAt)}</div>
                </div>
                <div className="font-bold text-amber-300">+{(e.amount / 100).toFixed(2)} BRO</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
