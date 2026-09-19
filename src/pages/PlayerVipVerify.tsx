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
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 bg-deep-black px-6 text-center text-white">
      <div className="flex items-center gap-3">
        <img src="/brand/olefoot-yellow-01.svg" alt="Olefoot" className="w-auto shrink-0" style={{ height: 22 }} />
        <span className="font-impact text-[15px] uppercase tracking-wide text-cimento">PLAYERVIP</span>
      </div>

      {error ? (
        <>
          <h1 className="font-impact text-[32px] uppercase leading-[1.05]">Link expirado</h1>
          <p className="text-sm leading-relaxed text-cimento">{error}</p>
          <Link
            to="/playervip"
            className="btn-primary mt-1 flex h-12 items-center justify-center"
          >
            Receber novo link
          </Link>
        </>
      ) : (
        <>
          <Loader2 className="h-7 w-7 animate-spin text-neon-yellow" />
          <p className="text-sm text-cimento">
            {handle ? `Entrando…` : 'Verificando seu acesso…'}
          </p>
        </>
      )}
    </div>
  );
}

export default PlayerVipVerify;
