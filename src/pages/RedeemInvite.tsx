/**
 * RedeemInvite — tela para tester resgatar invite_code após login.
 * Rota: /redeem
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, KeyRound, Loader2, X } from 'lucide-react';
import { redeemInvite } from '@/supabase/betaTesters';

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
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-neon-yellow" />
          <h1 className="font-display text-base font-black uppercase tracking-wider">
            Resgatar Convite
          </h1>
        </div>

        {state === 'success' ? (
          <div className="flex flex-col items-center py-6 text-center">
            <Check className="mb-3 h-10 w-10 text-neon-green" />
            <p className="text-sm font-bold">Acesso ativado.</p>
            <p className="text-xs text-gray-400">Bem-vindo ao beta da Olefoot.</p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-xs leading-relaxed text-gray-400">
              Cole o código de 8 caracteres que recebeu por email para entrar no beta.
            </p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={16}
              placeholder="XXXXXXXX"
              className="mb-3 w-full rounded border border-white/10 bg-black/50 px-3 py-2 text-center font-mono text-lg tracking-widest text-white placeholder:text-gray-600 focus:border-neon-yellow/60 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            {state === 'error' && (
              <div className="mb-3 flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                <X className="h-4 w-4 shrink-0" />
                {errorMessage}
              </div>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={!code.trim() || state === 'submitting'}
              className="flex w-full items-center justify-center gap-2 rounded bg-neon-yellow py-2 text-sm font-bold text-black hover:opacity-90 disabled:opacity-40"
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
