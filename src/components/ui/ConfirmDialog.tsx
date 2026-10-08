import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { L } from '@/i18n/L';

/**
 * Modal de confirmação canônico do DS 2027 (topo de cor + "— rótulo" + título Anton).
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
  confirmLabel = L('Confirmar', 'Confirm'),
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
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4" onClick={onClose}>
      {/* DS 2027: concreto com topo de cor chapada; confirmar é a ação (sombra
          dura de papel), cancelar é contorno. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="rua-grao relative w-full max-w-sm overflow-hidden border-t-[5px] bg-concreto p-6"
        style={{ borderTopColor: accent }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center text-mudo hover:text-papel" aria-label={L('Fechar', 'Close')}>
          <X className="h-5 w-5" strokeWidth={2.4} />
        </button>
        <div className="font-prova text-[11.5px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>
          — {eyebrow}
        </div>
        <h4 className="mt-1.5 pr-8 font-impact text-[30px] uppercase leading-[0.95] text-papel">{title}</h4>
        {children}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            style={confirmDisabled ? undefined : { background: accent }}
            className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 whitespace-nowrap px-4 font-impact text-[19px] uppercase leading-none text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:border-2 disabled:border-dashed disabled:border-fio disabled:bg-transparent disabled:text-mudo disabled:shadow-none"
          >
            {confirmLabel} <span aria-hidden>→</span>
          </button>
          <button
            onClick={onClose}
            className="inline-flex min-h-[52px] items-center whitespace-nowrap border-2 border-papel px-4 font-impact text-[17px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
          >
            {L('Cancelar', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
