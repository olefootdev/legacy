/**
 * Convite — placa de papel que fecha a Home VOLT2 (A VIRADA · V4).
 * Um toque compartilha o link de indicação (ou copia, onde não há share nativo).
 * Sem código de indicação, some — não existe convite pra link vazio.
 */
import { useEffect, useState } from 'react';
import { ChevronRight, Users } from 'lucide-react';
import { fetchMyReferralCode } from '@/supabase/referrals';
import { inviteLinkForCode } from '@/wallet/referralCode';

export function Convite() {
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
        await nav.share({ title: 'OLEFOOT', text: 'Monta teu time comigo no OLEFOOT', url: link });
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
      className="flex min-h-[76px] w-full min-w-0 items-center gap-3.5 bg-giz px-4 text-left text-deep-black transition-colors hover:bg-white"
    >
      <Users aria-hidden className="h-7 w-7 shrink-0" strokeWidth={2} />
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="block min-w-0 truncate font-impact text-[22px] uppercase leading-none">Chame um amigo</span>
        <span className="block min-w-0 truncate font-mono text-[11.5px] font-medium text-[#3A3D40]">
          {copiado ? 'Link copiado' : '#convite · +EXP'}
        </span>
      </span>
      <ChevronRight aria-hidden className="h-5 w-5 shrink-0" strokeWidth={2.6} />
    </button>
  );
}
