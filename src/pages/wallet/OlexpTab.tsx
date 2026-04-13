import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  TrendingUp,
  Lock,
  CheckCircle,
  Clock,
  Gift,
  ArrowLeftRight,
  FileText,

  Users,
  Gem,
  ChevronRight,
  History,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatBroDisplay } from '@/systems/economy';
import { OLEXP_PLANS } from '@/wallet/constants';
import { estimateYield, olexpSummary } from '@/wallet/olexp';
import { referralSummary } from '@/wallet/referral';
import { gatSummary } from '@/wallet/gat';
import { createInitialWalletState } from '@/wallet/initial';
import type { OlexpPlanId, OlexpPosition } from '@/wallet/types';
import { WalletShell } from './WalletShell';
import { SwapModal } from './SwapModal';
import { recentOlexpLedger } from './olexpLedger';

function fmtBroCents(cents: number): string {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? '-' : '+';
  return `${sign}${(abs / 100).toFixed(2)} BRO`;
}

function ledgerBadgeColor(type: string): string {
  if (type.startsWith('OLEXP') || type.startsWith('SWAP')) return 'bg-purple-500/20 text-purple-300';
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

function daysRemaining(endDate: string): number {
  const now = new Date();
  const end = new Date(endDate);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function statusLabel(pos: OlexpPosition) {
  if (pos.status === 'claimed') return { text: 'Resgatado', color: 'text-gray-400' };
  if (pos.status === 'matured') return { text: 'Vencido — Resgatar', color: 'text-neon-green' };
  return { text: `${daysRemaining(pos.endDate)}d restantes`, color: 'text-purple-300' };
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

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function OlexpTab() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const finance = useGameStore((s) => s.finance);
  const wallet = finance.wallet ?? createInitialWalletState();
  const kycDone = wallet.kycOlexpDone;
  const reducedMotion = usePrefersReducedMotion();
  const [swapOpen, setSwapOpen] = useState(false);
  const holdFormRef = useRef<HTMLDivElement>(null);

  const [selectedPlan, setSelectedPlan] = useState<OlexpPlanId>('90d');
  const [amountInput, setAmountInput] = useState('');

  const plan = OLEXP_PLANS.find((p) => p.id === selectedPlan)!;
  const amountCents = Math.round((parseFloat(amountInput) || 0) * 100);
  const est = estimateYield(selectedPlan, amountCents);
  const bro = formatBroDisplay(finance.broCents);
  const canStake = kycDone && amountCents >= plan.minBroCents && amountCents <= finance.broCents;
  const summary = olexpSummary({ ...wallet, spotBroCents: finance.broCents });
  const recent = recentOlexpLedger(wallet.ledger, 5);
  const ref = referralSummary(wallet);
  const gat = gatSummary(wallet);

  const principalPrimary = `${(summary.totalPrincipal / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} BRO`;
  const yieldFootnote =
    'Yield creditado em dias úteis (seg–sex), sem capitalização sobre o principal em hold. Rendimentos passados não garantem resultados futuros.';

  const refValueBro = ((ref.oleGameTotal + ref.nftTotal) / 100).toFixed(2);
  const refValue =
    ref.gatExpTotal > 0
      ? `+${refValueBro} BRO · +${ref.gatExpTotal.toLocaleString('pt-BR')} EXP GAT`
      : `+${refValueBro} BRO`;

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

  const maturedCount = wallet.olexpPositions.filter((p) => p.status === 'matured').length;

  const actions = [
    {
      key: 'hold',
      label: 'Nova posição',
      sub: 'Hold OLEXP',
      icon: TrendingUp,
      onClick: () => {
        if (!kycDone) scrollToId('wallet-olexp-kyc');
        else holdFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      className: 'hover:border-neon-yellow/40 hover:bg-neon-yellow/5',
    },
    {
      key: 'swap',
      label: 'SWAP',
      sub: 'SPOT ↔ OLEXP',
      icon: ArrowLeftRight,
      onClick: () => setSwapOpen(true),
      className: 'hover:border-purple-400/40 hover:bg-purple-500/10',
    },
    {
      key: 'claim',
      label: 'Resgatar',
      sub: maturedCount > 0 ? `${maturedCount} vencida(s)` : 'Ver posições',
      icon: CheckCircle,
      onClick: () => scrollToId('wallet-olexp-positions'),
      className: 'hover:border-neon-green/35 hover:bg-neon-green/5',
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

  function handleStake() {
    if (!canStake) return;
    dispatch({ type: 'WALLET_CREATE_OLEXP', planId: selectedPlan, amountCents });
    setAmountInput('');
  }

  function handleClaim(positionId: string) {
    dispatch({ type: 'WALLET_CLAIM_OLEXP', positionId });
  }

  function handleKyc() {
    dispatch({ type: 'WALLET_COMPLETE_KYC' });
  }

  return (
    <WalletShell
      account="olexp"
      title="Conta OLEXP"
      subtitle="Saldo em hold com yield em dias úteis. O BRO em posição deixa o SPOT até resgate ou SWAP de volta; vê o SPOT disponível na Conta SPOT."
    >
      <SwapModal open={swapOpen} onClose={() => setSwapOpen(false)} defaultDirection="olexp_to_spot" />

      {/* Mesmo design system da Conta SPOT — cartão principal glass */}
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
              BRO (hold OLEXP)
            </p>
            <p className="text-3xl md:text-4xl font-display font-black text-white tracking-tight">{principalPrimary}</p>
            <p className="text-[10px] text-gray-500 mt-2 max-w-sm leading-relaxed">{yieldFootnote}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/10">
            <div className="rounded-2xl bg-black/30 border border-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-0.5">Yield acumulado</p>
              <p className="text-xl font-display font-bold text-neon-green">
                +{(summary.totalYieldAccrued / 100).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                BRO
              </p>
              <p className="text-[10px] text-gray-600 mt-1">Sobre posições ativas e encerradas</p>
            </div>
            <div className="rounded-2xl bg-black/30 border border-white/5 px-4 py-3 flex flex-col justify-center">
              <p className="text-[10px] text-gray-500 leading-relaxed">
                SPOT disponível para novo hold: <span className="text-white font-bold">{bro.primary}</span>.{' '}
                {summary.activeCount} posição(ões) ativa(s). Usa <span className="text-neon-yellow">SWAP</span> para
                devolver principal ativo ao SPOT antes do vencimento.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Grelha 2×2 — mesmas classes da Conta SPOT */}
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
          </motion.button>
        ))}
      </div>

      {/* Outros produtos — espelho da SPOT com Conta SPOT em primeiro */}
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

      {/* Extrato recente — só movimentos OLEXP / SWAP */}
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
          <p className="text-sm text-gray-500">Nenhum movimento OLEXP neste período.</p>
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
                <div className={`font-bold text-sm shrink-0 ${entry.amount >= 0 ? 'text-neon-green' : 'text-red-400'}`}>
                  {fmtBroCents(entry.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Ativação — mesmo peso visual glass */}
      {!kycDone && (
        <motion.div
          id="wallet-olexp-kyc"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-3xl border border-purple-400/30 bg-white/[0.03] backdrop-blur-md p-6 md:p-8 text-center space-y-4"
        >
          <Lock className="w-10 h-10 text-purple-400 mx-auto" />
          <h3 className="font-display font-bold text-lg text-white">Ativação OLEXP</h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Para abrir posições Hold, aceita o termo de risco do produto e a verificação leve.
          </p>
          <p className="text-[10px] text-gray-500">Rendimentos passados não garantem resultados futuros.</p>
          <button type="button" onClick={handleKyc} className="btn-primary mx-auto">
            <span className="inline-block skew-x-6">Ativar OLEXP</span>
          </button>
        </motion.div>
      )}

      {kycDone && (
        <motion.div
          ref={holdFormRef}
          id="wallet-olexp-hold"
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-6 md:p-8 space-y-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.06)]"
        >
          <div className="flex items-center gap-2 text-purple-300">
            <TrendingUp className="w-5 h-5 text-neon-yellow" />
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-white">Nova posição (Hold)</h3>
          </div>
          <p className="text-xs text-gray-500">Disponível SPOT: {bro.primary}</p>

          <div className="grid grid-cols-3 gap-2">
            {OLEXP_PLANS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPlan(p.id)}
                className={`py-3 px-2 rounded-xl border text-center transition-all ${
                  selectedPlan === p.id
                    ? 'border-neon-yellow/50 bg-neon-yellow/10 text-neon-yellow'
                    : 'border-white/10 bg-black/30 text-gray-400 hover:border-white/20'
                }`}
              >
                <div className="font-bold text-sm">{p.days}d</div>
                <div className="text-[10px] mt-0.5">{(p.dailyRate * 100).toFixed(3)}%/dia</div>
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Valor (BRO)</label>
            <input
              type="number"
              min={plan.minBroCents / 100}
              max={finance.broCents / 100}
              step="1"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder={`Mín. ${plan.minBroCents / 100}`}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-neon-yellow focus:outline-none transition-colors"
            />
          </div>

          {amountCents > 0 && (
            <div className="bg-black/30 rounded-xl p-4 space-y-1 text-sm border border-white/5">
              <div className="flex justify-between">
                <span className="text-gray-400">Yield diário estimado</span>
                <span className="text-purple-300">{(est.dailyYieldCents / 100).toFixed(2)} BRO</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Dias úteis (~)</span>
                <span className="text-gray-300">{est.businessDaysApprox}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-gray-300">Total estimado</span>
                <span className="text-neon-green">{(est.totalYieldCents / 100).toFixed(2)} BRO</span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleStake}
            disabled={!canStake}
            className={`w-full py-3.5 rounded-xl font-display font-bold text-sm uppercase tracking-wider transition-all ${
              canStake ? 'bg-neon-yellow text-black hover:bg-neon-yellow/90' : 'bg-white/5 text-gray-600 cursor-not-allowed'
            }`}
          >
            Confirmar posição
          </button>
        </motion.div>
      )}

      {wallet.olexpPositions.length > 0 && (
        <div id="wallet-olexp-positions" className="space-y-3 scroll-mt-24">
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-gray-400">Posições</h3>
          {wallet.olexpPositions.map((pos) => {
            const s = statusLabel(pos);
            return (
              <motion.div
                key={pos.id}
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{(pos.principalCents / 100).toFixed(2)} BRO</span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                      {pos.planId}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {pos.startDate} → {pos.endDate}
                    </span>
                    <span className={s.color}>{s.text}</span>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Gift className="w-3 h-3 text-neon-green" />
                    Yield acumulado: {(pos.yieldAccruedCents / 100).toFixed(2)} BRO
                  </div>
                </div>

                {pos.status === 'matured' && (
                  <button
                    type="button"
                    onClick={() => handleClaim(pos.id)}
                    className="bg-neon-green/10 border border-neon-green/40 text-neon-green py-2 px-5 rounded-xl text-sm font-bold hover:bg-neon-green/20 transition-colors flex items-center gap-2 shrink-0"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Resgatar
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </WalletShell>
  );
}
