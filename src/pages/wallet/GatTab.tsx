import { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Gem, Info, History, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';

import { gatSummary } from '@/wallet/gat';
import { GAT_CATEGORY_LABELS, GAT_DURATION_MONTHS } from '@/wallet/constants';
import { queryLedger } from '@/wallet/ledger';
import { createInitialWalletState } from '@/wallet/initial';
import type { GatPosition } from '@/wallet/types';
import { WalletShell } from './WalletShell';
import { formatBroDisplay } from '@/systems/economy';
import { olexpSummary } from '@/wallet/olexp';
import { referralSummary } from '@/wallet/referral';

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
  const olexp = olexpSummary({ ...wallet, spotBroCents: finance.broCents });
  const ref = referralSummary(wallet);

  const sortedPositions = useMemo(() => {
    return [...wallet.gatPositions].sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  }, [wallet.gatPositions]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const rewardPrimary = `+${summary.totalAccrued.toLocaleString('pt-BR')} EXP`;

  const programFootnote = `Recompensa diária em EXP (dias corridos) sobre a base em BRO, por faixa; +1% da base em EXP por nível de referral (até 3). Duração ${GAT_DURATION_MONTHS} meses por posição. Não é saldo em custódia.`;

  const heroStats = [
    { label: 'Saldo BRO', value: formatBroDisplay(finance.broCents).primary, highlight: true },
    { label: 'Em OLEXP', value: `${(olexp.totalPrincipal / 100).toFixed(2)}`, highlight: false },
    { label: 'GAT EXP', value: `${summary.totalAccrued.toLocaleString('pt-BR')}`, highlight: false },
    { label: 'Indicações', value: `${ref.directReferrals}`, highlight: false },
  ];

  return (
    <WalletShell
      account="gat"
      title="Game Assets Treasury"
      subtitle="Game Assets Treasury (GAT) é o motor de crescimento em EXP dentro da OLEFOOT. Ao alocar teus ativos em BRO, você ativa uma taxa diária progressiva conforme a faixa: de 1 a 100 BRO rende 1,5% ao dia, de 101 a 300 rende 2,5%, de 301 a 999 rende 3,5% e acima de 1000 BRO atinge 5,5% ao dia, tudo convertido automaticamente em EXP. Além disso, o sistema de referral GAT distribui 1% por nível, até três níveis, também em EXP."
      heroStats={heroStats}
    >
      {/* Box principal EXP — identidade BVB com diagonal accent */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="group relative overflow-hidden bg-black border-2 border-amber-400/30 p-6 md:p-8"
      >
        {/* Diagonal accent amarelo */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 transform rotate-12 translate-x-12 -translate-y-12 group-hover:bg-amber-400/15 transition-colors" aria-hidden />

        <div className="relative z-10 space-y-6">
          <div>
            <p className="mb-1 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
              EXP (rewards GAT acumulados)
            </p>
            <p className="font-display text-3xl font-black tracking-tight text-amber-100 md:text-4xl">{rewardPrimary}</p>
            <p className="mt-2 max-w-sm text-[10px] leading-relaxed text-gray-500">{programFootnote}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 border-t-2 border-white/10 pt-4 sm:grid-cols-2">
            <div className="bg-black/40 border-2 border-white/10 px-4 py-3">
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
            <div className="flex flex-col justify-center bg-black/40 border-2 border-white/10 px-4 py-3">
              <p className="text-[10px] leading-relaxed text-gray-500">
                <span className="font-bold text-white">{summary.positionCount}</span> posição(ões) ·{' '}
                <span className="font-bold text-emerald-300/90">{summary.activeCount}</span> ativa(s). Compras elegíveis
                (ex.: upgrades, packs em BRO) criam entradas aqui.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Grelha 2x2 de ações principais — padrão BVB SPOT */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <motion.button
          type="button"
          onClick={() => {
            const el = document.getElementById('gat-positions');
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          whileTap={reducedMotion ? undefined : { scale: 0.98 }}
          className="group relative overflow-hidden bg-black border-2 border-white/10 p-5 sm:p-6 text-left transition-all hover:border-neon-yellow/60 hover:border-amber-400/40 hover:bg-amber-500/5"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-neon-yellow/5 transform rotate-12 translate-x-8 -translate-y-8 group-hover:bg-neon-yellow/10 transition-colors" aria-hidden />
          <div className="relative z-10">
            <Gem className="w-6 h-6 sm:w-7 sm:h-7 text-neon-yellow mb-4" strokeWidth={2.5} />
            <div className="font-display font-black text-base sm:text-lg uppercase tracking-wide text-white mb-1">
              Posições
            </div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wider">{summary.activeCount} ativa(s)</div>
          </div>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => {
            const el = document.getElementById('gat-history');
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          whileTap={reducedMotion ? undefined : { scale: 0.98 }}
          className="group relative overflow-hidden bg-black border-2 border-white/10 p-5 sm:p-6 text-left transition-all hover:border-neon-yellow/60 hover:border-cyan-400/30 hover:bg-cyan-500/5"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-neon-yellow/5 transform rotate-12 translate-x-8 -translate-y-8 group-hover:bg-neon-yellow/10 transition-colors" aria-hidden />
          <div className="relative z-10">
            <History className="w-6 h-6 sm:w-7 sm:h-7 text-neon-yellow mb-4" strokeWidth={2.5} />
            <div className="font-display font-black text-base sm:text-lg uppercase tracking-wide text-white mb-1">
              Histórico
            </div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wider">Rewards GAT</div>
          </div>
        </motion.button>
      </div>

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
    </WalletShell>
  );
}
