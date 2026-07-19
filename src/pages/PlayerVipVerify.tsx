/**
 * PLAYERVIP VERIFY — troca o token do link mágico por sessão, NO NOSSO DOMÍNIO.
 *
 *   game.olefoot.com/playervip/verify/<handle>?t=<token_hash>
 *   game.olefoot.com/playervip/verify?t=<token_hash>          (e-mail, sem handle)
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
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getSupabase } from '@/supabase/client';

const YELLOW = '#FDE100';

export function PlayerVipVerify() {
  const [params] = useSearchParams();
  const { handle } = useParams<{ handle?: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Aceita ?t= (nosso formato curto) e ?token_hash= (formato do Supabase).
    const tokenHash = (params.get('t') ?? params.get('token_hash') ?? '').trim();
    if (!tokenHash) {
      setError('Link incompleto. Peça um novo acesso.');
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setError('Serviço indisponível no momento.');
      return;
    }
    let cancelled = false;
    void sb.auth
      .verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
      .then(({ error: err }) => {
        if (cancelled) return;
        if (err) {
          setError('Este link já foi usado ou expirou. Peça um novo — leva um minuto.');
          return;
        }
        navigate('/playervip', { replace: true });
      });
    return () => { cancelled = true; };
  }, [params, navigate]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 bg-[#0a0a0b] px-6 text-center text-white">
      <div className="flex items-center gap-3">
        <span className="h-7 w-3 rounded-sm" style={{ background: YELLOW, boxShadow: '0 0 22px rgba(253,225,0,.45)' }} />
        <span className="font-display text-[15px] font-black uppercase tracking-wide">OLEFOOT</span>
        <span className="font-display text-[15px] font-black uppercase tracking-wide text-white/40">PLAYERVIP</span>
      </div>

      {error ? (
        <>
          <h1 className="ole-headline-italic text-3xl">Link expirado</h1>
          <p className="text-sm leading-relaxed text-white/55">{error}</p>
          <Link
            to="/playervip"
            className="mt-1 rounded-xl px-6 py-3.5 font-display text-sm font-black uppercase tracking-wider text-black"
            style={{ background: YELLOW }}
          >
            Receber novo link
          </Link>
        </>
      ) : (
        <>
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: YELLOW }} />
          <p className="text-sm text-white/55">
            {handle ? `Entrando…` : 'Verificando seu acesso…'}
          </p>
        </>
      )}
    </div>
  );
}

export default PlayerVipVerify;
