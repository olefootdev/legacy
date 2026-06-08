/**
 * Modal de renovação de contrato para jogadores da Academia OLE expirados.
 *
 * Manager escolhe:
 *  1. Período do contrato (tiers: 50 / 250 / 500 / 1000 jogos)
 *  2. Moeda de pagamento (EXP off-chain ou OLEFOOT on-chain)
 *
 * Custo EXP:       50% do custo base + prêmio do tier
 * Custo OLEFOOT:   custo EXP ÷ 100, arredondado pra cima
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatExp, formatOle } from '@/systems/economy';
import {
  MANAGER_PROSPECT_CONTRACT_GAMES,
  managerProspectContractPremiumExp,
  expCostToOlefoot,
  EXP_PER_OLEFOOT_FOR_RENEWAL,
  type ManagerProspectContractGames,
} from '@/playerContracts/playerContracts';
import { DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP } from '@/entities/managerProspect';
import { fetchMyOlexpBalance, spendMyOlefoot } from '@/wallet/olexpSync';
import type { PlayerEntity } from '@/entities/types';

interface Props {
  open: boolean;
  onClose: () => void;
  player: PlayerEntity;
}

type PaymentMethod = 'exp' | 'olefoot';

export function RenewContractModal({ open, onClose, player }: Props) {
  const dispatch = useGameDispatch();
  const expBal = useGameStore((s) => s.finance.ole);
  const baseCost = useGameStore(
    (s) => s.managerProspectConfig?.createCostExp ?? DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP,
  );

  const [contractMatches, setContractMatches] = useState<ManagerProspectContractGames>(50);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('exp');
  const [olefootBal, setOlefootBal] = useState<number | null>(null);
  const [olefootLoading, setOlefootLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cálculos de custo — totalmente determinísticos a partir do tier.
  const renewalBaseCost = Math.round(baseCost * 0.5);
  const contractPremium = managerProspectContractPremiumExp(contractMatches);
  const totalExpCost = renewalBaseCost + contractPremium;
  const totalOlefootCost = expCostToOlefoot(totalExpCost);

  const canAffordExp = expBal >= totalExpCost;
  const canAffordOlefoot = olefootBal !== null && olefootBal >= totalOlefootCost;
  const canAfford = paymentMethod === 'exp' ? canAffordExp : canAffordOlefoot;

  // Busca saldo OLEFOOT só quando o modal abre + quando o user troca pra OLEFOOT.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setOlefootLoading(true);
    fetchMyOlexpBalance()
      .then((b) => {
        if (!cancelled) setOlefootBal(b);
      })
      .finally(() => {
        if (!cancelled) setOlefootLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Reset estado quando fechar.
  useEffect(() => {
    if (!open) {
      setSubmitting(false);
      setErrorMsg(null);
      setContractMatches(50);
      setPaymentMethod('exp');
    }
  }, [open]);

  const handleRenew = async () => {
    if (!canAfford || submitting) return;
    setErrorMsg(null);
    setSubmitting(true);

    if (paymentMethod === 'olefoot') {
      // 1) Debita server-side via RPC. 2) Só dispatcha se ok.
      const result = await spendMyOlefoot({
        amount: totalOlefootCost,
        source: 'renovacao_contrato',
        sourceRef: player.id,
      });
      if (result.ok === false) {
        setSubmitting(false);
        setErrorMsg(result.message);
        return;
      }
      // Atualiza saldo otimista local pra UI refletir.
      setOlefootBal(result.newBalance);
    }

    dispatch({
      type: 'RENEW_MANAGER_PROSPECT_CONTRACT',
      playerId: player.id,
      contractMatches,
      paymentMethod,
    });
    setSubmitting(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex min-h-0 flex-col justify-end bg-black/80 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="relative mx-auto flex max-h-[min(92dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-cyan-500/30 bg-dark-gray shadow-[0_0_40px_rgba(6,182,212,0.12)] sm:rounded-2xl"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-black/40 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <RefreshCw className="h-5 w-5 shrink-0 text-cyan-400" aria-hidden />
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-black uppercase tracking-wide text-white">
                    Renovar Contrato
                  </h3>
                  <p className="text-[10px] text-gray-500">
                    {player.name} · {player.pos}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-4 py-4">
              {/* Aviso contrato expirado */}
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-amber-200">Contrato expirado</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-amber-300/80">
                      Este jogador não pode entrar em XI oficial. Renove pra reativar no plantel.
                    </p>
                  </div>
                </div>
              </div>

              {/* Seleção de duração */}
              <div className="space-y-2 rounded-lg border border-white/10 bg-black/30 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Período do contrato (jogos)
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {MANAGER_PROSPECT_CONTRACT_GAMES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setContractMatches(n)}
                      className={cn(
                        'rounded-lg border px-2 py-2 text-[11px] font-bold uppercase transition-colors',
                        contractMatches === n
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                          : 'border-white/15 text-gray-400 hover:border-white/30 hover:text-white',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] leading-relaxed text-gray-500">
                  Cada partida oficial em que o jogador participar decrementa 1.
                </p>
              </div>

              {/* Seleção de moeda */}
              <div className="space-y-2 rounded-lg border border-white/10 bg-black/30 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Forma de pagamento
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('exp')}
                    className={cn(
                      'rounded-lg border px-3 py-3 text-left transition-colors',
                      paymentMethod === 'exp'
                        ? 'border-cyan-400 bg-cyan-500/20'
                        : 'border-white/15 hover:border-white/30',
                    )}
                  >
                    <div className={cn(
                      'text-[10px] font-bold uppercase',
                      paymentMethod === 'exp' ? 'text-cyan-300' : 'text-gray-400',
                    )}>
                      EXP
                    </div>
                    <div className="mt-1 text-[10px] text-white/70">In-game</div>
                    <div className={cn(
                      'mt-1 font-display text-sm font-black',
                      paymentMethod === 'exp' ? 'text-cyan-200' : 'text-white/80',
                    )}>
                      {formatExp(totalExpCost)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('olefoot')}
                    className={cn(
                      'rounded-lg border px-3 py-3 text-left transition-colors',
                      paymentMethod === 'olefoot'
                        ? 'border-amber-400 bg-amber-500/20'
                        : 'border-white/15 hover:border-white/30',
                    )}
                  >
                    <div className={cn(
                      'text-[10px] font-bold uppercase',
                      paymentMethod === 'olefoot' ? 'text-amber-300' : 'text-gray-400',
                    )}>
                      OLEFOOT
                    </div>
                    <div className="mt-1 text-[10px] text-white/70">On-chain</div>
                    <div className={cn(
                      'mt-1 font-display text-sm font-black',
                      paymentMethod === 'olefoot' ? 'text-amber-200' : 'text-white/80',
                    )}>
                      {formatOle(totalOlefootCost)}
                    </div>
                  </button>
                </div>
                <p className="text-[10px] leading-relaxed text-gray-500">
                  Taxa: 1 OLEFOOT = {EXP_PER_OLEFOOT_FOR_RENEWAL} EXP. OLEFOOT debita on-chain via wallet.
                </p>
              </div>

              {/* Resumo de custos */}
              <div
                className={cn(
                  'rounded-lg border px-3 py-3 text-[10px]',
                  canAfford
                    ? 'border-white/10 bg-black/30 text-gray-400'
                    : 'border-red-500/40 bg-red-950/30 text-red-200',
                )}
              >
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Custo base (50% desconto):</span>
                    <span className="font-display font-bold text-white/90">
                      {formatExp(renewalBaseCost)} EXP
                    </span>
                  </div>
                  {contractPremium > 0 && (
                    <div className="flex justify-between">
                      <span>Prêmio do tier:</span>
                      <span className="font-display font-bold text-white/90">
                        {formatExp(contractPremium)} EXP
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-white/10 pt-1 mt-1">
                    <span className="font-bold">Total ({paymentMethod === 'exp' ? 'EXP' : 'OLEFOOT'}):</span>
                    <span
                      className={cn(
                        'font-display font-black',
                        paymentMethod === 'exp' ? 'text-cyan-300' : 'text-amber-300',
                      )}
                    >
                      {paymentMethod === 'exp'
                        ? `${formatExp(totalExpCost)} EXP`
                        : `${formatOle(totalOlefootCost)} OLEFOOT`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saldo:</span>
                    <span className={cn('font-bold', canAfford ? 'text-white' : 'text-red-300')}>
                      {paymentMethod === 'exp'
                        ? `${formatExp(expBal)} EXP`
                        : olefootLoading
                          ? '—'
                          : `${formatOle(olefootBal ?? 0)} OLEFOOT`}
                    </span>
                  </div>
                </div>
                {!canAfford && !olefootLoading && (
                  <p className="mt-2 text-[10px] text-red-300">
                    ⚠️ {paymentMethod === 'exp' ? 'EXP' : 'OLEFOOT'} insuficiente
                  </p>
                )}
                {errorMsg && (
                  <p className="mt-2 text-[10px] text-red-300">⚠️ {errorMsg}</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-white/10 bg-black/40 px-4 py-3">
              <button
                type="button"
                disabled={!canAfford || submitting || olefootLoading}
                onClick={handleRenew}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-lg py-3 font-display text-sm font-black uppercase tracking-wide transition-all',
                  canAfford && !submitting
                    ? paymentMethod === 'exp'
                      ? 'bg-cyan-500 text-black hover:bg-cyan-400 active:scale-[0.98]'
                      : 'bg-amber-500 text-black hover:bg-amber-400 active:scale-[0.98]'
                    : 'bg-white/10 text-white/30 cursor-not-allowed',
                )}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {submitting
                  ? 'Processando...'
                  : !canAfford
                    ? `${paymentMethod === 'exp' ? 'EXP' : 'OLEFOOT'} Insuficiente`
                    : `Renovar com ${paymentMethod === 'exp' ? 'EXP' : 'OLEFOOT'}`}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
