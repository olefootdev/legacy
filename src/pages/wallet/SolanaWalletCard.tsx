import { useEffect, useState } from 'react';
import { Wallet as WalletIcon, CheckCircle2 } from 'lucide-react';
import {
  connectAndLinkSolanaWallet,
  fetchMyLinkedSolanaWallet,
  hasSolanaWalletInstalled,
} from '@/supabase/solanaWallet';

function truncateAddress(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

/**
 * Vínculo de carteira Solana — ponte mínima pro lançamento (não é claim real
 * ainda, só registra o endereço pra lista de espera). Ver
 * src/supabase/solanaWallet.ts.
 */
export function SolanaWalletCard() {
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchMyLinkedSolanaWallet().then((link) => {
      if (!cancelled) {
        setAddress(link?.walletAddress ?? null);
        setChecked(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const onConnect = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await connectAndLinkSolanaWallet();
      if (!r.ok) {
        setError(r.error ?? 'Não foi possível conectar a carteira.');
        return;
      }
      setAddress(r.address ?? null);
    } finally {
      setBusy(false);
    }
  };

  if (!checked) return null;

  return (
    <section className="relative overflow-hidden rounded-sm border border-white/[0.1] bg-black/70 px-5 py-4 backdrop-blur-md">
      <div className="absolute left-0 top-0 h-full w-1 bg-neon-yellow/90" aria-hidden />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80">
            Carteira Solana
          </p>
          {address ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
              {truncateAddress(address)}
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-white/60">
              Conecte pra garantir sua vaga no claim do $OLE.
            </p>
          )}
        </div>
        {!address && (
          <button
            type="button"
            onClick={() => void onConnect()}
            disabled={busy || !hasSolanaWalletInstalled()}
            className="btn-primary shrink-0 disabled:pointer-events-none disabled:opacity-40"
          >
            <span className="btn-primary-inner flex items-center gap-1.5 px-3 py-1.5">
              <WalletIcon className="h-4 w-4" />
              {busy ? 'Conectando…' : 'Conectar'}
            </span>
          </button>
        )}
      </div>
      {!hasSolanaWalletInstalled() && !address && (
        <p className="mt-2 text-[11px] text-white/40">
          Instale a Phantom (phantom.app) pra conectar.
        </p>
      )}
      {error && <p className="mt-2 text-[11px] text-rose-300">{error}</p>}
    </section>
  );
}
