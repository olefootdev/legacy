import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch } from '@/game/store';
import { normalizeReferralCode } from '@/wallet/referralCode';

function parseBroToCents(raw: string): number | null {
  const t = raw.replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export function PeerBroSendModal({
  open,
  onClose,
  myReferralCode,
}: {
  open: boolean;
  onClose: () => void;
  myReferralCode: string | null;
}) {
  const dispatch = useGameDispatch();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  if (!open) return null;

  const mine = myReferralCode ? normalizeReferralCode(myReferralCode) : null;
  const normDest = normalizeReferralCode(recipient);
  const cents = parseBroToCents(amount);
  const valid =
    normDest &&
    normDest !== mine &&
    cents !== null &&
    cents >= 1;

  const submit = () => {
    setLocalError(null);
    if (!normDest || !cents) return;
    if (mine && normDest === mine) {
      setLocalError('Não podes enviar para o teu próprio código.');
      return;
    }
    dispatch({ type: 'WALLET_TRANSFER_BRO_BY_CODE', recipientCode: normDest, amountCents: cents });
    onClose();
    setRecipient('');
    setAmount('');
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
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-white/15 bg-[#0c0c0c] shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 sticky top-0 bg-[#0c0c0c]">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-neon-yellow" />
            <h2 className="font-display font-bold text-lg">Enviar BRO por código</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-400">
            Usa o código de indicação OLEFOOT do destinatário (3–5 caracteres). O valor sai do teu SPOT BRO; o crédito no outro lado será feito pela plataforma quando existir backend.
          </p>
          <label className="block text-xs text-gray-400">
            Código do destinatário
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
              placeholder="ex. B7K2M"
              maxLength={5}
              className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm"
            />
          </label>
          <label className="block text-xs text-gray-400">
            Valor (BRO)
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
            />
          </label>
          {localError && <p className="text-xs text-red-400">{localError}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            className={cn(
              'w-full py-3 rounded-xl font-display font-bold uppercase tracking-wider text-sm',
              valid ? 'bg-white text-black' : 'bg-white/10 text-gray-500 cursor-not-allowed',
            )}
          >
            Confirmar envio
          </button>
        </div>
      </motion.div>
    </div>
  );
}
