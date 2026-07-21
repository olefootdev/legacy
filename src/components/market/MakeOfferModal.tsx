/**
 * MakeOfferModal — comprador propõe um valor (EXP) por uma listagem de OUTRO
 * manager. Se já houver proposta pendente/contraproposta minha, mostra o valor
 * atual e permite ATUALIZAR (o servidor faz upsert da proposta pendente).
 *
 * Modal full-screen no padrão do DS (§8.3): overlay preto, rail neon, eyebrow +
 * título display, input de valor, confirmar.
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { formatExp } from '@/systems/economy';
import type { MarketOffer } from '@/game/types';

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
      setError('Informe um valor válido em EXP.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(parsed);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar a proposta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-[var(--radius-lg)] border border-white/12 bg-[#161616] p-6 pl-7"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: 'var(--color-neon-yellow)' }}
          aria-hidden
        />
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-white/40 hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="font-display text-[10px] uppercase tracking-[0.2em] text-neon-yellow">
          {existingOffer ? 'Atualizar proposta' : 'Fazer proposta'}
        </div>
        <h4 className="mt-1 font-display text-2xl font-black uppercase tracking-wide text-white">
          {playerName}
        </h4>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-neon-yellow/80">
          Overall {playerOverall} · pede {formatExp(listPriceExp)}
        </p>

        {existingOffer && (
          <p className="mt-3 rounded-[var(--radius-md)] border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70">
            {existingOffer.status === 'countered' && existingOffer.counterExp != null
              ? `O vendedor contrapropôs ${formatExp(existingOffer.counterExp)}. Podes atualizar a tua oferta.`
              : `Tua proposta atual: ${formatExp(existingOffer.offerExp)} (pendente).`}
          </p>
        )}

        <label className="mt-4 block">
          <span className="font-display text-[10px] uppercase tracking-[0.2em] text-white/50">
            Tua proposta (EXP)
          </span>
          <input
            type="number"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`${listPriceExp}`}
            className="mt-1 w-full rounded-[var(--radius-md)] border border-white/20 bg-black/60 px-3 py-3 font-display text-lg font-bold text-white focus:border-neon-yellow focus:outline-none"
          />
        </label>

        <p className="mt-2 text-[10px] text-white/50">
          Saldo EXP: <span className="font-display font-bold text-white">{formatExp(balanceExp)}</span>
          {overBalance && (
            <span className="mt-1 block text-red-300">
              Aviso: acima do teu saldo — só conseguirás pagar se juntares EXP até o aceite.
            </span>
          )}
        </p>

        {error && <p className="mt-3 text-xs font-medium text-red-400">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={submitting || !valid}
            style={submitting || !valid ? undefined : { background: 'var(--color-neon-yellow)' }}
            className="flex-1 rounded-[var(--radius-md)] py-3 font-display text-sm font-bold uppercase tracking-wide text-black transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
          >
            {submitting ? 'A enviar…' : existingOffer ? 'Atualizar proposta' : 'Enviar proposta'}
          </button>
          <button
            onClick={onClose}
            className="rounded-[var(--radius-md)] border border-white/20 bg-white/[0.06] px-4 py-3 font-display text-xs font-bold uppercase tracking-wide text-white/80 hover:bg-white/10"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
