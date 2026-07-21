/**
 * Estornos — lista intents pagas + botão Estornar (ConfirmDialog com valor e
 * comprador) + histórico de payment_refunds. Sub-seção do painel Financeiro.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  fetchPaymentIntents,
  fetchPaymentRefunds,
  refundPaymentIntent,
  type AdminPaymentIntent,
  type AdminPaymentRefund,
} from '@/admin/adminPaymentsClient';

function fmtBRL(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '—';
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso.slice(0, 16);
  }
}

function buyerLabel(i: AdminPaymentIntent): string {
  return i.customer_name || i.customer_email || i.user_id;
}

function statusBadge(status: string): string {
  if (status === 'paid') return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200';
  if (status === 'refunded') return 'border-sky-500/40 bg-sky-500/15 text-sky-200';
  if (status === 'pending') return 'border-amber-500/40 bg-amber-500/15 text-amber-100';
  return 'border-white/15 bg-white/10 text-white/60';
}

export function AdminRefundsSection() {
  const [intents, setIntents] = useState<AdminPaymentIntent[]>([]);
  const [refunds, setRefunds] = useState<AdminPaymentRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<AdminPaymentIntent | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ints, refs] = await Promise.all([fetchPaymentIntents(), fetchPaymentRefunds()]);
      setIntents(ints);
      setRefunds(refs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar pagamentos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const paidIntents = useMemo(() => intents.filter((i) => i.status === 'paid'), [intents]);

  const confirmRefund = async () => {
    if (!target || busy) return;
    setBusy(true);
    setLastMsg(null);
    try {
      const result = await refundPaymentIntent(target.id);
      setLastMsg(
        result?.needs_manual
          ? `Estorno registrado (${fmtBRL(target.amount_cents)}), mas requer ação manual — crédito/jogador já entregue.`
          : `Estorno concluído: ${fmtBRL(target.amount_cents)} de ${buyerLabel(target)}.`,
      );
      setTarget(null);
      await load();
    } catch (e) {
      setLastMsg(`Falha no estorno: ${e instanceof Error ? e.message : 'erro desconhecido'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-white/45">
          Estorno reverte comissões e créditos ainda não coletados; o que já foi
          entregue (BRO aplicado, jogador no plantel) fica marcado como{' '}
          <strong className="text-amber-200/90">ação manual</strong>.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-bold uppercase text-white/70 hover:bg-white/10 disabled:opacity-50"
        >
          <RotateCcw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Atualizar
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      ) : null}
      {lastMsg ? (
        <p className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-xs text-white/80">
          {lastMsg}
        </p>
      ) : null}

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
          Pagamentos pagos ({paidIntents.length})
        </h3>
        <div className="max-h-[420px] overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-black/90">
              <tr className="border-b border-white/10 text-[9px] uppercase text-white/45">
                <th className="px-2 py-2">Data</th>
                <th className="px-2 py-2">Comprador</th>
                <th className="px-2 py-2">Produto</th>
                <th className="px-2 py-2">Valor</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {paidIntents.map((i) => (
                <tr key={i.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="whitespace-nowrap px-2 py-1.5 text-white/55">{fmtDate(i.paid_at ?? i.created_at)}</td>
                  <td className="max-w-[180px] truncate px-2 py-1.5 text-white/85" title={buyerLabel(i)}>
                    {buyerLabel(i)}
                  </td>
                  <td className="px-2 py-1.5 text-white/55">
                    {i.product_kind}
                    {i.product_ref ? ` · ${i.product_ref}` : ''}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-emerald-200">{fmtBRL(i.amount_cents)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => setTarget(i)}
                      className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-[10px] font-bold uppercase text-rose-200 hover:bg-rose-500/10"
                    >
                      Estornar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && paidIntents.length === 0 && (
            <p className="p-8 text-center text-sm text-white/35">Nenhum pagamento pago.</p>
          )}
          {loading && <p className="p-8 text-center text-sm text-white/35">A carregar…</p>}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 font-display text-xs font-bold uppercase tracking-widest text-sky-300/90">
          Estornos realizados ({refunds.length})
        </h3>
        <div className="max-h-[320px] overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-black/90">
              <tr className="border-b border-white/10 text-[9px] uppercase text-white/45">
                <th className="px-2 py-2">Data</th>
                <th className="px-2 py-2">Intent</th>
                <th className="px-2 py-2">Valor</th>
                <th className="px-2 py-2">Motivo</th>
                <th className="px-2 py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="whitespace-nowrap px-2 py-1.5 text-white/55">{fmtDate(r.created_at)}</td>
                  <td className="max-w-[130px] truncate px-2 py-1.5 font-mono text-white/45" title={r.intent_id}>
                    {r.intent_id.slice(0, 8)}…
                  </td>
                  <td className="px-2 py-1.5 font-mono text-white/80">{fmtBRL(r.amount_cents)}</td>
                  <td className="max-w-[160px] truncate px-2 py-1.5 text-white/55" title={r.note ?? r.reason}>
                    {r.reason}
                  </td>
                  <td className="px-2 py-1.5">
                    {r.needs_manual ? (
                      <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-100">
                        <AlertTriangle className="h-3 w-3" />
                        Ação manual
                      </span>
                    ) : (
                      <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase', statusBadge('refunded'))}>
                        {r.auto_reversed ? 'Revertido' : 'Registrado'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && refunds.length === 0 && (
            <p className="p-8 text-center text-sm text-white/35">Nenhum estorno registrado.</p>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={target != null}
        onClose={() => (busy ? null : setTarget(null))}
        onConfirm={() => void confirmRefund()}
        eyebrow="Estorno"
        title="Estornar pagamento?"
        confirmLabel={busy ? 'A estornar…' : 'Estornar'}
        confirmDisabled={busy}
        accent="#fb7185"
      >
        {target ? (
          <div className="mt-3 space-y-1 text-sm text-white/75">
            <p>
              <span className="text-white/45">Valor:</span>{' '}
              <strong className="text-white">{fmtBRL(target.amount_cents)}</strong>
            </p>
            <p className="truncate">
              <span className="text-white/45">Comprador:</span> {buyerLabel(target)}
            </p>
            <p>
              <span className="text-white/45">Produto:</span> {target.product_kind}
              {target.product_ref ? ` · ${target.product_ref}` : ''}
            </p>
            <p className="mt-2 text-xs text-amber-200/80">
              Reverte comissões e créditos não coletados. O que já foi entregue
              vira pendência manual.
            </p>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
