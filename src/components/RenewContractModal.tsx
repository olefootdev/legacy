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

  const moeda = paymentMethod === 'exp' ? 'EXP' : moedaDoJogo();
  const rotulo = 'font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex min-h-0 flex-col justify-end bg-black/85 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 sm:items-center sm:justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="relative mx-auto flex max-h-[min(92dvh,640px)] w-full max-w-md flex-col overflow-hidden border-2 border-linha bg-asfalto-27"
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-2 border-b-2 border-linha px-4 py-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-mudo">
                  <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden /> — {L('Renovar Contrato', 'Renew Contract')}
                </span>
                <h3 className="truncate font-voz text-[30px] leading-none text-papel">{player.name}</h3>
                <p className="font-prova text-[11px] font-bold uppercase text-mudo">{rotuloPosicao(player.pos)}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center border-2 border-linha text-mudo transition-colors hover:border-papel hover:text-papel"
                aria-label={L('Fechar', 'Close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-y-contain px-4 py-4">
              {/* Aviso contrato expirado */}
              <div className="border-l-[3px] border-atencao bg-concreto p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-atencao" />
                  <div className="min-w-0 flex-1">
                    <p className="font-impact text-[17px] uppercase leading-none text-papel">{L('Contrato expirado', 'Contract expired')}</p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-suave">
                      {L('Este jogador não pode entrar em XI oficial. Renove pra reativar no plantel.', 'This player can’t be in an official XI. Renew to reactivate him in the squad.')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Seleção de duração */}
              <div className="space-y-2">
                <span className={rotulo}>— {L('Período do contrato (jogos)', 'Contract length (games)')}</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {MANAGER_PROSPECT_CONTRACT_GAMES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setContractMatches(n)}
                      aria-pressed={contractMatches === n}
                      className={cn(
                        'min-h-[48px] font-spray text-[24px] font-black leading-none transition-colors',
                        contractMatches === n
                          ? 'bg-rua text-asfalto-27'
                          : 'border-2 border-linha text-suave hover:border-papel hover:text-papel',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-[12px] leading-relaxed text-mudo">
                  {L('Cada partida oficial em que o jogador participar decrementa 1.', 'Each official match the player plays counts down 1.')}
                </p>
              </div>

              {/* Seleção de moeda */}
              <div className="space-y-2">
                <span className={rotulo}>— {L('Forma de pagamento', 'Payment method')}</span>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'exp' as const, nome: 'EXP', sub: 'In-game', valor: formatExp(totalExpCost) },
                    { id: 'olefoot' as const, nome: moedaDoJogo(), sub: L('Saldo do jogo', 'Game balance'), valor: formatOle(totalOlefootCost) },
                  ]).map((m) => {
                    const sel = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        aria-pressed={sel}
                        className={cn(
                          'min-w-0 px-3 py-3 text-left transition-colors',
                          sel ? 'border-2 border-rua bg-concreto' : 'border-2 border-linha hover:border-fio',
                        )}
                      >
                        <div className={cn('font-impact text-[17px] uppercase leading-none', sel ? 'text-rua' : 'text-papel')}>{m.nome}</div>
                        <div className="mt-1 font-prova text-[10px] text-mudo">{m.sub}</div>
                        <div className="mt-1.5 truncate font-impact text-[20px] leading-none text-papel tabular-nums">{m.valor}</div>
                      </button>
                    );
                  })}
                </div>
                <p className="font-prova text-[11px] leading-relaxed text-mudo">
                  {L('Taxa', 'Rate')}: 1 {moedaDoJogo()} = {EXP_PER_OLEFOOT_FOR_RENEWAL} EXP. {L('Sai do saldo do jogo.', 'Paid from your game balance.')}
                </p>
              </div>

              {/* Resumo de custos */}
              <div
                className={cn(
                  'px-3 py-3 font-prova text-[12px]',
                  canAfford ? 'bg-concreto text-suave' : 'border-2 border-baixa bg-concreto text-suave',
                )}
              >
                <div className="space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <span>{L('Custo base (50% desconto):', 'Base cost (50% off):')}</span>
                    <span className="font-bold text-papel">{formatExp(renewalBaseCost)} EXP</span>
                  </div>
                  {contractPremium > 0 && (
                    <div className="flex justify-between gap-2">
                      <span>{L('Prêmio do tier:', 'Tier premium:')}</span>
                      <span className="font-bold text-papel">{formatExp(contractPremium)} EXP</span>
                    </div>
                  )}
                  <div className="mt-1 flex items-baseline justify-between gap-2 border-t-2 border-dashed border-linha pt-2">
                    <span className="font-bold uppercase">{L('Total', 'Total')} ({moeda}):</span>
                    <span className="font-impact text-[24px] leading-none text-papel tabular-nums">
                      {paymentMethod === 'exp'
                        ? `${formatExp(totalExpCost)} EXP`
                        : `${formatOle(totalOlefootCost)} ${moedaDoJogo()}`}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>{L('Saldo:', 'Balance:')}</span>
                    <span className={cn('font-bold', canAfford ? 'text-papel' : 'text-baixa')}>
                      {paymentMethod === 'exp'
                        ? `${formatExp(expBal)} EXP`
                        : olefootLoading
                          ? '—'
                          : `${formatOle(olefootBal ?? 0)} ${moedaDoJogo()}`}
                    </span>
                  </div>
                </div>
                {!canAfford && !olefootLoading && (
                  <p className="mt-2 font-bold text-baixa">
                    {L(`${moeda} insuficiente`, `Not enough ${moeda}`)}
                  </p>
                )}
                {errorMsg && (
                  <p role="alert" className="mt-2 font-bold text-baixa">{errorMsg}</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t-2 border-linha px-4 py-4 pr-5">
              <button
                type="button"
                disabled={!canAfford || submitting || olefootLoading}
                onClick={handleRenew}
                className={cn(
                  'flex min-h-[52px] w-full items-center justify-center gap-2 font-impact text-[20px] uppercase leading-none transition-[transform,box-shadow]',
                  canAfford && !submitting
                    ? 'bg-rua text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)] disabled:opacity-50'
                    : 'cursor-not-allowed border-2 border-dashed border-fio text-mudo',
                )}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {submitting
                  ? L('Processando...', 'Processing...')
                  : !canAfford
                    ? L(`${moeda} Insuficiente`, `Not enough ${moeda}`)
                    : <>{L(`Renovar com ${moeda}`, `Renew with ${moeda}`)} <span aria-hidden>→</span></>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
