import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { conectarOleWallet, oleWalletDisponivel } from '@/supabase/oleWalletConnect';
import {
  connectAndLinkSolanaWallet,
  fetchMyLinkedSolanaWallet,
  listSolanaWallets,
  onSolanaWalletsChange,
  type SolanaWalletLink,
  type SolanaWalletOption,
} from '@/supabase/solanaWallet';

function truncateAddress(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

/**
 * Vínculo de carteira Solana com prova de posse (A VIRADA · C1). Lista toda
 * carteira Solana instalada pelo Wallet Standard — não só a Phantom — e só
 * vincula depois que a própria carteira assina. Ver src/supabase/solanaWallet.ts.
 *
 * VOLT2: categoria em #hashtag, uma linha por texto, a ação é o nome da carteira.
 */
export function SolanaWalletCard() {
  const [link, setLink] = useState<SolanaWalletLink | null>(null);
  const [wallets, setWallets] = useState<SolanaWalletOption[]>(() => listSolanaWallets());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchMyLinkedSolanaWallet().then((l) => {
      if (!cancelled) {
        setLink(l);
        setChecked(true);
      }
    });
    const off = onSolanaWalletsChange(() => setWallets(listSolanaWallets()));
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  /**
   * A OLEWALLET não é extensão: ela mora em olefoot.com e abre numa janela.
   * Fica em PRIMEIRO na lista de propósito — é a nossa, e é a única que quem
   * nunca teve carteira consegue criar na hora.
   */
  const onLinkOleWallet = async () => {
    if (busy) return;
    setBusy('OLEWALLET');
    setError(null);
    try {
      const r = await conectarOleWallet();
      if (!r.ok || !r.address) {
        setError(r.error ?? 'Não foi possível vincular a OLEWALLET.');
        return;
      }
      setLink({ walletAddress: r.address, verified: true, linkedAt: new Date().toISOString() });
    } finally {
      setBusy(null);
    }
  };

  const onLink = async (option: SolanaWalletOption) => {
    if (busy) return;
    setBusy(option.name);
    setError(null);
    try {
      const r = await connectAndLinkSolanaWallet(option);
      if (!r.ok || !r.address) {
        setError(r.error ?? 'Não foi possível vincular a carteira.');
        return;
      }
      setLink({ walletAddress: r.address, verified: true, linkedAt: new Date().toISOString() });
    } finally {
      setBusy(null);
    }
  };

  if (!checked) return null;

  const verified = Boolean(link?.verified);

  return (
    <section className="border border-white/10 bg-panel px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11.5px] text-poeira">#solana</p>
          {verified && link ? (
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-white">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-alta" strokeWidth={2.5} />
              <span className="truncate font-mono">{truncateAddress(link.walletAddress)}</span>
            </p>
          ) : (
            <p className="mt-1 truncate text-[13px] text-giz">
              {link ? 'Confirme com a carteira' : 'Vincule sua carteira'}
            </p>
          )}
        </div>
      </div>

      {!verified && (
        <div className="mt-3 flex flex-wrap gap-2">
          {oleWalletDisponivel() && (
            <button
              type="button"
              onClick={() => void onLinkOleWallet()}
              disabled={busy != null}
              className="btn-primary px-3 py-1.5 text-[12px] disabled:pointer-events-none disabled:opacity-40"
            >
              <span className="btn-primary-inner flex items-center gap-1.5">
                <img src="/brand/olefoot-icone-yellow-01.svg" alt="" className="h-4 w-4" />
                {busy === 'OLEWALLET' ? 'Aguardando…' : 'OLEWALLET'}
              </span>
            </button>
          )}
        </div>
      )}

      {!verified && (
        wallets.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {wallets.map((w) => (
              <button
                key={w.name}
                type="button"
                onClick={() => void onLink(w)}
                disabled={busy != null}
                className="btn-secondary px-3 py-1.5 text-[12px] disabled:pointer-events-none disabled:opacity-40"
              >
                <span className="btn-secondary-inner">
                  <img src={w.icon} alt="" className="h-4 w-4" />
                  {busy === w.name ? 'Assinando…' : w.name}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-2 space-y-1">
            <p className="text-[12px] text-cimento">Nenhuma extensão de carteira neste navegador</p>
            <p className="text-[12px] text-poeira">Use a OLEWALLET acima — ou abra o jogo pelo app da Phantom ou da MetaMask</p>
          </div>
        )
      )}

      {error && <p className="mt-2 text-[12px] text-baixa">{error}</p>}
    </section>
  );
}
