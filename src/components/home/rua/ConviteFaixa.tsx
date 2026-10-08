/**
 * Convite como faixa de arquibancada (DS 2027, peça 3e — "DA RUA PRO MUNDO").
 * Um toque compartilha o link de indicação (ou copia, onde não há share
 * nativo). Sem código de indicação, some — não existe convite pra link vazio.
 */
import { useEffect, useState } from 'react';
import { MarcaRua } from '@/components/ui/Rua';
import { fetchMyReferralCode } from '@/supabase/referrals';
import { inviteLinkForCode } from '@/wallet/referralCode';
import { L } from '@/i18n/L';

export function ConviteFaixa() {
  const [code, setCode] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void fetchMyReferralCode().then((c) => vivo && setCode(c));
    return () => {
      vivo = false;
    };
  }, []);

  if (!code) return null;
  const link = inviteLinkForCode(code);

  async function chamar() {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title: 'OLEFOOT', text: L('Monta teu time comigo no OLEFOOT', 'Build your team with me on OLEFOOT'), url: link });
        return;
      } catch {
        /* cancelou ou não suportou: cai pra copiar */
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* clipboard bloqueado: nada a fazer sem inventar UI */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void chamar()}
      className="group relative flex w-full min-w-0 flex-col gap-3 bg-rua px-5 pb-4 pt-6 text-left text-asfalto-27 transition-transform hover:-rotate-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rua"
    >
      {/* Ilhoses da faixa. */}
      <span aria-hidden className="absolute left-2.5 top-2.5 h-3 w-3 rounded-full border-2 border-asfalto-27" />
      <span aria-hidden className="absolute right-2.5 top-2.5 h-3 w-3 rounded-full border-2 border-asfalto-27" />

      <span className="flex min-w-0 items-center justify-between gap-3">
        <span className="font-impact text-[clamp(34px,10vw,60px)] uppercase leading-[0.88]">
          {L('Chama', 'Bring')}
          <br />
          {L('os parça', 'the crew')}
        </span>
        <MarcaRua tipo="nove" className="h-[86px] bg-asfalto-27 sm:h-[104px]" />
      </span>
      <span className="flex min-w-0 items-center justify-between gap-3 border-t-2 border-asfalto-27 pt-2.5 font-prova text-[12px] font-bold uppercase tracking-[0.16em]">
        <span className="min-w-0 truncate">{copiado ? L('Link copiado', 'Link copied') : L('Da rua pro mundo · +EXP', 'From the street to the world · +EXP')}</span>
        <span aria-hidden className="shrink-0 font-impact text-[20px] tracking-normal">→</span>
      </span>
    </button>
  );
}
