/**
 * Modal de renovação de contrato para jogadores da Academia OLE expirados.
 *
 * Manager escolhe:
 *  1. Período do contrato (tiers: 50 / 250 / 500 / 1000 jogos)
 *  2. Moeda de pagamento (EXP ou OLEXP — ambos saldo do jogo, nada on-chain)
 *
 * Custo EXP:       50% do custo base + prêmio do tier
 * Custo OLEXP:     custo EXP ÷ 100, arredondado pra cima
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatExp, formatOle } from '@/systems/economy';
import { moedaDoJogo } from '@/wallet/constants';
import {
  MANAGER_PROSPECT_CONTRACT_GAMES,
  managerProspectContractPremiumExp,
  expCostToOlefoot,
  EXP_PER_OLEFOOT_FOR_RENEWAL,
  type ManagerProspectContractGames,
} from '@/playerContracts/playerContracts';
import { rotuloPosicao } from '@/transfer/marketFilters';
import { DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP } from '@/entities/managerProspect';
import { fetchMyOlefootBalance, spendMyOlefoot } from '@/wallet/olefoot';
import type { PlayerEntity } from '@/entities/types';
import { L } from '@/i18n/L';

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

  // Busca o saldo OLEXP só quando o modal abre + quando o user troca pra ele.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setOlefootLoading(true);
    fetchMyOlefootBalance()
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
        <div className="fixed inset-0 z-[70] flex min-h-0 flex-col justify-end bg-black/85 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 sm:items-center sm:justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="relative mx-auto flex max-h-[min(92dvh,640px)] w-full max-w-md flex-col overflow-hidden border border-white/16 bg-panel"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-nav px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <RefreshCw className="h-5 w-5 shrink-0 text-white" aria-hidden />
                <div className="min-w-0">
                  <h3 className="font-impact text-[17px] uppercase leading-[1.1] text-white">
                    {L('Renovar Contrato', 'Renew Contract')}
                  </h3>
                  <p className="truncate font-mono text-[10.5px] text-cimento">
                    {player.name} · {rotuloPosicao(player.pos)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-cimento transition-colors hover:bg-white/10 hover:text-white"
                aria-label={L('Fechar', 'Close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-4 py-4">
              {/* Aviso contrato expirado */}
              <div className="border border-atencao/40 bg-atencao/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-atencao mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-atencao">{L('Contrato expirado', 'Contract expired')}</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-giz">
                      {L('Este jogador não pode entrar em XI oficial. Renove pra reativar no plantel.', 'This player can’t be in an official XI. Renew to reactivate him in the squad.')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Seleção de duração */}
              <div className="space-y-2 border border-white/10 bg-card p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cimento">
                  {L('Período do contrato (jogos)', 'Contract length (games)')}
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {MANAGER_PROSPECT_CONTRACT_GAMES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setContractMatches(n)}
                      className={cn(
                        'ole-num border px-2 py-2 text-[12px] uppercase transition-colors',
                        contractMatches === n
                          ? 'border-neon-yellow bg-neon-yellow text-black'
                          : 'border-white/16 text-cimento hover:border-white/30 hover:text-white',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] leading-relaxed text-poeira">
                  {L('Cada partida oficial em que o jogador participar decrementa 1.', 'Each official match the player plays counts down 1.')}
                </p>
              </div>

              {/* Seleção de moeda */}
              <div className="space-y-2 border border-white/10 bg-card p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cimento">
                  {L('Forma de pagamento', 'Payment method')}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('exp')}
                    className={cn(
                      'border px-3 py-3 text-left transition-colors',
                      paymentMethod === 'exp'
                        ? 'border-neon-yellow bg-card'
                        : 'border-white/16 hover:border-white/30',
                    )}
                  >
                    <div className={cn(
                      'text-[10px] font-bold uppercase',
                      paymentMethod === 'exp' ? 'text-white' : 'text-cimento',
                    )}>
                      EXP
                    </div>
                    <div className="mt-1 text-[10px] text-white/70">In-game</div>
                    <div className={cn(
                      'mt-1 font-mono text-sm font-medium tabular-nums',
                      paymentMethod === 'exp' ? 'text-white' : 'text-giz',
                    )}>
                      {formatExp(totalExpCost)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('olefoot')}
                    className={cn(
                      'border px-3 py-3 text-left transition-colors',
                      paymentMethod === 'olefoot'
                        ? 'border-neon-yellow bg-card'
                        : 'border-white/16 hover:border-white/30',
                    )}
                  >
                    <div className={cn(
                      'text-[10px] font-bold uppercase',
                      paymentMethod === 'olefoot' ? 'text-white' : 'text-cimento',
                    )}>
                      {moedaDoJogo()}
                    </div>
                    <div className="mt-1 text-[10px] text-white/70">Saldo do jogo</div>
                    <div className={cn(
                      'mt-1 font-mono text-sm font-medium tabular-nums',
                      paymentMethod === 'olefoot' ? 'text-white' : 'text-giz',
                    )}>
                      {formatOle(totalOlefootCost)}
                    </div>
                  </button>
                </div>
                <p className="text-[10px] leading-relaxed text-poeira">
                  {L('Taxa', 'Rate')}: 1 {moedaDoJogo()} = {EXP_PER_OLEFOOT_FOR_RENEWAL} EXP. {L('Sai do saldo do jogo.', 'Paid from your game balance.')}
                </p>
              </div>

              {/* Resumo de custos */}
              <div
                className={cn(
                  'border px-3 py-3 text-[10px]',
                  canAfford
                    ? 'border-white/10 bg-card text-cimento'
                    : 'border-baixa/40 bg-baixa/10 text-giz',
                )}
              >
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>{L('Custo base (50% desconto):', 'Base cost (50% off):')}</span>
                    <span className="font-display font-bold text-white/90">
                      {formatExp(renewalBaseCost)} EXP
                    </span>
                  </div>
                  {contractPremium > 0 && (
                    <div className="flex justify-between">
                      <span>{L('Prêmio do tier:', 'Tier premium:')}</span>
                      <span className="font-display font-bold text-white/90">
                        {formatExp(contractPremium)} EXP
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-white/10 pt-1 mt-1">
                    <span className="font-bold">{L('Total', 'Total')} ({paymentMethod === 'exp' ? 'EXP' : moedaDoJogo()}):</span>
                    <span
                      className={cn(
                        'font-mono font-medium tabular-nums',
                        'text-white',
                      )}
                    >
                      {paymentMethod === 'exp'
                        ? `${formatExp(totalExpCost)} EXP`
                        : `${formatOle(totalOlefootCost)} ${moedaDoJogo()}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{L('Saldo:', 'Balance:')}</span>
                    <span className={cn('font-bold', canAfford ? 'text-white' : 'text-baixa')}>
                      {paymentMethod === 'exp'
                        ? `${formatExp(expBal)} EXP`
                        : olefootLoading
                          ? '—'
                          : `${formatOle(olefootBal ?? 0)} ${moedaDoJogo()}`}
                    </span>
                  </div>
                </div>
                {!canAfford && !olefootLoading && (
                  <p className="mt-2 text-[10px] text-baixa">
                    ⚠️ {L(`${paymentMethod === 'exp' ? 'EXP' : moedaDoJogo()} insuficiente`, `Not enough ${paymentMethod === 'exp' ? 'EXP' : moedaDoJogo()}`)}
                  </p>
                )}
                {errorMsg && (
                  <p className="mt-2 text-[10px] text-baixa">⚠️ {errorMsg}</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-white/10 bg-nav px-4 py-3">
              <button
                type="button"
                disabled={!canAfford || submitting || olefootLoading}
                onClick={handleRenew}
                className={cn(
                  'flex h-[50px] w-full items-center justify-center gap-2 font-display text-[15px] uppercase tracking-wide transition-colors [--corte:12px] [clip-path:var(--clip-corte)]',
                  canAfford && !submitting
                    ? 'bg-neon-yellow text-black hover:bg-white'
                    : 'bg-card-hi text-poeira cursor-not-allowed',
                )}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {submitting
                  ? L('Processando...', 'Processing...')
                  : !canAfford
                    ? L(`${paymentMethod === 'exp' ? 'EXP' : moedaDoJogo()} Insuficiente`, `Not enough ${paymentMethod === 'exp' ? 'EXP' : moedaDoJogo()}`)
                    : L(`Renovar com ${paymentMethod === 'exp' ? 'EXP' : moedaDoJogo()}`, `Renew with ${paymentMethod === 'exp' ? 'EXP' : moedaDoJogo()}`)}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
