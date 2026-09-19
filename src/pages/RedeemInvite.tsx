/**
 * RedeemInvite — tela para tester resgatar invite_code após login.
 * Rota: /redeem
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, KeyRound, Loader2, X } from 'lucide-react';
import { redeemInvite } from '@/supabase/betaTesters';
import { Hashtag } from '@/components/ui';

export function RedeemInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed || state === 'submitting') return;
    setState('submitting');
    setErrorMessage('');
    const ok = await redeemInvite(trimmed);
    if (ok) {
      setState('success');
      setTimeout(() => navigate('/', { replace: true }), 1500);
    } else {
      setState('error');
      setErrorMessage('Código inválido, expirado ou já resgatado.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-deep-black px-4 text-white">
      <div className="w-full max-w-sm border border-white/10 bg-panel p-6">
        <div className="mb-5 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-neon-yellow" />
          <h1 className="font-impact text-[24px] uppercase leading-[1.1] text-white">
            Resgatar Convite
          </h1>
        </div>

        {state === 'success' ? (
          <div className="flex flex-col items-center py-6 text-center">
            <Check className="mb-3 h-10 w-10 text-alta" />
            <p className="text-sm font-bold">Acesso ativado.</p>
            <Hashtag className="text-center">#beta</Hashtag>
          </div>
        ) : (
          <>
            <p className="mb-4 text-xs leading-relaxed text-cimento">
              Cole o código de 8 caracteres que recebeu por email para entrar no beta.
            </p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={16}
              placeholder="XXXXXXXX"
              className="mb-3 w-full border border-white/16 bg-deep-black px-3 py-2.5 text-center font-mono text-lg tracking-widest text-white outline-none placeholder:text-poeira focus:border-neon-yellow"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            {state === 'error' && (
              <div className="mb-3 flex items-center gap-2 border border-baixa/50 bg-baixa/10 px-3 py-2 text-xs text-giz">
                <X className="h-4 w-4 shrink-0 text-baixa" />
                {errorMessage}
              </div>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={!code.trim() || state === 'submitting'}
              className="btn-primary flex h-12 w-full items-center justify-center gap-2 disabled:pointer-events-none disabled:opacity-40"
            >
              {state === 'submitting' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resgatando…
                </>
              ) : (
                'Resgatar'
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
