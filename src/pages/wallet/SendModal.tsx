import { motion } from 'motion/react';
import { X, Send } from 'lucide-react';

export function SendModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
  onSend?: (payload: { bankName: string; agency: string; account: string; cpf: string; amountBrl: string }) => void;
}) {
  if (!open) return null;

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
            <Send className="w-5 h-5 text-neon-yellow" />
            <h2 className="font-display font-bold text-lg">Sacar</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-neon-yellow/30 bg-neon-yellow/10">
            <Send className="h-6 w-6 text-neon-yellow" />
          </div>
          <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white">
            Em breve
          </h3>
          <p className="text-sm leading-relaxed text-white/50">
            Saques para conta bancária via PIX estarão disponíveis em breve. Você será notificado quando ativarmos.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-white/10 py-3 font-display text-sm font-bold uppercase tracking-wider text-white hover:bg-white/15 transition"
          >
            Entendido
          </button>
        </div>
      </motion.div>
    </div>
  );
}
