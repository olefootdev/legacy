import { useEffect, useState } from 'react';
import { conectarOleWallet, oleWalletDisponivel } from '@/supabase/oleWalletConnect';
import {
  connectAndLinkSolanaWallet,
  fetchMyLinkedSolanaWallet,
  listSolanaWallets,
  onSolanaWalletsChange,
  type SolanaWalletLink,
  type SolanaWalletOption,
} from '@/supabase/solanaWallet';
import { MarcaRua } from '@/components/ui/Rua';
import { L } from '@/i18n/L';

function truncateAddress(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

/**
 * Vínculo de carteira Solana com prova de posse (A VIRADA · C1). Lista toda
 * carteira Solana instalada pelo Wallet Standard — não só a Phantom — e só
 * vincula depois que a própria carteira assina. Ver src/supabase/solanaWallet.ts.
 *
 * DS 2027: vinculada = carteirinha de sócio (RESPEITO); sem vínculo = vazio
 * com saída. A ação é o nome da carteira.
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
   * A OLEWALLET não é extensão: ela mora em olefoot.ai e abre numa janela.
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
        setError(r.error ?? L('Não foi possível vincular a OLEWALLET.', 'Couldn\'t link the OLEWALLET.'));
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
        setError(r.error ?? L('Não foi possível vincular a carteira.', 'Couldn\'t link the wallet.'));
        return;
      }
      setLink({ walletAddress: r.address, verified: true, linkedAt: new Date().toISOString() });
    } finally {
      setBusy(null);
    }
  };

  if (!checked) return null;

  const verified = Boolean(link?.verified);

  // ── VINCULADA: a carteirinha de sócio (DS 2027 · 3d). Asfalto com fio de
  // ouro e o canhoto em ouro chapado — a única peça com canto redondo do DS.
  // Só mostra o que é real: o endereço e o ano do vínculo.
  if (verified && link) {
    const desde = link.linkedAt ? new Date(link.linkedAt).getFullYear() : null;
    return (
      <section
        aria-label={L('Carteira Solana vinculada', 'Linked Solana wallet')}
        className="flex min-h-[176px] min-w-0 overflow-hidden rounded-[18px] border-[3px] border-ouro-27 bg-asfalto-27"
      >
        <div className="rua-grao flex min-w-0 grow flex-col justify-between gap-4 bg-concreto p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <MarcaRua tipo="wordmark" label="Olefoot" className="h-[15px] bg-papel" />
            <span className="inline-flex shrink-0 items-center gap-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">
              Solana <span aria-hidden className="text-ouro-27">●</span>
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.22em] text-ouro-27">
              {L('Sócio de respeito', 'Member of respect')}
            </span>
            <span className="block min-w-0 truncate font-prova text-[clamp(20px,6vw,26px)] font-bold text-papel" title={link.walletAddress}>
              {truncateAddress(link.walletAddress)}
            </span>
            <span className="font-prova text-[11.5px] uppercase tracking-[0.12em] text-suave">
              {[L('assinada pela carteira', 'signed by the wallet'), desde ? L(`desde ${desde}`, `since ${desde}`) : null].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>
        <div className="flex w-[26%] max-w-[120px] shrink-0 items-center justify-center bg-ouro-27 px-3">
          <MarcaRua tipo="nove" className="w-full max-w-[84px] bg-asfalto-27" />
        </div>
      </section>
    );
  }

  // ── SEM VÍNCULO: vazio com saída. Tracejado, frase na voz, e a ação é o
  // nome da carteira.
  return (
    <section className="border-2 border-dashed border-fio px-4 py-5 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">— #solana</p>
        <span className="inline-flex shrink-0 items-center gap-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">
          Solana <span aria-hidden className="text-fio">●</span>
        </span>
      </div>
      <p className="mt-2 font-voz text-[clamp(30px,8.5vw,40px)] leading-[0.95] text-papel">
        {link ? L('Confirme com a carteira', 'Confirm with your wallet') : L('Tua chave, teu cofre.', 'Your key, your vault.')}
      </p>

      {/* A fronteira, dita onde a dúvida nasce: quem só quer jogar não precisa
          disto. Sem esta linha, o card parece uma etapa obrigatória do cadastro
          — e a carteira é a única parte do produto que a pessoa pode perder
          sozinha. Ninguém deve ser empurrado pra ela. */}
      <p className="mt-2 text-[13px] leading-relaxed text-suave">
        {L('Opcional. Seu time, seu EXP e suas compras continuam funcionando sem ela.', 'Optional. Your team, your EXP and your purchases keep working without it.')}
      </p>

      {oleWalletDisponivel() && (
        <button
          type="button"
          onClick={() => void onLinkOleWallet()}
          disabled={busy != null}
          className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 bg-rua px-5 font-impact text-[20px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)] disabled:pointer-events-none disabled:opacity-40"
        >
          <MarcaRua tipo="escudo" className="h-5 bg-asfalto-27" />
          {busy === 'OLEWALLET' ? L('Aguardando…', 'Waiting…') : <>OLEWALLET <span aria-hidden>→</span></>}
        </button>
      )}

      {wallets.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2.5">
          {wallets.map((w) => (
            <button
              key={w.name}
              type="button"
              onClick={() => void onLink(w)}
              disabled={busy != null}
              className="inline-flex min-h-[46px] min-w-0 items-center gap-2 border-2 border-papel px-4 font-impact text-[17px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27 disabled:pointer-events-none disabled:opacity-40"
            >
              <img src={w.icon} alt="" className="h-5 w-5 shrink-0" />
              <span className="min-w-0 truncate">{busy === w.name ? L('Assinando…', 'Signing…') : w.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-1 border-t-2 border-linha pt-3">
          <p className="font-prova text-[12px] text-mudo">{L('Nenhuma extensão de carteira neste navegador', 'No wallet extension in this browser')}</p>
          <p className="font-prova text-[12px] leading-relaxed text-fio">{L('Use a OLEWALLET acima — ou abra o jogo pelo app da Phantom ou da MetaMask', 'Use the OLEWALLET above — or open the game in the Phantom or MetaMask app')}</p>
        </div>
      )}

      {error && <p role="alert" className="mt-3 font-prova text-[12px] text-baixa">{error}</p>}
    </section>
  );
}
