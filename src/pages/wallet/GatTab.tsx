import { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Gem, Info, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';

import { gatSummary } from '@/wallet/gat';
import { GAT_CATEGORY_LABELS, GAT_DURATION_MONTHS, GAT_TIER_SUMMARY_PT } from '@/wallet/constants';
import { queryLedger } from '@/wallet/ledger';
import { createInitialWalletState } from '@/wallet/initial';
import type { GatPosition } from '@/wallet/types';
import { WalletShell } from './WalletShell';

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

function fmtExp(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '+';
  return `${sign}${abs.toLocaleString('pt-BR')} EXP`;
}

function fmtBroCents(cents: number): string {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? '-' : '+';
  return `${sign}${(abs / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BRO`;
}

function ledgerBadgeColor(type: string): string {
  if (type.startsWith('GAT')) return 'bg-amber-500/20 text-amber-300';
  if (type === 'REFERRAL_GAT_EXP') return 'bg-violet-500/20 text-violet-200';
  return 'bg-white/10 text-gray-300';
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

export function GatTab() {
  const navigate = useNavigate();
  const finance = useGameStore((s) => s.finance);
  const wallet = finance.wallet ?? createInitialWalletState();
  const reducedMotion = usePrefersReducedMotion();

  const summary = gatSummary(wallet);
  const rewardEntries = queryLedger(wallet, { type: 'GAT_REWARD' });

  const sortedPositions = useMemo(() => {
    return [...wallet.gatPositions].sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  }, [wallet.gatPositions]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const rewardPrimary = `+${summary.totalAccrued.toLocaleString('pt-BR')} EXP`;

  const programFootnote = `Recompensa diária em EXP (dias corridos) sobre a base em BRO, por faixa; +1% da base em EXP por nível de referral (até 3). Duração ${GAT_DURATION_MONTHS} meses por posição. Não é saldo em custódia.`;

  return (
    <WalletShell
      account="gat"
      title="Game Assets Treasury"
      subtitle={`Treasury em EXP: taxa diária por faixa sobre a base em BRO + referral GAT 1%/nível (EXP). ${GAT_TIER_SUMMARY_PT} Crédito automático no teu saldo EXP.`}
    >
      {/* Mesmo design system da Conta OLEXP — cartão principal glass */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl md:p-8"
      >
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl"
          aria-hidden
        />
        <div className="relative space-y-6">
          <div>
            <p className="mb-1 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
              EXP (rewards GAT acumulados)
            </p>
            <p className="font-display text-3xl font-black tracking-tight text-amber-100 md:text-4xl">{rewardPrimary}</p>
            <p className="mt-2 max-w-sm text-[10px] leading-relaxed text-gray-500">{programFootnote}</p>
            <p className="mt-2 max-w-lg text-[10px] leading-relaxed text-gray-600">{GAT_TIER_SUMMARY_PT}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 border-t border-white/10 pt-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-black/30 px-4 py-3">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Base elegível</p>
              <p className="font-display text-xl font-bold text-white">
                {(summary.totalBase / 100).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                BRO
              </p>
              <p className="mt-1 text-[10px] text-gray-600">Soma do BRO que gerou posições GAT</p>
            </div>
            <div className="flex flex-col justify-center rounded-2xl border border-white/5 bg-black/30 px-4 py-3">
              <p className="text-[10px] leading-relaxed text-gray-500">
                <span className="font-bold text-white">{summary.positionCount}</span> posição(ões) ·{' '}
                <span className="font-bold text-emerald-300/90">{summary.activeCount}</span> ativa(s). Compras elegíveis
                (ex.: upgrades, packs em BRO) criam entradas aqui.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Aviso — peso visual alinhado ao bloco KYC / glass OLEXP */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-amber-400/30 bg-white/[0.03] p-5 backdrop-blur-md md:p-6"
      >
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-100/85">
            Os valores exibidos são <span className="text-white">rewards calculados</span> sobre compras elegíveis. Isto{' '}
            <strong className="text-white">não é um saldo em custódia</strong> — o GAT é um programa de recompensa
            sobre gastos no ecossistema.
          </p>
        </div>
      </motion.div>

      {/* Ativos — mesmo ritmo que “Posições” OLEXP */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Gem className="h-4 w-4 text-amber-400" />
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-gray-400">Ativos que rendem</h3>
        </div>
        <p className="-mt-1 text-xs text-gray-500">
          Custo em BRO que gerou base elegível e EXP acumulado até agora (creditado automaticamente ao saldo EXP).
        </p>
        {sortedPositions.length === 0 ? (
          <p className="text-sm text-gray-500">
            Ainda não há posições GAT. Compras elegíveis em BRO passam a aparecer aqui com custo e rendimento.
          </p>
        ) : (
          <div className="space-y-3">
            {sortedPositions.map((pos) => {
              const active = todayStr < pos.endDate;
              return (
                <motion.div
                  key={pos.id}
                  initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-white">{positionTitle(pos)}</div>
                      <div className="mt-0.5 text-[10px] text-amber-200/70">
                        {GAT_CATEGORY_LABELS[pos.sourceCategory]}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${
                        active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-gray-400'
                      }`}
                    >
                      {active ? 'Ativo' : 'Período encerrado'}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        Investiu (base)
                      </div>
                      <div className="font-bold text-white">
                        {(pos.baseEligibleCents / 100).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        BRO
                      </div>
                    </div>
                    <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3">
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-200/80">
                        Rendeu (EXP)
                      </div>
                      <div className="font-bold text-amber-200">
                        +{pos.accruedCents.toLocaleString('pt-BR')} EXP
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
                    <span>
                      Taxa EXP: {(pos.dailyRate * 100).toFixed(2)}% / dia (base {(pos.baseEligibleCents / 100).toFixed(0)}{' '}
                      BRO)
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

      {/* Extrato recente — espelho do bloco OLEXP */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md md:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-white">
            <History className="h-4 w-4 text-gray-400" />
            Histórico de rewards
          </h3>
          <button
            type="button"
            onClick={() => navigate('/wallet/extract')}
            className="font-display text-[10px] font-bold uppercase tracking-wider text-neon-yellow hover:underline"
          >
            Ver extrato
          </button>
        </div>
        {rewardEntries.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum reward GAT registrado.</p>
        ) : (
          <div className="space-y-2">
            {rewardEntries
              .slice(-15)
              .reverse()
              .map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-black/25 p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-[9px] font-bold ${ledgerBadgeColor(e.type)}`}
                    >
                      {e.type}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">{e.source}</div>
                      <div className="text-[10px] text-gray-500">{formatLedgerDate(e.createdAt)}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-bold text-neon-green">
                    {e.currency === 'EXP' ? fmtExp(e.amount) : fmtBroCents(e.amount)}
                  </div>
                </div>
              ))}
          </div>
        )}
      </motion.div>
    </WalletShell>
  );
}
