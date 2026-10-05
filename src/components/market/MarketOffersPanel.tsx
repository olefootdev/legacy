/**
 * MarketOffersPanel — painel "Propostas" da negociação P2P.
 *
 *  - RECEBIDAS (sou vendedor): ACEITAR (ConfirmDialog com o valor), NEGAR,
 *    CONTRAPROPOR (input de counter_exp).
 *  - ENVIADAS (sou comprador): status; se 'countered' → aceitar contraproposta +
 *    cancelar; se 'pending' → cancelar.
 *
 * Reusa primitivos do DS. Copy mínima. Renderiza nada quando não há propostas.
 */
import { useState } from 'react';
import { formatExp } from '@/systems/economy';
import { ConfirmDialog } from '@/components/ui';
import type { MarketOffer } from '@/game/types';
import { useMarketOffers } from '@/hooks/useMarketOffers';
import { L } from '@/i18n/L';

const STATUS_LABEL: Record<MarketOffer['status'], string> = {
  pending: L('Pendente', 'Pending'),
  accepted: L('Aceita', 'Accepted'),
  rejected: L('Negada', 'Rejected'),
  countered: L('Contraproposta', 'Countered'),
  cancelled: L('Cancelada', 'Cancelled'),
  expired: L('Expirada', 'Expired'),
};

export function MarketOffersPanel() {
  const { incoming, outgoing, respond, acceptCounterOffer, cancel } = useMarketOffers();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmAccept, setConfirmAccept] = useState<MarketOffer | null>(null);
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterValue, setCounterValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (incoming.length === 0 && outgoing.length === 0) return null;

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : L('Não foi possível concluir a ação.', 'Could not complete the action.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-lg border border-white/10 bg-panel p-4 sm:p-5">
      <div className="font-display text-[10px] uppercase tracking-[0.2em] text-neon-yellow">{L('Negociação', 'Negotiation')}</div>
      <h3 className="mt-1 font-impact text-2xl uppercase tracking-wide text-white">{L('Propostas', 'Offers')}</h3>

      {error && <p className="mt-3 text-xs font-medium text-baixa">{error}</p>}

      {/* RECEBIDAS */}
      {incoming.length > 0 && (
        <div className="mt-4">
          <div className="font-display text-[10px] uppercase tracking-[0.2em] text-white/50">
            {L('Recebidas', 'Received')} ({incoming.length})
          </div>
          <ul className="mt-2 space-y-2">
            {incoming.map((o) => {
              const busy = busyId === o.offerId;
              const value = o.status === 'countered' && o.counterExp != null ? o.counterExp : o.offerExp;
              return (
                <li key={o.offerId} className="rounded-md border border-white/10 bg-card p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-impact text-base uppercase leading-[1.1] text-white">{o.playerName}</span>
                    <span className="font-display text-sm font-black text-neon-yellow">{formatExp(value)}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-white/50">
                    {o.buyerClubName} · OVR {o.playerOverall}
                    {o.status === 'countered' ? L(' · aguardando o comprador', ' · waiting for the buyer') : ''}
                  </p>

                  {o.status === 'pending' && (
                    <>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmAccept(o)}
                          className="rounded-md bg-neon-yellow px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-white disabled:opacity-40"
                        >
                          {L('Aceitar', 'Accept')}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => run(o.offerId, () => respond(o, 'reject'))}
                          className="rounded-md border border-white/30 bg-transparent px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-white/80 transition-colors hover:border-white hover:bg-white/5 disabled:opacity-40"
                        >
                          {L('Negar', 'Reject')}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setCounterFor(counterFor === o.offerId ? null : o.offerId);
                            setCounterValue('');
                          }}
                          className="rounded-md border border-neon-yellow/40 bg-transparent px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-neon-yellow transition-colors hover:border-neon-yellow disabled:opacity-40"
                        >
                          {L('Contrapropor', 'Counter')}
                        </button>
                      </div>

                      {counterFor === o.offerId && (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={counterValue}
                            onChange={(e) => setCounterValue(e.target.value)}
                            placeholder={L('Valor EXP', 'EXP amount')}
                            className="min-w-0 flex-1 rounded-md border border-white/20 bg-deep-black px-3 py-2 font-display text-sm font-bold text-white focus:border-neon-yellow focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={busy || !(Math.round(Number(counterValue)) > 0)}
                            onClick={() =>
                              run(o.offerId, async () => {
                                await respond(o, 'counter', Math.round(Number(counterValue)));
                                setCounterFor(null);
                              })
                            }
                            className="shrink-0 rounded-md bg-neon-yellow px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
                          >
                            {L('Enviar', 'Send')}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ENVIADAS */}
      {outgoing.length > 0 && (
        <div className="mt-5">
          <div className="font-display text-[10px] uppercase tracking-[0.2em] text-white/50">
            {L('Enviadas', 'Sent')} ({outgoing.length})
          </div>
          <ul className="mt-2 space-y-2">
            {outgoing.map((o) => {
              const busy = busyId === o.offerId;
              return (
                <li key={o.offerId} className="rounded-md border border-white/10 bg-card p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-impact text-base uppercase leading-[1.1] text-white">{o.playerName}</span>
                    <span className="font-display text-sm font-black text-neon-yellow">{formatExp(o.offerExp)}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-white/50">
                    OVR {o.playerOverall} · {STATUS_LABEL[o.status]}
                    {o.status === 'countered' && o.counterExp != null
                      ? L(` · vendedor pede ${formatExp(o.counterExp)}`, ` · seller asks ${formatExp(o.counterExp)}`)
                      : ''}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {o.status === 'countered' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(o.offerId, () => acceptCounterOffer(o.offerId))}
                        className="rounded-md bg-neon-yellow px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-white disabled:opacity-40"
                      >
                        {L('Aceitar contraproposta', 'Accept counter-offer')}
                      </button>
                    )}
                    {(o.status === 'pending' || o.status === 'countered') && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(o.offerId, () => cancel(o.offerId))}
                        className="rounded-md border border-white/30 bg-transparent px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-white/80 transition-colors hover:border-white hover:bg-white/5 disabled:opacity-40"
                      >
                        {L('Cancelar', 'Cancel')}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={confirmAccept != null}
        onClose={() => setConfirmAccept(null)}
        onConfirm={() => {
          const o = confirmAccept;
          setConfirmAccept(null);
          if (o) void run(o.offerId, () => respond(o, 'accept'));
        }}
        eyebrow={L('Aceitar proposta', 'Accept offer')}
        title={confirmAccept?.playerName ?? ''}
        confirmLabel={L('Aceitar e vender', 'Accept and sell')}
        accent="var(--color-neon-yellow)"
      >
        {confirmAccept && (
          <p className="mt-3 text-sm text-white/80">
            {confirmAccept.buyerClubName} {L('oferece', 'offers')}{' '}
            <span className="font-display font-bold text-white">{formatExp(confirmAccept.offerExp)}</span>.{' '}
            {L('O jogador sai do seu plantel e o EXP é creditado na carteira.', 'The player leaves your squad and the EXP is credited to your wallet.')}
          </p>
        )}
      </ConfirmDialog>
    </section>
  );
}
