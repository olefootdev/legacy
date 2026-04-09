import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DepositModal({
  open,
  onClose,
  onDeposit,
}: {
  open: boolean;
  onClose: () => void;
  /** Hook futuro para API de pagamento */
  onDeposit?: (payload: { brlAmount: string; note: string }) => void;
}) {
  const [brl, setBrl] = useState('');
  const [note, setNote] = useState('');
  const n = parseFloat(brl.replace(',', '.'));
  const valid = !Number.isNaN(n) && n > 0;

  if (!open) return null;

  const submit = () => {
    if (!valid) return;
    onDeposit?.({ brlAmount: brl, note });
    onClose();
    setBrl('');
    setNote('');
  };

  return (
    <div
      className="fixed inset-0 z-[190] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-white/15 bg-[#0c0c0c] shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-neon-yellow" />
            <h2 className="font-display font-bold text-lg">Depositar</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-400 leading-relaxed">
            MVP: simula pedido de depósito em BRL com conversão para BRO. Integração bancária virá numa próxima fase.
          </p>
          <label className="block text-xs text-gray-400">
            Valor em BRL
            <input
              value={brl}
              onChange={(e) => setBrl(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white"
            />
          </label>
          <label className="block text-xs text-gray-400">
            Nota (opcional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            className={cn(
              'w-full py-3 rounded-xl font-display font-bold uppercase tracking-wider text-sm',
              valid ? 'bg-neon-yellow text-black' : 'bg-white/10 text-gray-500 cursor-not-allowed',
            )}
          >
            Continuar (mock)
          </button>
        </div>
      </motion.div>
    </div>
  );
}
