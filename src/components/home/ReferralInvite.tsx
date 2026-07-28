/**
 * ReferralInvite — o link de indicação do manager, na Home.
 *
 * Pedido do fundador (2026-07-24): trazer o convite pra Home, abaixo da Resenha.
 * Reusa o que já existe — `fetchMyReferralCode` (código no profile) e
 * `inviteLinkForCode` (monta a URL de cadastro). Não inventa dado nenhum: se o
 * manager ainda não tem código, a seção não aparece.
 *
 * A rede em número (quantos indicados) vem de `getMyNetworkStatus`, a mesma
 * fonte que o wallet já usa — para o contador daqui nunca divergir do de lá.
 */
import { useEffect, useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import { fetchMyReferralCode, getMyNetworkStatus } from '@/supabase/referrals';
import { inviteLinkForCode } from '@/wallet/referralCode';

export function ReferralInvite() {
  const [code, setCode] = useState<string | null>(null);
  const [diretos, setDiretos] = useState<number | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void fetchMyReferralCode().then((c) => vivo && setCode(c));
    void getMyNetworkStatus().then((s) => {
      if (vivo) setDiretos(s?.directsTotal ?? null);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Sem código não há o que convidar — a seção some em vez de mostrar um link vazio.
  if (!code) return null;

  const link = inviteLinkForCode(code);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* clipboard bloqueado: o texto continua selecionável na tela */
    }
  }

  return (
    <section aria-label="Seu link de indicação" className="flex flex-col gap-2">
      <span className="ole-eyebrow-poster" style={{ fontSize: '12px' }}>
        Sua rede
      </span>

      <div className="ole-poster p-4">
        <h3 className="flex items-center gap-2 font-impact uppercase text-white" style={{ fontSize: '15px' }}>
          <Share2 className="h-4 w-4 flex-none" strokeWidth={2} style={{ color: 'var(--color-neon-yellow)' }} aria-hidden />
          Indique e cresça
        </h3>

        <div
          className="mt-3 flex items-center gap-2.5"
          style={{
            background: '#0d0d0a',
            border: '1px solid rgba(253,225,0,0.28)',
            borderRadius: 'var(--radius-md)',
            padding: '9px 11px',
          }}
        >
          <code
            className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
            style={{ fontFamily: 'var(--font-mono, ui-monospace), monospace', fontSize: '12.5px', color: 'var(--color-neon-yellow)' }}
          >
            {link}
          </code>
          <button
            type="button"
            onClick={copiar}
            className="inline-flex flex-none items-center gap-1.5 rounded-md px-3 py-2 font-display font-black uppercase"
            style={{ background: 'var(--color-neon-yellow)', color: 'var(--color-deep-black)', fontSize: '10px', letterSpacing: '0.1em' }}
          >
            {copiado ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>

        {diretos != null && diretos > 0 && (
          <p className="mt-3 text-white/55" style={{ fontFamily: 'var(--font-sans)', fontSize: '12px' }}>
            <span className="font-impact text-neon-yellow" style={{ fontSize: '15px' }}>
              {diretos}
            </span>{' '}
            {diretos === 1 ? 'manager na sua rede' : 'managers na sua rede'}
          </p>
        )}
      </div>
    </section>
  );
}
