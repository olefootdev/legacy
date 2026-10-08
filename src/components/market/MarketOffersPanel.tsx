/**
 * MarketOffersPanel — painel "Propostas" da negociação P2P.
 *
 *  - RECEBIDAS (sou vendedor): ACEITAR (ConfirmDialog com o valor), NEGAR,
 *    CONTRAPROPOR (input de counter_exp).
 *  - ENVIADAS (sou comprador): status; se 'countered' → aceitar contraproposta +
 *    cancelar; se 'pending' → cancelar.
 *
 * DS 2027: mesa de negociação no concreto; o que pede ação é rua. Copy mínima.
 * Renderiza nada quando não há propostas.
 */
import { useState } from 'react';
import { formatExp } from '@/systems/economy';
import { ConfirmDialog } from '@/components/ui';
import type { MarketOffer } from '@/game/types';
import { useMarketOffers } from '@/hooks/useMarketOffers';
import { L } from '@/i18n/L';
import { cn } from '@/lib/utils';
import { SecaoRua, SeloRua } from '@/components/ui/Rua';
import { CAMPO_RUA } from '@/components/market/rua/escada';

/** Botões da mesa de negociação (DS 2027): quadrados, Anton, sem arredondar. */
const BTN = 'inline-flex min-h-10 items-center justify-center gap-1.5 px-3.5 font-impact text-[15px] uppercase leading-none transition-colors disabled:pointer-events-none disabled:opacity-40';
const BTN_CORRE = cn(BTN, 'bg-rua text-asfalto-27 shadow-[3px_3px_0_var(--color-papel)] hover:-translate-y-px');
const BTN_CONTORNO = cn(BTN, 'border-2 border-papel text-papel hover:bg-papel hover:text-asfalto-27');
const BTN_RUA_CONTORNO = cn(BTN, 'border-2 border-rua text-rua hover:bg-rua hover:text-asfalto-27');

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

  const item = 'border-2 border-linha bg-asfalto-27 p-3';
  return (
    <section className="rua-grao border-2 border-linha bg-concreto p-4 sm:p-5">
      <SecaoRua
        label={L('Negociação', 'Negotiation')}
        aside={
          incoming.length > 0 ? (
            <SeloRua tom="corre">● {incoming.length} {L(incoming.length === 1 ? 'recebida' : 'recebidas', 'received')}</SeloRua>
          ) : undefined
        }
      />
      <h3 className="mt-1 font-voz text-[38px] leading-none text-papel">{L('Propostas na mesa', 'Offers on the table')}</h3>

      {error && <p className="mt-3 text-[13px] font-medium text-baixa">{error}</p>}

      {/* RECEBIDAS */}
      {incoming.length > 0 && (
        <div className="mt-4">
          <div className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
            — {L('Recebidas', 'Received')} ({incoming.length})
          </div>
          <ul className="mt-2 space-y-2">
            {incoming.map((o) => {
              const busy = busyId === o.offerId;
              const value = o.status === 'countered' && o.counterExp != null ? o.counterExp : o.offerExp;
              return (
                <li key={o.offerId} className={item}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-voz text-[24px] leading-none text-papel">{o.playerName}</span>
                    <span className="font-spray text-[22px] font-black leading-none tabular-nums text-papel">{formatExp(value)}</span>
                  </div>
                  <p className="mt-1 font-prova text-[10.5px] uppercase tracking-[0.1em] text-mudo">
                    {o.buyerClubName} · OVR {o.playerOverall}
                    {o.status === 'countered' ? L(' · aguardando o comprador', ' · waiting for the buyer') : ''}
                  </p>

                  {o.status === 'pending' && (
                    <>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={busy} onClick={() => setConfirmAccept(o)} className={BTN_CORRE}>
                          {L('Aceitar', 'Accept')} <span aria-hidden>→</span>
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => run(o.offerId, () => respond(o, 'reject'))}
                          className={BTN_CONTORNO}
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
                          className={BTN_RUA_CONTORNO}
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
                            className={cn(CAMPO_RUA, 'flex-1 py-2 font-spray text-[20px] font-black')}
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
                            className={cn(BTN_CORRE, 'shrink-0')}
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
          <div className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
            — {L('Enviadas', 'Sent')} ({outgoing.length})
          </div>
          <ul className="mt-2 space-y-2">
            {outgoing.map((o) => {
              const busy = busyId === o.offerId;
              return (
                <li key={o.offerId} className={item}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-voz text-[24px] leading-none text-papel">{o.playerName}</span>
                    <span className="font-spray text-[22px] font-black leading-none tabular-nums text-papel">{formatExp(o.offerExp)}</span>
                  </div>
                  <p className="mt-1 font-prova text-[10.5px] uppercase tracking-[0.1em] text-mudo">
                    OVR {o.playerOverall} · <span className={o.status === 'countered' ? 'text-rua' : ''}>{STATUS_LABEL[o.status]}</span>
                    {o.status === 'countered' && o.counterExp != null
                      ? L(` · vendedor pede ${formatExp(o.counterExp)}`, ` · seller asks ${formatExp(o.counterExp)}`)
                      : ''}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {o.status === 'countered' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(o.offerId, () => acceptCounterOffer(o.offerId))}
                        className={BTN_CORRE}
                      >
                        {L('Aceitar contraproposta', 'Accept counter-offer')} <span aria-hidden>→</span>
                      </button>
                    )}
                    {(o.status === 'pending' || o.status === 'countered') && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(o.offerId, () => cancel(o.offerId))}
                        className={BTN_CONTORNO}
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
        accent="var(--color-rua)"
      >
        {confirmAccept && (
          <p className="mt-3 text-sm text-suave">
            {confirmAccept.buyerClubName} {L('oferece', 'offers')}{' '}
            <span className="font-spray text-[20px] font-black text-papel">{formatExp(confirmAccept.offerExp)}</span>.{' '}
            {L('O jogador sai do seu plantel e o EXP é creditado na carteira.', 'The player leaves your squad and the EXP is credited to your wallet.')}
          </p>
        )}
      </ConfirmDialog>
    </section>
  );
}
