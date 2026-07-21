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

const STATUS_LABEL: Record<MarketOffer['status'], string> = {
  pending: 'Pendente',
  accepted: 'Aceita',
  rejected: 'Negada',
  countered: 'Contraproposta',
  cancelled: 'Cancelada',
  expired: 'Expirada',
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
      setError(e instanceof Error ? e.message : 'Não foi possível concluir a ação.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-[var(--radius-lg)] border border-white/10 bg-black/40 p-4 sm:p-5">
      <div className="font-display text-[10px] uppercase tracking-[0.2em] text-neon-yellow">Negociação</div>
      <h3 className="mt-1 font-impact text-2xl uppercase tracking-wide text-white">Propostas</h3>

      {error && <p className="mt-3 text-xs font-medium text-red-400">{error}</p>}

      {/* RECEBIDAS */}
      {incoming.length > 0 && (
        <div className="mt-4">
          <div className="font-display text-[10px] uppercase tracking-[0.2em] text-white/50">
            Recebidas ({incoming.length})
          </div>
          <ul className="mt-2 space-y-2">
            {incoming.map((o) => {
              const busy = busyId === o.offerId;
              const value = o.status === 'countered' && o.counterExp != null ? o.counterExp : o.offerExp;
              return (
                <li key={o.offerId} className="rounded-[var(--radius-md)] border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-impact text-base uppercase leading-none text-white">{o.playerName}</span>
                    <span className="font-display text-sm font-black text-neon-yellow">{formatExp(value)}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-white/50">
                    {o.buyerClubName} · OVR {o.playerOverall}
                    {o.status === 'countered' ? ' · aguardando o comprador' : ''}
                  </p>

                  {o.status === 'pending' && (
                    <>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmAccept(o)}
                          className="rounded-[var(--radius-md)] bg-neon-green px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-black hover:bg-white disabled:opacity-40"
                        >
                          Aceitar
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => run(o.offerId, () => respond(o, 'reject'))}
                          className="rounded-[var(--radius-md)] border border-white/20 bg-white/[0.06] px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-white/80 hover:bg-white/10 disabled:opacity-40"
                        >
                          Negar
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setCounterFor(counterFor === o.offerId ? null : o.offerId);
                            setCounterValue('');
                          }}
                          className="rounded-[var(--radius-md)] border border-neon-yellow/40 bg-neon-yellow/10 px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-neon-yellow hover:bg-neon-yellow/20 disabled:opacity-40"
                        >
                          Contrapropor
                        </button>
                      </div>

                      {counterFor === o.offerId && (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={counterValue}
                            onChange={(e) => setCounterValue(e.target.value)}
                            placeholder="Valor EXP"
                            className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-white/20 bg-black/60 px-3 py-2 font-display text-sm font-bold text-white focus:border-neon-yellow focus:outline-none"
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
                            className="shrink-0 rounded-[var(--radius-md)] bg-neon-yellow px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-black hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
                          >
                            Enviar
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
            Enviadas ({outgoing.length})
          </div>
          <ul className="mt-2 space-y-2">
            {outgoing.map((o) => {
              const busy = busyId === o.offerId;
              return (
                <li key={o.offerId} className="rounded-[var(--radius-md)] border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-impact text-base uppercase leading-none text-white">{o.playerName}</span>
                    <span className="font-display text-sm font-black text-neon-yellow">{formatExp(o.offerExp)}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-white/50">
                    OVR {o.playerOverall} · {STATUS_LABEL[o.status]}
                    {o.status === 'countered' && o.counterExp != null
                      ? ` · vendedor pede ${formatExp(o.counterExp)}`
                      : ''}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {o.status === 'countered' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(o.offerId, () => acceptCounterOffer(o.offerId))}
                        className="rounded-[var(--radius-md)] bg-neon-green px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-black hover:bg-white disabled:opacity-40"
                      >
                        Aceitar contraproposta
                      </button>
                    )}
                    {(o.status === 'pending' || o.status === 'countered') && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(o.offerId, () => cancel(o.offerId))}
                        className="rounded-[var(--radius-md)] border border-white/20 bg-white/[0.06] px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-white/80 hover:bg-white/10 disabled:opacity-40"
                      >
                        Cancelar
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
        eyebrow="Aceitar proposta"
        title={confirmAccept?.playerName ?? ''}
        confirmLabel="Aceitar e vender"
        accent="var(--color-neon-green, #00FF66)"
      >
        {confirmAccept && (
          <p className="mt-3 text-sm text-white/80">
            {confirmAccept.buyerClubName} oferece{' '}
            <span className="font-display font-bold text-white">{formatExp(confirmAccept.offerExp)}</span>. O
            jogador sai do teu plantel e o EXP é creditado na carteira.
          </p>
        )}
      </ConfirmDialog>
    </section>
  );
}
