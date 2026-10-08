/**
 * RedeemInvite — tela para tester resgatar invite_code após login.
 * Rota: /redeem
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, KeyRound, Loader2, X } from 'lucide-react';
import { redeemInvite } from '@/supabase/betaTesters';
import { Hashtag } from '@/components/ui';
import { L } from '@/i18n/L';

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
      setErrorMessage(L('Código inválido, expirado ou já resgatado.', 'Invalid, expired or already redeemed code.'));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-asfalto-27 px-4 text-papel">
      <div className="w-full max-w-sm border-t-[5px] border-rua bg-concreto p-6">
        <div className="mb-5 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-rua" />
          <h1 className="font-impact text-[30px] uppercase leading-[1] text-papel">
            {L('Resgatar Convite', 'Redeem Invite')}
          </h1>
        </div>

        {state === 'success' ? (
          <div className="flex flex-col items-center py-6 text-center">
            <Check className="mb-3 h-10 w-10 text-alta" />
            <p className="font-voz text-[26px] leading-none text-papel">{L('Acesso ativado.', 'Access activated.')}</p>
            <Hashtag className="text-center">#beta</Hashtag>
          </div>
        ) : (
          <>
            <p className="mb-4 text-[13px] leading-relaxed text-suave">
              {L('Cole o código de 8 caracteres que recebeu por email para entrar no beta.', 'Paste the 8-character code you got by email to join the beta.')}
            </p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={16}
              placeholder="XXXXXXXX"
              className="mb-3 min-h-[54px] w-full border-2 border-linha bg-asfalto-27 px-3 py-2.5 text-center font-spray text-[26px] font-black tracking-[0.3em] text-papel outline-none placeholder:text-fio focus:border-rua"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            {state === 'error' && (
              <div role="alert" className="mb-3 flex items-center gap-2 border-l-[5px] border-baixa bg-asfalto-27 px-3 py-2.5 text-[12.5px] text-papel">
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
                  {L('Resgatando…', 'Redeeming…')}
                </>
              ) : (
                L('Resgatar', 'Redeem')
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
