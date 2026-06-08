/**
 * Modal de renovação de contrato para jogadores da Academia OLE expirados.
 * Custo: 50% do custo base + prêmio do contrato escolhido.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatExp } from '@/systems/economy';
import {
  MANAGER_PROSPECT_CONTRACT_GAMES,
  managerProspectContractPremiumExp,
  type ManagerProspectContractGames,
} from '@/playerContracts/playerContracts';
import { DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP } from '@/entities/managerProspect';
import type { PlayerEntity } from '@/entities/types';

interface Props {
  open: boolean;
  onClose: () => void;
  player: PlayerEntity;
}

export function RenewContractModal({ open, onClose, player }: Props) {
  const dispatch = useGameDispatch();
  const oleBal = useGameStore((s) => s.finance.ole);
  const baseCost = useGameStore(
    (s) => s.managerProspectConfig?.createCostExp ?? DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP,
  );

  const [contractMatches, setContractMatches] = useState<ManagerProspectContractGames>(50);

  const renewalBaseCost = Math.round(baseCost * 0.5);
  const contractPremium = managerProspectContractPremiumExp(contractMatches);
  const totalCost = renewalBaseCost + contractPremium;
  const canAfford = oleBal >= totalCost;

  const handleRenew = () => {
    if (!canAfford) return;
    dispatch({
      type: 'RENEW_MANAGER_PROSPECT_CONTRACT',
      playerId: player.id,
      contractMatches,
    });
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
            className="relative mx-auto flex max-h-[min(92dvh,600px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-cyan-500/30 bg-dark-gray shadow-[0_0_40px_rgba(6,182,212,0.12)] sm:rounded-2xl"
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
              {/* Aviso de contrato expirado */}
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-amber-200">Contrato expirado</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-amber-300/80">
                      Este jogador não pode mais jogar partidas oficiais. Renove o contrato para
                      reativá-lo no plantel.
                    </p>
                  </div>
                </div>
              </div>

              {/* Benefício da renovação */}
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                  💰 Desconto de 50%
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-white/70">
                  Renovação custa apenas metade do custo base de criação + prêmio do contrato
                  escolhido.
                </p>
              </div>

              {/* Seleção de duração */}
              <div className="space-y-2 rounded-lg border border-white/10 bg-black/30 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Duração do contrato (jogos)
                </span>
                <div className="flex flex-wrap gap-2">
                  {MANAGER_PROSPECT_CONTRACT_GAMES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setContractMatches(n)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-[10px] font-bold uppercase transition-colors',
                        contractMatches === n
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                          : 'border-white/15 text-gray-400 hover:border-white/30 hover:text-white',
                      )}
                    >
                      {n}
                      {managerProspectContractPremiumExp(n) > 0
                        ? ` (+${formatExp(managerProspectContractPremiumExp(n))})`
                        : ''}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] leading-relaxed text-gray-500">
                  Amistosos e oficiais contam por jogo; ao fim do contrato o jogador fica
                  indisponível para XI oficial.
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
                    <span className="font-display font-bold text-cyan-300">
                      {formatExp(renewalBaseCost)} EXP
                    </span>
                  </div>
                  {contractPremium > 0 && (
                    <div className="flex justify-between">
                      <span>Prêmio contrato:</span>
                      <span className="font-display font-bold text-white/90">
                        {formatExp(contractPremium)} EXP
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-white/10 pt-1 mt-1">
                    <span className="font-bold">Total:</span>
                    <span className="font-display font-black text-cyan-300">
                      {formatExp(totalCost)} EXP
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saldo:</span>
                    <span className={cn('font-bold', canAfford ? 'text-white' : 'text-red-300')}>
                      {formatExp(oleBal)} EXP
                    </span>
                  </div>
                </div>
                {!canAfford && (
                  <p className="mt-2 text-[10px] text-red-300">⚠️ EXP insuficiente</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-white/10 bg-black/40 px-4 py-3">
              <button
                type="button"
                disabled={!canAfford}
                onClick={handleRenew}
                className={cn(
                  'w-full rounded-lg py-3 font-display text-sm font-black uppercase tracking-wide transition-all',
                  canAfford
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400 active:scale-[0.98]'
                    : 'bg-white/10 text-white/30 cursor-not-allowed',
                )}
              >
                {canAfford ? 'Renovar Contrato' : 'EXP Insuficiente'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
