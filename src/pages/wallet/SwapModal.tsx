/**
 * SWAP SPOT ↔ OLEXP
 *
 * Política (MVP): KYC de identidade (nome, morada, CPF) na primeira vez em **qualquer** direção.
 * Termo de risco + checkbox obrigatórios só em **SPOT → OLEXP** antes de indicar montante.
 * **OLEXP → SPOT** (principal de posição ativa): sem o mesmo termo longo; usa `earlyExitOlexpToSpot`.
 */

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatBroDisplay } from '@/systems/economy';
import { OLEXP_PLANS, OLEXP_SWAP_OLEXP_TO_SPOT_MIN_BRO_CENTS } from '@/wallet/constants';
import { estimateYield } from '@/wallet/olexp';
import { createInitialWalletState } from '@/wallet/initial';
import type { OlexpPlanId } from '@/wallet/types';
import { cn } from '@/lib/utils';

/** Primeira vez em qualquer direção de SWAP: formulário de identidade (MVP cliente). */
const RISK_COPY = [
  'Alocar BRO em OLEXP (Hold) implica manter o principal comprometido até ao vencimento ou até utilizares SWAP de volta para o SPOT nas condições do produto.',
  'Rendimentos passados ou simulações não garantem resultados futuros. Podes perder parte ou a totalidade do valor em cenários extremos.',
  'A Olefoot não presta assessoria financeira. Em caso de dúvida, consulta um profissional independente.',
].join(' ');

function digitsOnly(s: string, max: number): string {
  return s.replace(/\D/g, '').slice(0, max);
}

function formatCpfDisplay(d: string): string {
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 9);
  const r = d.slice(9, 11);
  let out = a;
  if (b) out += `.${b}`;
  if (c) out += `.${c}`;
  if (r) out += `-${r}`;
  return out;
}

export function SwapModal({
  open,
  onClose,
  defaultDirection = 'spot_to_olexp',
}: {
  open: boolean;
  onClose: () => void;
  defaultDirection?: 'spot_to_olexp' | 'olexp_to_spot';
}) {
  const dispatch = useGameDispatch();
  const finance = useGameStore((s) => s.finance);
  const wallet = finance.wallet ?? createInitialWalletState();

  const [direction, setDirection] = useState<'spot_to_olexp' | 'olexp_to_spot'>(defaultDirection);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [fullName, setFullName] = useState(wallet.kycProfile?.fullName ?? '');
  const [address, setAddress] = useState(wallet.kycProfile?.address ?? '');
  const [cpfDigits, setCpfDigits] = useState(() => digitsOnly(wallet.kycProfile?.cpf ?? '', 11));
  const [selectedPlan, setSelectedPlan] = useState<OlexpPlanId>('90d');
  const [amountInput, setAmountInput] = useState('');
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDirection(defaultDirection);
    setRiskAccepted(defaultDirection === 'olexp_to_spot');
    setAmountInput('');
    setSelectedPositionId(null);
  }, [open, defaultDirection]);

  const hasSwapKyc = Boolean(wallet.hasCompletedSwapKyc && wallet.kycProfile);
  const kycOlexpDone = wallet.kycOlexpDone;
  const bro = formatBroDisplay(finance.broCents);

  const plan = OLEXP_PLANS.find((p) => p.id === selectedPlan)!;
  const amountCents = Math.round((parseFloat(amountInput) || 0) * 100);
  const est = estimateYield(selectedPlan, amountCents);

  const activePositions = useMemo(
    () => wallet.olexpPositions.filter((p) => p.status === 'active'),
    [wallet.olexpPositions],
  );

  const canSubmitKyc =
    fullName.trim().length >= 3 && address.trim().length >= 8 && cpfDigits.length === 11;

  const canStake =
    kycOlexpDone &&
    hasSwapKyc &&
    riskAccepted &&
    direction === 'spot_to_olexp' &&
    amountCents >= plan.minBroCents &&
    amountCents <= finance.broCents;

  const resetAndClose = () => {
    setRiskAccepted(false);
    setAmountInput('');
    setSelectedPositionId(null);
    onClose();
  };

  const handleSaveKyc = () => {
    if (!canSubmitKyc) return;
    dispatch({
      type: 'WALLET_SAVE_SWAP_KYC',
      profile: {
        fullName: fullName.trim(),
        address: address.trim(),
        cpf: formatCpfDisplay(cpfDigits),
        confirmedAt: new Date().toISOString(),
      },
    });
  };

  const handleStake = () => {
    if (!canStake) return;
    dispatch({ type: 'WALLET_CREATE_OLEXP', planId: selectedPlan, amountCents });
    resetAndClose();
  };

  const selectedActivePosition = useMemo(
    () => activePositions.find((p) => p.id === selectedPositionId) ?? null,
    [activePositions, selectedPositionId],
  );
  const canEarlyToSpot =
    selectedActivePosition != null &&
    selectedActivePosition.principalCents >= OLEXP_SWAP_OLEXP_TO_SPOT_MIN_BRO_CENTS;

  const handleEarlyToSpot = () => {
    if (!selectedPositionId || !canEarlyToSpot) return;
    dispatch({ type: 'WALLET_OLEXP_EARLY_TO_SPOT', positionId: selectedPositionId });
    resetAndClose();
  };

  if (!open) return null;

  return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-modal-title"
        onClick={(e) => e.target === e.currentTarget && resetAndClose()}
      >
        <motion.div
          initial={{ y: 48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 32, opacity: 0 }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
          className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/15 bg-[#0c0c0c] shadow-2xl shadow-black/80"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0c0c0c]/95 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-neon-yellow" />
              <h2 id="swap-modal-title" className="font-display font-bold text-lg text-white tracking-wide">
                SWAP
              </h2>
            </div>
            <button
              type="button"
              onClick={resetAndClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-6">
            {/* Direção */}
            <div className="flex p-1 rounded-xl bg-black/50 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setDirection('spot_to_olexp');
                  setRiskAccepted(false);
                }}
                className={cn(
                  'flex-1 py-2.5 text-[11px] font-display font-bold uppercase tracking-wider rounded-lg transition-colors',
                  direction === 'spot_to_olexp'
                    ? 'bg-neon-yellow text-black'
                    : 'text-gray-500 hover:text-white',
                )}
              >
                SPOT → OLEXP
              </button>
              <button
                type="button"
                onClick={() => {
                  setDirection('olexp_to_spot');
                  setRiskAccepted(true);
                }}
                className={cn(
                  'flex-1 py-2.5 text-[11px] font-display font-bold uppercase tracking-wider rounded-lg transition-colors',
                  direction === 'olexp_to_spot'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-500 hover:text-white',
                )}
              >
                OLEXP → SPOT
              </button>
            </div>

            {direction === 'spot_to_olexp' ? (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
                <div className="flex gap-2 text-amber-200/90">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider">Risco e informação</p>
                    <p className="text-[11px] text-gray-300 leading-relaxed">{RISK_COPY}</p>
                    <label className="flex items-start gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={riskAccepted}
                        onChange={(e) => setRiskAccepted(e.target.checked)}
                        className="mt-1 rounded border-white/20"
                      />
                      <span className="text-xs text-gray-200">Li e aceito as condições acima.</span>
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 leading-relaxed">
                Devolver o <strong className="text-white">principal</strong> de uma posição OLEXP ativa ao saldo SPOT.
                Yield já creditado ao SPOT mantém-se. Sem o mesmo termo longo do SPOT → OLEXP.
              </p>
            )}

            {!hasSwapKyc && (direction === 'olexp_to_spot' || riskAccepted) ? (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-bold text-white">Confirmação de identidade (primeira vez)</p>
                <p className="text-[10px] text-gray-500">
                  MVP só no dispositivo. TODO: backend + LGPD.
                </p>
                <label className="block text-xs text-gray-400">
                  Nome completo
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                    autoComplete="name"
                  />
                </label>
                <label className="block text-xs text-gray-400">
                  Endereço
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                    autoComplete="street-address"
                  />
                </label>
                <label className="block text-xs text-gray-400">
                  CPF
                  <input
                    value={formatCpfDisplay(cpfDigits)}
                    onChange={(e) => setCpfDigits(digitsOnly(e.target.value, 11))}
                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                  />
                </label>
                <button
                  type="button"
                  disabled={!canSubmitKyc}
                  onClick={handleSaveKyc}
                  className={cn(
                    'w-full py-3 rounded-xl font-display font-bold text-sm uppercase tracking-wider',
                    canSubmitKyc ? 'bg-neon-yellow text-black' : 'bg-white/10 text-gray-500 cursor-not-allowed',
                  )}
                >
                  Guardar identidade
                </button>
              </div>
            ) : !hasSwapKyc && direction === 'spot_to_olexp' && !riskAccepted ? (
              <p className="text-xs text-center text-gray-500">Aceita o risco acima para continuar com a identidade.</p>
            ) : null}

            {hasSwapKyc && direction === 'spot_to_olexp' ? (
              <>
                {!kycOlexpDone ? (
                  <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 text-sm text-gray-300 space-y-3">
                    <p>Para abrir posições OLEXP, precisas de ativar o produto Hold (verificação leve).</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'WALLET_COMPLETE_KYC' })}
                        className="px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-bold uppercase"
                      >
                        Ativar OLEXP aqui
                      </button>
                      <Link
                        to="/wallet/olexp"
                        onClick={resetAndClose}
                        className="px-4 py-2 rounded-lg border border-white/20 text-xs font-bold uppercase text-white"
                      >
                        Ir para Hold
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {OLEXP_PLANS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPlan(p.id)}
                          className={cn(
                            'py-2.5 rounded-xl border text-center text-xs font-bold transition-colors',
                            selectedPlan === p.id
                              ? 'border-purple-400 bg-purple-500/15 text-purple-200'
                              : 'border-white/10 bg-white/5 text-gray-400',
                          )}
                        >
                          {p.days}d
                        </button>
                      ))}
                    </div>
                    <label className="block text-xs text-gray-400">
                      Valor (BRO) — disponível {bro.primary}
                      <input
                        type="number"
                        min={plan.minBroCents / 100}
                        max={finance.broCents / 100}
                        step="0.01"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                      />
                    </label>
                    {amountCents > 0 ? (
                      <p className="text-[11px] text-gray-500">
                        Yield total estimado ~{(est.totalYieldCents / 100).toFixed(2)} BRO (aprox., dias úteis).
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleStake}
                      disabled={!canStake}
                      className={cn(
                        'w-full py-3.5 rounded-xl font-display font-bold text-sm uppercase tracking-wider',
                        canStake ? 'bg-neon-yellow text-black' : 'bg-white/10 text-gray-500 cursor-not-allowed',
                      )}
                    >
                      Confirmar SWAP para OLEXP
                    </button>
                  </>
                )}
              </>
            ) : null}

            {hasSwapKyc && direction === 'olexp_to_spot' ? (
              <div className="space-y-3">
                {activePositions.length === 0 ? (
                  <p className="text-sm text-gray-500">Não tens posições OLEXP ativas para devolver ao SPOT.</p>
                ) : (
                  <>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Principal mínimo por posição para SWAP antecipado OLEXP → SPOT:{' '}
                      <strong className="text-white">{OLEXP_SWAP_OLEXP_TO_SPOT_MIN_BRO_CENTS / 100} BRO</strong>. O yield
                      já creditado ao SPOT (accrual diário) mantém-se.
                    </p>
                    <p className="text-xs text-gray-400">Escolhe a posição:</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {activePositions.map((pos) => {
                        const ok = pos.principalCents >= OLEXP_SWAP_OLEXP_TO_SPOT_MIN_BRO_CENTS;
                        return (
                          <button
                            key={pos.id}
                            type="button"
                            disabled={!ok}
                            onClick={() => ok && setSelectedPositionId(pos.id)}
                            className={cn(
                              'w-full text-left px-4 py-3 rounded-xl border transition-colors',
                              !ok && 'opacity-40 cursor-not-allowed',
                              selectedPositionId === pos.id && ok
                                ? 'border-neon-yellow bg-neon-yellow/10'
                                : 'border-white/10 bg-white/5 hover:border-white/20',
                            )}
                          >
                            <div className="font-bold text-white">{(pos.principalCents / 100).toFixed(2)} BRO</div>
                            <div className="text-[10px] text-gray-500">
                              {pos.planId} · {pos.startDate} → {pos.endDate}
                            </div>
                            {!ok ? (
                              <div className="mt-1 text-[10px] text-amber-400/90">
                                Abaixo do mínimo {OLEXP_SWAP_OLEXP_TO_SPOT_MIN_BRO_CENTS / 100} BRO
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={handleEarlyToSpot}
                      disabled={!selectedPositionId || !canEarlyToSpot}
                      className={cn(
                        'w-full py-3.5 rounded-xl font-display font-bold text-sm uppercase tracking-wider',
                        selectedPositionId && canEarlyToSpot
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/10 text-gray-500 cursor-not-allowed',
                      )}
                    >
                      Confirmar SWAP para SPOT
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
  );
}
