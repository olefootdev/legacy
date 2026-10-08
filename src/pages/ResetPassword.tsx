import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSupabase } from '@/supabase/client';
import { updateUserPassword } from '@/supabase/auth';
import { L } from '@/i18n/L';
import { FitaRua, MarcaRua } from '@/components/ui';

export function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setError(L('Supabase não configurado.', 'Supabase not configured.'));
      setReady(true);
      return;
    }
    // supabase-js v2 parses the recovery token from the URL hash and emits PASSWORD_RECOVERY.
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasSession(true);
      }
    });
    sb.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
      setReady(true);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: import('react').FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (password.length < 6) {
      setError(L('A senha precisa ter pelo menos 6 caracteres.', 'Password must be at least 6 characters.'));
      return;
    }
    if (password !== confirm) {
      setError(L('As senhas não coincidem.', "Passwords don't match."));
      return;
    }
    setBusy(true);
    try {
      const r = await updateUserPassword(password);
      if (!r.ok) {
        setError(r.error ?? L('Falha ao atualizar a senha.', 'Could not update password.'));
        return;
      }
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 1800);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rua-grao relative flex min-h-svh flex-col overflow-hidden bg-asfalto-27">
      {/* A fita da capa, colada no topo do muro. */}
      <FitaRua inclinacao={-3} className="relative z-10 mt-6 py-3" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <MarcaRua tipo="wordmark" label="Olefoot" className="mb-8 h-[22px] self-start bg-rua" />
        <div className="border-t-2 border-papel">
          <div className="pt-5">
            <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.22em] text-mudo">— {L('Senha', 'Password')}</span>
            <h2 className="mt-2 font-impact text-[clamp(38px,11vw,52px)] uppercase leading-[0.92] text-papel">
              {L('Redefinir Senha', 'Reset Password')}
            </h2>
            {!ready ? (
              <p className="mt-4 font-prova text-[12px] text-mudo">{L('Validando link…', 'Validating link…')}</p>
            ) : done ? (
              <p className="mt-5 -rotate-1 bg-cal px-4 py-3.5 text-[13.5px] text-asfalto-27">
                ✓ {L('Senha atualizada. Redirecionando ao login…', 'Password updated. Redirecting to sign in…')}
              </p>
            ) : !hasSession ? (
              <div className="mt-4 space-y-3">
                <p role="alert" className="border-l-[5px] border-baixa bg-concreto px-3.5 py-3 text-[13px] text-papel">
                  ✗ {L('Link inválido ou expirado. Solicite um novo e-mail de recuperação.', 'Invalid or expired link. Request a new reset email.')}
                </p>
                <Link to="/login" className="btn-primary flex min-h-[54px] w-full text-[20px] items-center justify-center">
                  <span className="btn-primary-inner justify-center py-1">{L('Voltar ao login', 'Back to sign in')}</span>
                </Link>
              </div>
            ) : (
              <form onSubmit={(e) => void onSubmit(e)} className="mt-5 flex flex-col gap-3.5" autoComplete="off">
                <label className="block">
                  <span className="mb-1.5 block font-prova text-[11.5px] font-bold uppercase tracking-[0.2em] text-mudo">{L('Nova senha', 'New password')}</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e: import('react').ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="min-h-[50px] w-full border-2 border-linha bg-concreto px-3.5 py-3 text-[15px] text-papel focus:border-rua focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block font-prova text-[11.5px] font-bold uppercase tracking-[0.2em] text-mudo">{L('Confirmar senha', 'Confirm password')}</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e: import('react').ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    className="min-h-[50px] w-full border-2 border-linha bg-concreto px-3.5 py-3 text-[15px] text-papel focus:border-rua focus:outline-none"
                  />
                </label>
                {error ? (
                  <p role="alert" className="border-l-[5px] border-baixa bg-concreto px-3.5 py-3 text-[13px] text-papel">
                    ✗ {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={busy || !password || !confirm}
                  className="btn-primary flex min-h-[54px] w-full text-[20px] items-center justify-center disabled:pointer-events-none disabled:opacity-40"
                >
                  <span className="btn-primary-inner justify-center py-1">
                    {busy ? L('Atualizando…', 'Updating…') : <>{L('Atualizar senha', 'Update password')} <span aria-hidden>→</span></>}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
