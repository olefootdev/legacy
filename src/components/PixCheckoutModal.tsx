/**
 * PixCheckoutModal — modal de checkout PIX via Mercado Pago.
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
} from '@/payments/pixClient';
import { L, LOCALE, emIngles } from '@/i18n/L';

interface Props {
  open: boolean;
  productKind: ProductKind;
  productRef?: string;
  amountCents: number; // BRL cents (R$125 = 12500)
  /** Pré-venda: o valor do pack em centavos de DÓLAR. O servidor converte. */
  usdCents?: number;
  /** Pré-venda: 'ativacao_3x' = pack próprio + 1 conta de $10 em cada time. */
  plano?: 'ativacao_3x';
  /** Metadata extra guardada na intent (ex: { player } pra entrega de card). */
  metadata?: Record<string, unknown>;
  title: string;
  description: string;
  /**
   * O que dizer quando o Pix cai. O texto era fixo — "Sua ativação foi
   * processada" — e aparecia igual pra quem tinha depositado ou comprado card.
   */
  paidMessage?: string;
  defaultName?: string;
  defaultEmail?: string;
  onClose: () => void;
  onSuccess: (intentId: string) => void;
}

type Stage = 'form' | 'loading' | 'waiting' | 'paid' | 'expired' | 'error';

function fmtBrl(cents: number): string {
  return emIngles() ? `R$ ${(cents / 100).toFixed(2)}` : `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

/**
 * Traduz o erro técnico do checkout (vindo cru do backend/Mercado Pago) numa
 * mensagem humana em pt-BR. O erro original continua no console pra debug.
 */
function friendlyCheckoutError(raw?: string): string {
  const e = (raw ?? '').toLowerCase();
  // Provedor de pagamento indisponível / mal configurado (token inválido, 502/503).
  if (
    e.includes('access_token') ||
    e.includes('access token') ||
    e.includes('token') ||
    e.includes('inactive') ||
    e.includes('não configurado') ||
    e.includes('mercado') ||
    e.includes('http_5') ||
    e.includes('502') ||
    e.includes('503')
  ) {
    return L('O pagamento via PIX está temporariamente indisponível. Tente novamente em alguns minutos — se persistir, fale com o suporte.', 'Pix payment is temporarily unavailable. Try again in a few minutes — if it persists, contact support.');
  }
  if (e.includes('unauthenticated') || e.includes('unauthorized') || e.includes('401')) {
    return L('Sua sessão expirou. Entre novamente e refaça a compra.', 'Your session expired. Log in again and redo the purchase.');
  }
  if (e.includes('cpf') || e.includes('tax') || e.includes('pagador') || e.includes('inválid')) {
    return L('Confira os dados do pagador (nome, e-mail e CPF) e tente de novo.', "Check the payer's details (name, email and CPF) and try again.");
  }
  return L('Não foi possível gerar o PIX agora. Tente novamente em instantes.', "Couldn't generate the Pix right now. Try again shortly.");
}

// Pré-preenchimento do checkout PIX — guarda NOME e E-MAIL entre compras.
//
// 🔴 CPF e telefone NÃO são guardados. Eram, em claro, no localStorage — que
// qualquer script rodando na página lê, e que sobrevive ao logout. O comentário
// antigo dizia "nada sensível": CPF é o dado que abre conta em banco. Digitar
// onze números de novo custa menos do que isso.
const PIX_PREFILL_KEY = 'olefoot.pix-prefill-v1';
interface PixPrefill {
  name?: string;
  email?: string;
}
function readPixPrefill(): PixPrefill {
  try {
    const bruto = JSON.parse(localStorage.getItem(PIX_PREFILL_KEY) || '{}') as Record<string, unknown>;
    const limpo: PixPrefill = {
      name: typeof bruto.name === 'string' ? bruto.name : undefined,
      email: typeof bruto.email === 'string' ? bruto.email : undefined,
    };
    // Quem já tinha comprado tem CPF gravado da versão anterior: apaga na
    // primeira leitura, em vez de esperar a próxima compra.
    if ('cpf' in bruto || 'cellphone' in bruto) writePixPrefill(limpo);
    return limpo;
  } catch {
    return {};
  }
}
function writePixPrefill(v: PixPrefill): void {
  try {
    localStorage.setItem(PIX_PREFILL_KEY, JSON.stringify({ name: v.name, email: v.email }));
  } catch {
    /* ignore */
  }
}

function Entrega({ valor }: { valor: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 border border-white/10 bg-deep-black px-3 py-2.5">
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-white/50">{L('Você recebe', 'You get')}</span>
      <span className="ole-num min-w-0 truncate text-[15px] text-white tabular-nums">{valor}</span>
    </div>
  );
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
  usdCents,
  plano,
  metadata,
  title,
  description,
  paidMessage = L('Pagamento recebido e entregue.', 'Payment received and delivered.'),
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
      setCpf('');
      setCellphone('');
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
      ...(usdCents != null ? { usdCents } : {}),
      ...(plano ? { plano } : {}),
      ...(metadata ? { metadata } : {}),
      customer: {
        name: name.trim(),
        email: email.trim(),
        taxId: cpf.replace(/\D/g, ''),
        cellphone: cellphone.replace(/\D/g, '') || undefined,
      },
    });

    if (result.ok === false) {
      // O erro técnico (ex: token inválido vindo cru do Mercado Pago)
      // não deve aparecer pro cliente — vai pro console e mostramos algo humano.
      console.warn('[PixCheckout] falha no checkout:', { step: result.step, error: result.error });
      setErrorMsg(friendlyCheckoutError(result.error));
      setStage('error');
      return;
    }

    // Dados aceitos pelo gateway → guarda nome e e-mail pra próxima compra.
    writePixPrefill({ name: name.trim(), email: email.trim() });

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
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/85 p-3 sm:items-center sm:p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="my-auto flex max-h-[min(90dvh,calc(100dvh-3rem))] w-full max-w-md flex-col overflow-hidden rounded-sm border border-white/16 bg-panel sm:max-h-[min(92dvh,800px)]"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-5 border-b border-white/10">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-neon-yellow uppercase tracking-[0.22em] font-display font-black mb-1">
                  {L('Pagamento PIX', 'Pix payment')}
                </p>
                <h3 className="font-display text-lg font-black uppercase tracking-wide text-white truncate">
                  {title}
                </h3>
                <p className="text-[11px] text-white/60 mt-0.5">{description}</p>
                <p className="text-[10px] text-cimento mt-1 font-bold tabular-nums">
                  {/* Depois da cobrança criada, o valor que vale é o do servidor —
                      é ele que está no QR (card: preço USDT × cotação da hora). */}
                  {L('Valor', 'Amount')}: <span className="text-white text-base">{fmtBrl(charge?.amountCents ?? amountCents)}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-sm p-2 text-gray-500 hover:bg-white/10 hover:text-white transition-colors"
                aria-label={L('Fechar', 'Close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {stage === 'form' && (
                <div className="space-y-3">
                  <p className="text-xs text-white/60">
                    {L('Dados de cobrança (necessários pela Receita Federal):', 'Billing details (required by Brazilian tax authorities):')}
                  </p>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/50 font-display font-bold block mb-1">
                      {L('Nome completo', 'Full name')}
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-deep-black border border-white/15 rounded-sm px-3 py-2.5 text-white focus:border-neon-yellow focus:outline-none"
                      placeholder={L('Como aparece no documento', 'As it appears on your ID')}
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
                      className="w-full bg-deep-black border border-white/15 rounded-sm px-3 py-2.5 text-white focus:border-neon-yellow focus:outline-none"
                      placeholder={L('seu@email.com', 'you@email.com')}
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
                        'w-full bg-deep-black border rounded-sm px-3 py-2.5 text-white font-mono tabular-nums focus:outline-none',
                        cpf.length === 0 ? 'border-white/15 focus:border-neon-yellow'
                          : cpfValid ? 'border-alta/50' : 'border-baixa/50',
                      )}
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                    {cpf.length > 0 && !cpfValid && (
                      <p className="text-[10px] text-baixa mt-1">{L('CPF inválido', 'Invalid CPF')}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/50 font-display font-bold block mb-1">
                      {L('Telefone (opcional)', 'Phone (optional)')}
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={cellphone}
                      onChange={(e) => setCellphone(e.target.value)}
                      className="w-full bg-deep-black border border-white/15 rounded-sm px-3 py-2.5 text-white focus:border-neon-yellow focus:outline-none"
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!formValid}
                    className="w-full bg-neon-yellow hover:bg-white text-black py-3.5 mt-2 rounded-sm font-display text-sm font-black uppercase tracking-[0.18em] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {L('Gerar PIX', 'Generate Pix')}
                  </button>

                  <p className="text-[10px] text-white/40 text-center mt-2 inline-flex items-center gap-1.5 justify-center w-full">
                    <ShieldCheck className="w-3 h-3" />
                    {L('Processado pelo Mercado Pago · pagamento seguro', 'Processed by Mercado Pago · secure payment')}
                  </p>
                </div>
              )}

              {stage === 'loading' && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 text-neon-yellow animate-spin" />
                  <p className="text-sm text-white/70 font-display uppercase tracking-wider">
                    {L('Gerando seu PIX…', 'Generating your Pix…')}
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
                        alt={L('QR Code PIX', 'Pix QR code')}
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
                      {L('Copia e cola PIX', 'Pix copy and paste')}
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0 bg-deep-black border border-white/15 rounded-sm px-3 py-2.5">
                        <p className="font-mono text-[11px] text-white/70 truncate">
                          {charge.brCode}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyBrCode}
                        className="shrink-0 bg-neon-yellow hover:bg-white text-black px-3 py-2.5 rounded-sm transition-colors"
                        aria-label={L('Copiar código PIX', 'Copy Pix code')}
                      >
                        {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    {copied && (
                      <p className="text-[10px] text-alta mt-1 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {L('Código copiado', 'Code copied')}
                      </p>
                    )}
                  </div>

                  {/* O que este Pix entrega — número do SERVIDOR, com a cotação
                      congelada. É o que vai ser creditado, não uma prévia. */}
                  {charge.entrega?.broCents != null && (
                    <Entrega valor={`${(charge.entrega.broCents / 100).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BRO`} />
                  )}
                  {charge.entrega?.olefoot != null && (
                    <Entrega valor={`${charge.entrega.olefoot.toLocaleString(LOCALE)} OLEFOOT`} />
                  )}
                  {(charge.entrega?.satelites ?? 0) > 0 && (
                    <Entrega valor={L(`+ ${charge.entrega!.satelites} contas de $10 · 1 em cada time`, `+ ${charge.entrega!.satelites} $10 accounts · 1 in each team`)} />
                  )}

                  {/* Countdown + polling status */}
                  <div className="flex items-center justify-between bg-deep-black border border-white/10 rounded-sm px-3 py-2">
                    <span className="text-[10px] text-white/50 uppercase tracking-wider inline-flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {L('Expira em', 'Expires in')}
                    </span>
                    <span className="font-display text-sm font-black text-neon-yellow tabular-nums">
                      {countdown > 0 ? formatCountdown(countdown) : L('expirado', 'expired')}
                    </span>
                  </div>

                  <div className="bg-deep-black border border-white/10 rounded-sm p-3 flex items-start gap-2">
                    <Loader2 className="w-4 h-4 text-giz animate-spin shrink-0 mt-0.5" />
                    <p className="text-[11px] text-giz leading-snug">
                      {L('Aguardando confirmação do banco…', 'Waiting for bank confirmation…')}
                      <br />
                      <span className="text-cimento text-[10px]">
                        {L('Detectamos automaticamente assim que o PIX cair.', 'We detect it automatically as soon as the Pix lands.')}
                      </span>
                    </p>
                  </div>

                  {charge.devMode && (
                    <p className="text-[10px] text-atencao text-center">
                      {L('Modo sandbox (devMode) — pagamento simulado', 'Sandbox mode (devMode) — simulated payment')}
                    </p>
                  )}
                </div>
              )}

              {stage === 'paid' && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="border border-alta/40 bg-deep-black p-3 rounded-full">
                    <CheckCircle2 className="w-12 h-12 text-alta" />
                  </div>
                  <p className="font-display text-lg font-black uppercase tracking-wider text-alta">
                    {L('Pagamento confirmado', 'Payment confirmed')}
                  </p>
                  <p className="text-xs text-white/60 text-center">{paidMessage}</p>
                </div>
              )}

              {stage === 'expired' && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="border border-baixa/40 bg-deep-black p-3 rounded-full">
                    <Clock className="w-12 h-12 text-baixa" />
                  </div>
                  <p className="font-display text-base font-black uppercase tracking-wider text-baixa">
                    {L('QR Code expirado', 'QR code expired')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setStage('form')}
                    className="mt-2 bg-neon-yellow hover:bg-white text-black px-5 py-2.5 rounded-sm font-display text-xs font-black uppercase tracking-[0.18em] transition-colors"
                  >
                    {L('Gerar novo PIX', 'Generate new Pix')}
                  </button>
                </div>
              )}

              {stage === 'error' && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="border border-baixa/40 bg-deep-black p-3 rounded-full">
                    <AlertTriangle className="w-12 h-12 text-baixa" />
                  </div>
                  <p className="font-display text-base font-black uppercase tracking-wider text-baixa">
                    {L('Falha no checkout', 'Checkout failed')}
                  </p>
                  {errorMsg && (
                    <p className="text-[11px] text-white/50 text-center max-w-xs">{errorMsg}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setStage('form')}
                    className="mt-2 bg-neon-yellow hover:bg-white text-black px-5 py-2.5 rounded-sm font-display text-xs font-black uppercase tracking-[0.18em] transition-colors"
                  >
                    {L('Tentar novamente', 'Try again')}
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
