/**
 * PLAYERVIP VERIFY — troca o token do link mágico por sessão, NO NOSSO DOMÍNIO.
 *
 *   game.olefoot.ai/playervip/verify/<handle>?t=<token_hash>
 *   game.olefoot.ai/playervip/verify?t=<token_hash>          (e-mail, sem handle)
 *
 * Por que existe: o link padrão do Supabase aponta pro domínio do banco
 * (<projeto>.supabase.co/auth/v1/verify?token=…) — feio e vaza infraestrutura
 * pra lenda/facilitador. Aqui usamos `verifyOtp({ token_hash })`, que faz a
 * mesma verificação sem o usuário nunca ver o endereço do banco.
 *
 * Continua sendo link PESSOAL e de USO ÚNICO — não confundir com a vitrine
 * pública /playervip/:handle, que é feita pra compartilhar.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getSupabase } from '@/supabase/client';
import { BotaoRua, MarcaRua } from '@/components/ui/Rua';
import { L } from '@/i18n/L';

export function PlayerVipVerify() {
  const [params] = useSearchParams();
  const { handle } = useParams<{ handle?: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Aceita ?t= (nosso formato curto) e ?token_hash= (formato do Supabase).
    const tokenHash = (params.get('t') ?? params.get('token_hash') ?? '').trim();
    if (!tokenHash) {
      setError(L('Link incompleto. Peça um novo acesso.', 'Incomplete link. Request a new one.'));
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setError(L('Serviço indisponível no momento.', 'Service unavailable right now.'));
      return;
    }
    let cancelled = false;
    void sb.auth
      .verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
      .then(({ error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(L('Este link já foi usado ou expirou. Peça um novo — leva um minuto.', 'This link was already used or has expired. Request a new one — it takes a minute.'));
          return;
        }
        navigate('/playervip', { replace: true });
      });
    return () => { cancelled = true; };
  }, [params, navigate]);

  return (
    <div className="rua-grao flex min-h-screen w-full flex-col bg-asfalto-27 text-papel">
      <div className="mx-auto flex w-full max-w-md grow flex-col justify-center gap-6 px-6 py-10">
        <MarcaPlayerVip />

        {error ? (
          <div className="flex min-w-0 flex-col gap-4">
            <span className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">— {L('Acesso', 'Access')}</span>
            <h1 className="flex flex-col leading-[0.9]">
              <span className="font-voz text-[clamp(44px,12vw,60px)] text-papel">{L('Link vencido.', 'Link expired.')}</span>
              <span className="font-impact text-[clamp(26px,7vw,34px)] uppercase text-rua">{L('Pede outro.', 'Get another.')}</span>
            </h1>
            <p className="font-sans text-[15px] leading-relaxed text-suave">{error}</p>
            <BotaoRua to="/playervip" className="mt-2 w-full">
              {L('Receber novo link', 'Get a new link')} <span aria-hidden>→</span>
            </BotaoRua>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-4" role="status">
            <span className="font-voz text-[clamp(40px,11vw,56px)] leading-[0.95] text-papel">
              {handle ? L('Entrando…', 'Signing in…') : L('Conferindo…', 'Checking…')}
            </span>
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-rua" />
              <span className="font-prova text-[12px] font-bold uppercase tracking-[0.2em] text-mudo">
                {handle ? L('Abrindo o cockpit da lenda', "Opening the legend's cockpit") : L('Verificando seu acesso', 'Verifying your access')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Wordmark + PLAYERVIP em mono — a assinatura das telas da lenda. */
function MarcaPlayerVip() {
  return (
    <div className="flex items-center gap-3">
      <MarcaRua tipo="wordmark" label="Olefoot" className="h-[20px] bg-rua" />
      <span className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">PlayerVip</span>
    </div>
  );
}

export default PlayerVipVerify;
