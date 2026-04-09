import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SendModal({
  open,
  onClose,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  onSend?: (payload: { bankName: string; agency: string; account: string; cpf: string; amountBrl: string }) => void;
}) {
  const [bankName, setBankName] = useState('');
  const [agency, setAgency] = useState('');
  const [account, setAccount] = useState('');
  const [cpf, setCpf] = useState('');
  const [amountBrl, setAmountBrl] = useState('');

  const valid =
    bankName.trim().length >= 2 &&
    agency.trim().length >= 1 &&
    account.trim().length >= 4 &&
    cpf.replace(/\D/g, '').length >= 11 &&
    parseFloat(amountBrl.replace(',', '.')) > 0;

  if (!open) return null;

  const submit = () => {
    if (!valid) return;
    onSend?.({ bankName, agency, account, cpf, amountBrl });
    onClose();
    setBankName('');
    setAgency('');
    setAccount('');
    setCpf('');
    setAmountBrl('');
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
            <h2 className="font-display font-bold text-lg">Enviar</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-400">
            Converter e enviar para conta bancária no Brasil (fluxo MVP — sem API real).
          </p>
          <label className="block text-xs text-gray-400">
            Banco
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm" />
          </label>
          <label className="block text-xs text-gray-400">
            Agência
            <input value={agency} onChange={(e) => setAgency(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm" />
          </label>
          <label className="block text-xs text-gray-400">
            Conta
            <input value={account} onChange={(e) => setAccount(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm" />
          </label>
          <label className="block text-xs text-gray-400">
            CPF/CNPJ titular
            <input value={cpf} onChange={(e) => setCpf(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm" />
          </label>
          <label className="block text-xs text-gray-400">
            Valor (BRL)
            <input value={amountBrl} onChange={(e) => setAmountBrl(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm" />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            className={cn(
              'w-full py-3 rounded-xl font-display font-bold uppercase tracking-wider text-sm',
              valid ? 'bg-white text-black' : 'bg-white/10 text-gray-500 cursor-not-allowed',
            )}
          >
            Pedir transferência (mock)
          </button>
        </div>
      </motion.div>
    </div>
  );
}
