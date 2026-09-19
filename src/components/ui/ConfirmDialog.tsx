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
        className="relative w-full max-w-sm overflow-hidden border border-white/10 bg-sheet p-6 pl-7"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent }} aria-hidden />
        <button onClick={onClose} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center text-white/50 hover:text-white" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: accent }}>
          {eyebrow}
        </div>
        <h4 className="mt-1 font-display text-xl font-bold uppercase tracking-wide text-white">{title}</h4>
        {children}
        <div className="mt-5 flex gap-2">
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            style={confirmDisabled ? undefined : { background: accent }}
            className="ole-num flex-1 whitespace-nowrap py-3 text-[13px] uppercase text-black transition-opacity [--corte:12px] [clip-path:var(--clip-corte)] hover:opacity-90 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
          >
            {confirmLabel}
          </button>
          <button
            onClick={onClose}
            className="ole-num whitespace-nowrap border border-white/30 px-4 py-3 text-[12px] uppercase text-white transition-colors hover:border-white"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
