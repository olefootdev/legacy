import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { L } from '@/i18n/L';
import { posLabel } from '@/components/matchquick/posLabel';
import { cn } from '@/lib/utils';
import { MarcaRua } from '@/components/ui/Rua';
import { ACAO_RUA, degrauDe, ovrClasses } from '@/components/market/rua/escada';

/**
 * PurchaseReceiptModal — recibo visual após uma compra (OLEXP ou PIX).
 * Substitui o window.alert: mostra o jogador que entrou no elenco e o novo saldo.
 *
 * DS 2027: o recibo é PAPEL — cal colado torto, picote separando o canhoto do
 * saldo, nome na VOZ. A ação de sair é rua com sombra dura.
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
  /** Saldo OLEFOOT atualizado, já formatado (ex.: "12.500 OLEXP"). null esconde. */
  newBalanceLabel?: string | null;
  paidWith: 'olefoot' | 'pix';
  onClose: () => void;
}) {
  const d = degrauDe(playerOvr);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-asfalto-27/95 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16, rotate: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotate: -1.5 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="w-full max-w-sm"
          >
            {/* ── Corpo do recibo ── */}
            <div className="relative bg-cal text-asfalto-27 shadow-[8px_10px_0_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
                <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em]">
                  — {L('Compra confirmada', 'Purchase confirmed')}
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-9 w-9 shrink-0 place-items-center border-2 border-asfalto-27 transition-colors hover:bg-asfalto-27 hover:text-cal"
                  aria-label={L('Fechar', 'Close')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-end gap-4 px-5 pb-5 pt-2">
                <div className="relative h-32 w-24 shrink-0 overflow-hidden bg-asfalto-27">
                  {portrait ? (
                    <img src={portrait} alt={playerName} className="h-full w-full object-cover object-top" style={{ maxWidth: 'none' }} referrerPolicy="no-referrer" />
                  ) : (
                    <MarcaRua tipo="escudo" className="absolute left-1/2 top-1/2 h-10 -translate-x-1/2 -translate-y-1/2 bg-cal opacity-40" />
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className={cn('font-impact text-[52px] leading-[0.85] tabular-nums', d === 'chao' ? ovrClasses(d) : '')}>
                    {playerOvr}
                  </span>
                  <span className="font-impact text-[15px] uppercase leading-none">{posLabel(playerPos)}</span>
                  <p className="break-words font-voz text-[30px] leading-[0.95] [overflow-wrap:anywhere]">{playerName}</p>
                </div>
              </div>

              <p className="px-5 pb-5 font-voz text-[24px] leading-none">{L('Entrou pro elenco.', 'Joined your squad.')}</p>

              {/* Picote: o canhoto destaca. */}
              <div aria-hidden className="relative h-3">
                <span className="rua-picote-h absolute inset-x-0 top-1/2 h-2 -translate-y-1/2" />
              </div>

              <div className="flex flex-col gap-1 px-5 pb-5 pt-3">
                {newBalanceLabel && (
                  <div className="flex min-w-0 items-baseline justify-between gap-3">
                    <span className="font-prova text-[11px] font-bold uppercase tracking-[0.16em]">{L('Saldo', 'Balance')}</span>
                    <span className="min-w-0 truncate font-spray text-[24px] font-black leading-none tabular-nums">{newBalanceLabel}</span>
                  </div>
                )}
                {paidWith === 'pix' && (
                  <p className="font-prova text-[10.5px] uppercase tracking-[0.12em]">{L('Pago via PIX · entrega automática', 'Paid via PIX · automatic delivery')}</p>
                )}
              </div>
            </div>

            <div className="mt-6 rotate-[1.5deg]">
              <button type="button" onClick={onClose} className={ACAO_RUA}>
                {L('Ver meu elenco', 'View my squad')} <span aria-hidden>→</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
