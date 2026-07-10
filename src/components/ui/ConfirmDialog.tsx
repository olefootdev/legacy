import type { ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Modal de confirmação canônico do DS (rail 3px + eyebrow + título display).
 * O corpo (`children`) é livre — custo/saldo/projeção conforme a ação.
 * Reusado antes de qualquer evolução/gasto/compromisso irreversível.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  eyebrow,
  title,
  children,
  confirmLabel = 'Confirmar',
  confirmDisabled = false,
  accent = 'var(--color-neon-yellow)',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  eyebrow: string;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  accent?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-[var(--radius-lg)] border border-white/12 bg-[#161616] p-6 pl-7"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent }} aria-hidden />
        <button onClick={onClose} className="absolute right-3 top-3 text-white/40 hover:text-white" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
        <div className="font-display text-[10px] uppercase tracking-[0.2em]" style={{ color: accent }}>
          {eyebrow}
        </div>
        <h4 className="mt-1 font-display text-xl font-bold uppercase tracking-wide text-white">{title}</h4>
        {children}
        <div className="mt-5 flex gap-2">
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            style={confirmDisabled ? undefined : { background: accent }}
            className="flex-1 rounded-[var(--radius-md)] py-3 font-display text-sm font-bold uppercase tracking-wide text-black transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
          >
            {confirmLabel}
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
