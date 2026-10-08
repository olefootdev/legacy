/**
 * Carteirinha de sócio (DS 2027, peça 3d) — o atalho da Carteira na Home.
 *
 * Asfalto com o canhoto de ouro e o 9 de respeito. O que aparece é o estado
 * REAL do vínculo da carteira Solana (endereço e ano do vínculo); saldo nunca
 * aparece na Home. Sem carteira vinculada, a carteirinha pede o vínculo.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MarcaRua } from '@/components/ui/Rua';
import { fetchMyLinkedSolanaWallet, type SolanaWalletLink } from '@/supabase/solanaWallet';
import { L } from '@/i18n/L';

export function Carteirinha({ managerName, clubName }: { managerName: string | null; clubName: string }) {
  const [link, setLink] = useState<SolanaWalletLink | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    void fetchMyLinkedSolanaWallet()
      .then((l) => vivo && setLink(l))
      .catch(() => vivo && setLink(null));
    return () => {
      vivo = false;
    };
  }, []);
  const verified = !!link?.verified;
  const desde = link?.linkedAt ? new Date(link.linkedAt).getFullYear() : null;

  return (
    <Link
      to="/wallet"
      aria-label={L('Carteira', 'Wallet')}
      className="group flex min-h-[220px] min-w-0 overflow-hidden rounded-[18px] transition-transform hover:-translate-y-0.5"
    >
      <div className="rua-grao flex min-w-0 grow flex-col justify-between gap-5 bg-concreto p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <MarcaRua tipo="wordmark" label="Olefoot" className="h-[18px] bg-papel" />
          <span className="inline-flex items-center gap-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">
            Solana <span aria-hidden className={verified ? 'text-ouro-27' : 'text-fio'}>●</span>
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.22em] text-ouro-27">
            {verified ? L('Sócio de respeito', 'Member of respect') : L('Carteira', 'Wallet')}
          </span>
          <span className="block min-w-0 truncate font-voz text-[clamp(28px,8vw,40px)] leading-[0.95] text-papel">
            {managerName || clubName}
          </span>
          <span className="block min-w-0 truncate font-prova text-[12px] uppercase tracking-[0.1em] text-suave">
            {verified
              ? [managerName ? clubName : null, desde ? L(`desde ${desde}`, `since ${desde}`) : null].filter(Boolean).join(' · ') || 'Solana'
              : L('Vincula e vira sócio', 'Link it, become a member')}
          </span>
        </div>

        {verified && link ? (
          <span className="font-prova text-[13px] font-medium text-papel">
            {link.walletAddress.slice(0, 4)}…{link.walletAddress.slice(-4)}
          </span>
        ) : (
          <span className="inline-flex min-h-[46px] items-center gap-2 self-start border-2 border-papel px-4 font-impact text-[18px] uppercase leading-none text-papel transition-colors group-hover:bg-papel group-hover:text-asfalto-27">
            {link === undefined ? '…' : L('Vincular carteira', 'Link wallet')} {link !== undefined && <span aria-hidden>→</span>}
          </span>
        )}
      </div>

      <div className="flex w-[30%] max-w-[150px] shrink-0 flex-col items-center justify-center bg-ouro-27 px-3">
        <MarcaRua tipo="nove" className="w-full max-w-[104px] bg-asfalto-27" />
      </div>
    </Link>
  );
}
