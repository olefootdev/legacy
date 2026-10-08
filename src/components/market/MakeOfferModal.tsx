/**
 * MakeOfferModal — comprador propõe um valor (EXP) por uma listagem de OUTRO
 * manager. Se já houver proposta pendente/contraproposta minha, mostra o valor
 * atual e permite ATUALIZAR (o servidor faz upsert da proposta pendente).
 *
 * DS 2027: asfalto com fio de rua no topo (é negociação = ação), nome na VOZ,
 * valor em spray, botão rua com sombra dura de papel.
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { formatExp } from '@/systems/economy';
import type { MarketOffer } from '@/game/types';
import { L } from '@/i18n/L';
import { cn } from '@/lib/utils';
import { ACAO_CONTORNO, ACAO_RUA, CAMPO_RUA, FECHAR_RUA, ROTULO_RUA } from '@/components/market/rua/escada';

export function MakeOfferModal({
  open,
  onClose,
  playerName,
  playerOverall,
  listPriceExp,
  balanceExp,
  existingOffer,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  playerName: string;
  playerOverall: number;
  listPriceExp: number;
  balanceExp: number;
  existingOffer?: MarketOffer;
  onSubmit: (offerExp: number) => Promise<void>;
}) {
  const [value, setValue] = useState<string>(() =>
    existingOffer ? String(existingOffer.offerExp) : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const parsed = Math.round(Number(value));
  const valid = Number.isFinite(parsed) && parsed > 0;
  const overBalance = valid && parsed > balanceExp;

  const handleConfirm = async () => {
    if (!valid) {
      setError(L('Informe um valor válido em EXP.', 'Enter a valid EXP amount.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(parsed);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : L('Não foi possível enviar a proposta.', 'Could not send the offer.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-asfalto-27/90 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md border-2 border-linha border-t-[6px] border-t-rua bg-asfalto-27 p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
            — {existingOffer ? L('Atualizar proposta', 'Update offer') : L('Fazer proposta', 'Make offer')}
          </span>
          <button onClick={onClose} className={FECHAR_RUA} aria-label={L('Fechar', 'Close')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <h4 className="mt-1 break-words font-voz text-[40px] leading-[0.9] text-papel [overflow-wrap:anywhere]">
          {playerName}
        </h4>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 font-impact uppercase leading-none">
          <span className="text-[18px] text-suave">OVR {playerOverall}</span>
          <span className="text-[18px] text-papel">
            {L('pede', 'asking')} {formatExp(listPriceExp)}
          </span>
        </p>

        {existingOffer && (
          <p className="mt-4 border-l-[3px] border-rua pl-3 text-[13px] text-suave">
            {existingOffer.status === 'countered' && existingOffer.counterExp != null
              ? L(`O vendedor contrapropôs ${formatExp(existingOffer.counterExp)}. Você pode atualizar sua oferta.`, `The seller countered with ${formatExp(existingOffer.counterExp)}. You can update your offer.`)
              : L(`Sua proposta atual: ${formatExp(existingOffer.offerExp)} (pendente).`, `Your current offer: ${formatExp(existingOffer.offerExp)} (pending).`)}
          </p>
        )}

        <label className="mt-5 block">
          <span className={ROTULO_RUA}>— {L('Sua proposta (EXP)', 'Your offer (EXP)')}</span>
          <input
            type="number"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`${listPriceExp}`}
            className={cn(CAMPO_RUA, 'mt-2 font-spray text-[28px] font-black tabular-nums')}
          />
        </label>

        <p className="mt-2 font-prova text-[11px] uppercase tracking-[0.12em] text-mudo">
          {L('Saldo EXP', 'EXP balance')}: <span className="font-impact text-[15px] tracking-normal text-ouro-27">{formatExp(balanceExp)}</span>
          {overBalance && (
            <span className="mt-1.5 block normal-case tracking-normal text-atencao">
              {L('Aviso: acima do seu saldo — só dá pra pagar se juntar EXP até o aceite.', 'Warning: above your balance — you can only pay if you have enough EXP when it is accepted.')}
            </span>
          )}
        </p>

        {error && <p className="mt-3 text-[13px] font-medium text-baixa">{error}</p>}

        <div className="mt-6 grid grid-cols-[1fr_auto] gap-3">
          <button onClick={handleConfirm} disabled={submitting || !valid} className={ACAO_RUA}>
            {submitting ? L('Enviando…', 'Sending…') : existingOffer ? L('Atualizar', 'Update') : L('Enviar proposta', 'Send offer')}
            {!submitting && <span aria-hidden>→</span>}
          </button>
          <button onClick={onClose} className={cn(ACAO_CONTORNO, 'min-h-[52px] w-auto px-4')}>
            {L('Cancelar', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
