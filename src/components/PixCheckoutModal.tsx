/**
 * PixCheckoutModal — modal de checkout PIX via Abacate Pay.
 *
 * Estados:
 *   1. form     — coleta CPF/Nome/Email/Telefone
 *   2. loading  — chama backend Hono
 *   3. waiting  — mostra QR + copy/paste, faz polling 3s
 *   4. paid     — sucesso, fecha modal e chama onSuccess()
 *   5. expired  — QR expirou (1h), oferece retry
 *   6. error    — falha no checkout
 *
 * Polling: a cada 3s consulta status do intent. Quando vier "paid", para.
 * Webhook é o canal principal — polling é safety net.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  createPixCharge,
  fetchPaymentStatus,
  formatCpf,
  isValidCpf,
  type ProductKind,
  type CreatePixResult,
} from '@/payments/abacatepayClient';

interface Props {
  open: boolean;
  productKind: ProductKind;
  productRef?: string;
  amountCents: number; // BRL cents (R$125 = 12500)
  /** Metadata extra guardada na intent (ex: { player } pra entrega de card). */
  metadata?: Record<string, unknown>;
  title: string;
  description: string;
  defaultName?: string;
  defaultEmail?: string;
  onClose: () => void;
  onSuccess: (intentId: string) => void;
}

type Stage = 'form' | 'loading' | 'waiting' | 'paid' | 'expired' | 'error';

function fmtBrl(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

// Pré-preenchimento do checkout PIX — guarda os dados do pagador entre compras
// (sem re-digitar CPF/telefone). Só dados de contato, nada sensível de pagamento.
const PIX_PREFILL_KEY = 'olefoot.pix-prefill-v1';
interface PixPrefill {
  name?: string;
  email?: string;
  cpf?: string;
  cellphone?: string;
}
function readPixPrefill(): PixPrefill {
  try {
    return JSON.parse(localStorage.getItem(PIX_PREFILL_KEY) || '{}') as PixPrefill;
  } catch {
    return {};
  }
}
function writePixPrefill(v: PixPrefill): void {
  try {
    localStorage.setItem(PIX_PREFILL_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

function secondsLeft(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function PixCheckoutModal({
  open,
  productKind,
  productRef,
  amountCents,
  metadata,
  title,
  description,
  defaultName = '',
  defaultEmail = '',
  onClose,
  onSuccess,
}: Props) {
  const [stage, setStage] = useState<Stage>('form');
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [cpf, setCpf] = useState('');
  const [cellphone, setCellphone] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [charge, setCharge] = useState<CreatePixResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const pollRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  // Cleanup on unmount / close
  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  // Reseta quando abre — e pré-preenche com os dados salvos da última compra.
  useEffect(() => {
    if (open) {
      setStage('form');
      setErrorMsg(null);
      setCharge(null);
      setCopied(false);
      const saved = readPixPrefill();
      setName(saved.name || defaultName);
      setEmail(saved.email || defaultEmail);
      setCpf(saved.cpf ? formatCpf(saved.cpf) : '');
      setCellphone(saved.cellphone || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cpfValid = useMemo(() => isValidCpf(cpf), [cpf]);
  const emailValid = useMemo(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), [email]);
  const formValid = name.trim().length >= 3 && emailValid && cpfValid;

  const handleSubmit = async () => {
    if (!formValid) return;
    setStage('loading');
    setErrorMsg(null);

    const result = await createPixCharge({
      productKind,
      productRef,
      amountCents,
      ...(metadata ? { metadata } : {}),
      customer: {
        name: name.trim(),
        email: email.trim(),
        taxId: cpf.replace(/\D/g, ''),
        cellphone: cellphone.replace(/\D/g, '') || undefined,
      },
    });

    if (result.ok === false) {
      setErrorMsg(result.error);
      setStage('error');
      return;
    }

    // Dados aceitos pelo gateway → guarda pra próxima compra não re-digitar.
    writePixPrefill({
      name: name.trim(),
      email: email.trim(),
      cpf: cpf.replace(/\D/g, ''),
      cellphone: cellphone.replace(/\D/g, ''),
    });

    setCharge(result);
    setStage('waiting');

    // Countdown visual (1 tick por segundo)
    setCountdown(secondsLeft(result.expiresAt ?? null));
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    // Polling 3s
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      const status = await fetchPaymentStatus(result.intentId);
      if (!status) return;
      if (status.status === 'paid') {
        if (pollRef.current) window.clearInterval(pollRef.current);
        if (tickRef.current) window.clearInterval(tickRef.current);
        setStage('paid');
        setTimeout(() => {
          onSuccess(result.intentId);
        }, 1500);
      } else if (status.status === 'expired' || status.status === 'cancelled' || status.status === 'failed') {
        if (pollRef.current) window.clearInterval(pollRef.current);
        if (tickRef.current) window.clearInterval(tickRef.current);
        setStage('expired');
      }
    }, 3000);
  };

  const handleCopyBrCode = async () => {
    if (!charge?.brCode) return;
    await navigator.clipboard.writeText(charge.brCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClose = () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (tickRef.current) window.clearInterval(tickRef.current);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/85 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="my-auto flex max-h-[min(90dvh,calc(100dvh-3rem))] w-full max-w-md flex-col overflow-hidden rounded-sm border border-amber-400/40 bg-panel sm:max-h-[min(92dvh,800px)]"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-5 border-b border-white/10">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-amber-300 uppercase tracking-[0.22em] font-display font-black mb-1">
                  Pagamento PIX
                </p>
                <h3 className="font-display text-lg font-black uppercase tracking-wide text-white truncate">
                  {title}
                </h3>
                <p className="text-[11px] text-white/60 mt-0.5">{description}</p>
                <p className="text-[10px] text-amber-300/80 mt-1 font-bold tabular-nums">
                  Valor: <span className="text-amber-300 text-base">{fmtBrl(amountCents)}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-sm p-2 text-gray-500 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {stage === 'form' && (
                <div className="space-y-3">
                  <p className="text-xs text-white/60">
                    Dados de cobrança (necessários pela Receita Federal):
                  </p>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/50 font-display font-bold block mb-1">
                      Nome completo
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-black/50 border border-white/15 rounded-sm px-3 py-2.5 text-white focus:border-amber-400/60 focus:outline-none"
                      placeholder="Como aparece no documento"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/50 font-display font-bold block mb-1">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-black/50 border border-white/15 rounded-sm px-3 py-2.5 text-white focus:border-amber-400/60 focus:outline-none"
                      placeholder="seu@email.com"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/50 font-display font-bold block mb-1">
                      CPF
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cpf}
                      onChange={(e) => setCpf(formatCpf(e.target.value))}
                      className={cn(
                        'w-full bg-black/50 border rounded-sm px-3 py-2.5 text-white font-mono tabular-nums focus:outline-none',
                        cpf.length === 0 ? 'border-white/15 focus:border-amber-400/60'
                          : cpfValid ? 'border-emerald-500/40' : 'border-rose-500/40',
                      )}
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                    {cpf.length > 0 && !cpfValid && (
                      <p className="text-[10px] text-rose-300 mt-1">CPF inválido</p>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/50 font-display font-bold block mb-1">
                      Telefone (opcional)
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={cellphone}
                      onChange={(e) => setCellphone(e.target.value)}
                      className="w-full bg-black/50 border border-white/15 rounded-sm px-3 py-2.5 text-white focus:border-amber-400/60 focus:outline-none"
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!formValid}
                    className="w-full bg-amber-400 hover:bg-white text-black py-3.5 mt-2 rounded-sm font-display text-sm font-black uppercase tracking-[0.18em] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Gerar PIX
                  </button>

                  <p className="text-[10px] text-white/40 text-center mt-2 inline-flex items-center gap-1.5 justify-center w-full">
                    <ShieldCheck className="w-3 h-3" />
                    Processado pela Abacate Pay · pagamento seguro
                  </p>
                </div>
              )}

              {stage === 'loading' && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 text-amber-300 animate-spin" />
                  <p className="text-sm text-white/70 font-display uppercase tracking-wider">
                    Gerando seu PIX…
                  </p>
                </div>
              )}

              {stage === 'waiting' && charge && (
                <div className="space-y-4">
                  {/* QR Code */}
                  {charge.brCodeBase64 && (
                    <div className="bg-white p-3 rounded-sm flex items-center justify-center">
                      <img
                        src={
                          charge.brCodeBase64.startsWith('data:')
                            ? charge.brCodeBase64
                            : `data:image/png;base64,${charge.brCodeBase64}`
                        }
                        alt="QR Code PIX"
                        className="w-48 h-48"
                      />
                    </div>
                  )}

                  {!charge.brCodeBase64 && (
                    <div className="bg-panel border border-dashed border-white/15 p-8 rounded-sm flex items-center justify-center">
                      <QrCode className="w-12 h-12 text-white/20" />
                    </div>
                  )}

                  {/* Copy-paste */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/50 font-display font-bold block mb-1">
                      Copia e cola PIX
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0 bg-black/50 border border-white/15 rounded-sm px-3 py-2.5">
                        <p className="font-mono text-[11px] text-white/70 truncate">
                          {charge.brCode}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyBrCode}
                        className="shrink-0 bg-amber-400 hover:bg-white text-black px-3 py-2.5 rounded-sm transition-colors"
                        aria-label="Copiar código PIX"
                      >
                        {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    {copied && (
                      <p className="text-[10px] text-emerald-300 mt-1 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Código copiado
                      </p>
                    )}
                  </div>

                  {/* Countdown + polling status */}
                  <div className="flex items-center justify-between bg-black/40 border border-white/5 rounded-sm px-3 py-2">
                    <span className="text-[10px] text-white/50 uppercase tracking-wider inline-flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      Expira em
                    </span>
                    <span className="font-display text-sm font-black text-amber-300 tabular-nums">
                      {countdown > 0 ? formatCountdown(countdown) : 'expirado'}
                    </span>
                  </div>

                  <div className="bg-cyan-500/10 border border-cyan-400/30 rounded-sm p-3 flex items-start gap-2">
                    <Loader2 className="w-4 h-4 text-cyan-300 animate-spin shrink-0 mt-0.5" />
                    <p className="text-[11px] text-cyan-200 leading-snug">
                      Aguardando confirmação do banco…
                      <br />
                      <span className="text-cyan-300/70 text-[10px]">
                        Detectamos automaticamente assim que o PIX cair.
                      </span>
                    </p>
                  </div>

                  {charge.devMode && (
                    <p className="text-[10px] text-amber-300/70 text-center italic">
                      Modo sandbox (devMode) — pagamento simulado
                    </p>
                  )}
                </div>
              )}

              {stage === 'paid' && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="bg-emerald-500/20 p-3 rounded-full">
                    <CheckCircle2 className="w-12 h-12 text-emerald-300" />
                  </div>
                  <p className="font-display text-lg font-black uppercase tracking-wider text-emerald-300">
                    Pagamento confirmado
                  </p>
                  <p className="text-xs text-white/60 text-center">
                    Sua ativação foi processada com sucesso.
                  </p>
                </div>
              )}

              {stage === 'expired' && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="bg-rose-500/20 p-3 rounded-full">
                    <Clock className="w-12 h-12 text-rose-300" />
                  </div>
                  <p className="font-display text-base font-black uppercase tracking-wider text-rose-300">
                    QR Code expirado
                  </p>
                  <button
                    type="button"
                    onClick={() => setStage('form')}
                    className="mt-2 bg-amber-400 hover:bg-white text-black px-5 py-2.5 rounded-sm font-display text-xs font-black uppercase tracking-[0.18em] transition-colors"
                  >
                    Gerar novo PIX
                  </button>
                </div>
              )}

              {stage === 'error' && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="bg-rose-500/20 p-3 rounded-full">
                    <AlertTriangle className="w-12 h-12 text-rose-300" />
                  </div>
                  <p className="font-display text-base font-black uppercase tracking-wider text-rose-300">
                    Falha no checkout
                  </p>
                  {errorMsg && (
                    <p className="text-[11px] text-white/50 text-center max-w-xs">{errorMsg}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setStage('form')}
                    className="mt-2 bg-amber-400 hover:bg-white text-black px-5 py-2.5 rounded-sm font-display text-xs font-black uppercase tracking-[0.18em] transition-colors"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
