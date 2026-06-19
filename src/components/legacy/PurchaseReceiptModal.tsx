import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, X, Wallet } from 'lucide-react';

/**
 * PurchaseReceiptModal — recibo visual após uma compra (OLE/OLEFOOT ou PIX).
 * Substitui o window.alert: mostra o jogador que entrou no elenco e o novo saldo.
 */
export function PurchaseReceiptModal({
  open,
  playerName,
  playerOvr,
  playerPos,
  portrait,
  newBalanceLabel,
  paidWith,
  onClose,
}: {
  open: boolean;
  playerName: string;
  playerOvr: number;
  playerPos: string;
  portrait?: string | null;
  /** Saldo OLEFOOT atualizado, já formatado (ex.: "12.500 OLEFOOT"). null esconde. */
  newBalanceLabel?: string | null;
  paidWith: 'olefoot' | 'pix';
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="w-full max-w-sm overflow-hidden rounded-2xl border-2 border-emerald-400/50 bg-deep-black shadow-[0_0_50px_-8px_rgba(16,185,129,0.45)]"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} /> Compra confirmada
              </span>
              <button type="button" onClick={onClose} className="rounded-full bg-black/50 p-1.5 text-gray-400 hover:text-white" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="relative h-28 w-28 overflow-hidden rounded-xl border border-amber-400/40 bg-black/40">
                {portrait ? (
                  <img src={portrait} alt={playerName} className="h-full w-full object-cover object-top" referrerPolicy="no-referrer" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-amber-400/40 font-display text-3xl">{playerOvr}</div>
                )}
                <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 font-display text-[11px] font-black tabular-nums text-neon-yellow">
                  {playerOvr}
                </span>
              </div>
              <div>
                <p className="break-words font-display text-xl font-black uppercase tracking-wide text-white">{playerName}</p>
                <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300">{playerPos}</p>
              </div>
              <p className="text-[13px] text-white/70">entrou no seu elenco!</p>

              {newBalanceLabel && (
                <div className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] py-2.5">
                  <Wallet className="h-4 w-4 text-white/45" />
                  <span className="text-[11px] uppercase tracking-wider text-white/45">Saldo:</span>
                  <span className="font-display text-[13px] font-black tabular-nums text-white">{newBalanceLabel}</span>
                </div>
              )}
              {paidWith === 'pix' && (
                <p className="text-[10px] text-white/35">Pago via PIX · entrega automática</p>
              )}
            </div>

            <div className="border-t border-white/10 p-4">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-amber-400 py-3 text-sm font-black uppercase tracking-wide text-black transition hover:bg-white"
              >
                Ver meu elenco
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
