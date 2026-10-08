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
 *
 * DS 2027: asfalto com fio de rua no topo; valor em spray; o QR vira um
 * INGRESSO de papel (cal + picote + canhoto com a contagem). Sem gradiente,
 * sem arredondado; ação = rua com sombra dura de papel.
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
import { ACAO_RUA, CAMPO_RUA, FECHAR_RUA, ROTULO_RUA } from '@/components/market/rua/escada';

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
    <div className="flex min-w-0 items-baseline justify-between gap-3 border-[3px] border-ouro-27 bg-asfalto-27 px-3 py-2.5">
      <span className="shrink-0 font-prova text-[10.5px] font-bold uppercase tracking-[0.16em] text-mudo">{L('Você recebe', 'You get')}</span>
      <span className="min-w-0 truncate font-spray text-[20px] font-black leading-none text-ouro-27 tabular-nums">{valor}</span>
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
          className="fixed inset-0 z-[90] flex items-end justify-center bg-asfalto-27/90 p-3 sm:items-center sm:p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.97, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="my-auto flex max-h-[min(90dvh,calc(100dvh-3rem))] w-full max-w-md flex-col overflow-hidden border-2 border-linha border-t-[6px] border-t-rua bg-asfalto-27 sm:max-h-[min(92dvh,800px)]"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b-2 border-linha p-5">
              <div className="min-w-0 flex-1">
                <p className="mb-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
                  — {L('Pagamento PIX', 'Pix payment')}
                </p>
                <h3 className="truncate font-impact text-[24px] uppercase leading-none text-papel">
                  {title}
                </h3>
                <p className="mt-1.5 text-[12px] leading-snug text-suave">{description}</p>
                <p className="mt-3 flex flex-wrap items-baseline gap-x-2 font-prova text-[11px] font-bold uppercase tracking-[0.14em] text-mudo">
                  {/* Depois da cobrança criada, o valor que vale é o do servidor —
                      é ele que está no QR (card: preço USDT × cotação da hora). */}
                  {L('Valor', 'Amount')}
                  <span className="font-spray text-[32px] font-black leading-none tracking-normal text-papel tabular-nums">
                    {fmtBrl(charge?.amountCents ?? amountCents)}
                  </span>
                </p>
              </div>
              <button type="button" onClick={handleClose} className={FECHAR_RUA} aria-label={L('Fechar', 'Close')}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {stage === 'form' && (
                <div className="space-y-4">
                  <p className="text-[12px] text-suave">
                    {L('Dados de cobrança (necessários pela Receita Federal):', 'Billing details (required by Brazilian tax authorities):')}
                  </p>

                  <div>
                    <label className={cn(ROTULO_RUA, 'mb-1.5')}>— {L('Nome completo', 'Full name')}</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={CAMPO_RUA}
                      placeholder={L('Como aparece no documento', 'As it appears on your ID')}
                    />
                  </div>

                  <div>
                    <label className={cn(ROTULO_RUA, 'mb-1.5')}>— E-mail</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={CAMPO_RUA}
                      placeholder={L('seu@email.com', 'you@email.com')}
                    />
                  </div>

                  <div>
                    <label className={cn(ROTULO_RUA, 'mb-1.5')}>— CPF</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cpf}
                      onChange={(e) => setCpf(formatCpf(e.target.value))}
                      className={cn(
                        CAMPO_RUA,
                        'font-prova tabular-nums',
                        cpf.length === 0 ? '' : cpfValid ? 'border-alta/60 focus:border-alta' : 'border-baixa/60 focus:border-baixa',
                      )}
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                    {cpf.length > 0 && !cpfValid && (
                      <p className="mt-1 font-prova text-[10.5px] uppercase tracking-[0.1em] text-baixa">{L('CPF inválido', 'Invalid CPF')}</p>
                    )}
                  </div>

                  <div>
                    <label className={cn(ROTULO_RUA, 'mb-1.5')}>— {L('Telefone (opcional)', 'Phone (optional)')}</label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={cellphone}
                      onChange={(e) => setCellphone(e.target.value)}
                      className={CAMPO_RUA}
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div className="pt-2">
                    <button type="button" onClick={handleSubmit} disabled={!formValid} className={ACAO_RUA}>
                      {L('Gerar PIX', 'Generate Pix')} <span aria-hidden>→</span>
                    </button>
                  </div>

                  <p className="mt-2 inline-flex w-full items-center justify-center gap-1.5 text-center font-prova text-[10px] uppercase tracking-[0.1em] text-mudo">
                    <ShieldCheck className="h-3 w-3" aria-hidden />
                    {L('Processado pelo Mercado Pago · pagamento seguro', 'Processed by Mercado Pago · secure payment')}
                  </p>
                </div>
              )}

              {stage === 'loading' && (
                <div className="flex flex-col items-center justify-center gap-3 py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-rua" aria-hidden />
                  <p className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
                    {L('Gerando seu PIX…', 'Generating your Pix…')}
                  </p>
                </div>
              )}

              {stage === 'waiting' && charge && (
                <div className="space-y-4">
                  {/* ── O INGRESSO: QR no papel, picote, canhoto com a contagem ── */}
                  <div className="flex flex-col">
                    <div className="flex flex-col items-center gap-2 bg-cal p-4 text-asfalto-27">
                      <span className="self-start font-prova text-[10.5px] font-bold uppercase tracking-[0.2em]">
                        {L('Olefoot · PIX', 'Olefoot · Pix')}
                      </span>
                      {charge.brCodeBase64 ? (
                        <div className="bg-white p-2">
                          <img
                            src={
                              charge.brCodeBase64.startsWith('data:')
                                ? charge.brCodeBase64
                                : `data:image/png;base64,${charge.brCodeBase64}`
                            }
                            alt={L('QR Code PIX', 'Pix QR code')}
                            className="h-48 w-48"
                          />
                        </div>
                      ) : (
                        <div className="grid h-48 w-48 place-items-center border-2 border-dashed border-asfalto-27/40">
                          <QrCode className="h-12 w-12 opacity-30" aria-hidden />
                        </div>
                      )}
                      <span className="font-voz text-[22px] leading-none">{L('Aponta e paga.', 'Scan and pay.')}</span>
                    </div>
                    <div aria-hidden className="relative h-3 bg-cal">
                      <span className="rua-picote-h absolute inset-x-0 top-1/2 h-2 -translate-y-1/2" />
                    </div>
                    <div className="flex items-center justify-between gap-3 bg-concreto px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 font-prova text-[10.5px] font-bold uppercase tracking-[0.16em] text-mudo">
                        <Clock className="h-3 w-3" aria-hidden />
                        {L('Expira em', 'Expires in')}
                      </span>
                      <span className="font-spray text-[28px] font-black leading-none text-papel tabular-nums">
                        {countdown > 0 ? formatCountdown(countdown) : L('expirado', 'expired')}
                      </span>
                    </div>
                  </div>

                  {/* Copia e cola */}
                  <div>
                    <label className={cn(ROTULO_RUA, 'mb-1.5')}>— {L('Copia e cola PIX', 'Pix copy and paste')}</label>
                    <div className="flex items-stretch gap-2">
                      <div className="min-w-0 flex-1 border-2 border-linha bg-concreto px-3 py-2.5">
                        <p className="truncate font-prova text-[11px] text-suave">{charge.brCode}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyBrCode}
                        className="grid w-12 shrink-0 place-items-center bg-rua text-asfalto-27 shadow-[3px_3px_0_var(--color-papel)] transition-transform hover:-translate-y-px"
                        aria-label={L('Copiar código PIX', 'Copy Pix code')}
                      >
                        {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                    {copied && (
                      <p className="mt-1.5 inline-flex items-center gap-1 font-prova text-[10.5px] uppercase tracking-[0.1em] text-alta">
                        <CheckCircle2 className="h-3 w-3" aria-hidden /> {L('Código copiado', 'Code copied')}
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

                  <div className="flex items-start gap-2 border-l-[3px] border-rua bg-concreto p-3">
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-rua" aria-hidden />
                    <p className="text-[12px] leading-snug text-papel">
                      {L('Aguardando confirmação do banco…', 'Waiting for bank confirmation…')}
                      <br />
                      <span className="text-[11px] text-mudo">
                        {L('Detectamos automaticamente assim que o PIX cair.', 'We detect it automatically as soon as the Pix lands.')}
                      </span>
                    </p>
                  </div>

                  {charge.devMode && (
                    <p className="text-center font-prova text-[10.5px] uppercase tracking-[0.1em] text-atencao">
                      {L('Modo sandbox (devMode) — pagamento simulado', 'Sandbox mode (devMode) — simulated payment')}
                    </p>
                  )}
                </div>
              )}

              {stage === 'paid' && (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-rua text-asfalto-27">
                    <CheckCircle2 className="h-9 w-9" aria-hidden />
                  </span>
                  <p className="font-voz text-[38px] leading-none text-papel">{L('Caiu.', 'Landed.')}</p>
                  <p className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
                    {L('Pagamento confirmado', 'Payment confirmed')}
                  </p>
                  <p className="text-[13px] text-suave">{paidMessage}</p>
                </div>
              )}

              {stage === 'expired' && (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <Clock className="h-10 w-10 text-baixa" aria-hidden />
                  <p className="font-impact text-[22px] uppercase leading-none text-papel">
                    {L('QR Code expirado', 'QR code expired')}
                  </p>
                  <div className="mt-2 w-full max-w-xs">
                    <button type="button" onClick={() => setStage('form')} className={ACAO_RUA}>
                      {L('Gerar novo PIX', 'Generate new Pix')} <span aria-hidden>→</span>
                    </button>
                  </div>
                </div>
              )}

              {stage === 'error' && (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <AlertTriangle className="h-10 w-10 text-baixa" aria-hidden />
                  <p className="font-impact text-[22px] uppercase leading-none text-papel">
                    {L('Falha no checkout', 'Checkout failed')}
                  </p>
                  {errorMsg && <p className="max-w-xs text-[12px] text-suave">{errorMsg}</p>}
                  <div className="mt-2 w-full max-w-xs">
                    <button type="button" onClick={() => setStage('form')} className={ACAO_RUA}>
                      {L('Tentar de novo', 'Try again')} <span aria-hidden>→</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
