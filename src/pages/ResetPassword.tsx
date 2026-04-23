import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSupabase } from '@/supabase/client';
import { updateUserPassword } from '@/supabase/auth';

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
      setError('Supabase não configurado.');
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
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setBusy(true);
    try {
      const r = await updateUserPassword(password);
      if (!r.ok) {
        setError(r.error ?? 'Falha ao atualizar a senha.');
        return;
      }
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 1800);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-deep-black">
      <div
        className="absolute inset-0 z-0 scale-105 bg-cover bg-[center_22%] bg-no-repeat sm:bg-center"
        style={{ backgroundImage: 'url(/login-hero.png)' }}
        aria-hidden
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/88 via-black/35 to-black/90" aria-hidden />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/50 to-black/25 opacity-[0.96]" aria-hidden />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <div className="relative overflow-hidden rounded-sm border border-white/[0.1] bg-black/70 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
          <div className="absolute left-0 top-0 h-full w-1 bg-neon-yellow/90" aria-hidden />
          <div className="relative px-5 py-5 pl-6 sm:px-6 sm:py-6 sm:pl-7">
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-white sm:text-2xl">
              Redefinir Senha
            </h2>
            {!ready ? (
              <p className="mt-4 text-[12px] text-white/60">Validando link…</p>
            ) : done ? (
              <p className="mt-4 rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-200">
                ✓ Senha atualizada. Redirecionando ao login…
              </p>
            ) : !hasSession ? (
              <div className="mt-4 space-y-3">
                <p className="rounded-sm border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
                  ✗ Link inválido ou expirado. Solicita um novo e-mail de recuperação.
                </p>
                <Link to="/login" className="btn-primary block w-full text-center">
                  <span className="btn-primary-inner justify-center py-1">Voltar ao login</span>
                </Link>
              </div>
            ) : (
              <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-3" autoComplete="off">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/60">Nova senha</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e: import('react').ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full rounded-sm border border-white/15 bg-black/50 px-3 py-2 text-sm text-white focus:border-neon-yellow/50 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/60">Confirmar senha</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e: import('react').ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    className="w-full rounded-sm border border-white/15 bg-black/50 px-3 py-2 text-sm text-white focus:border-neon-yellow/50 focus:outline-none"
                  />
                </label>
                {error ? (
                  <p className="rounded-sm border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                    ✗ {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={busy || !password || !confirm}
                  className="btn-primary w-full disabled:pointer-events-none disabled:opacity-40"
                >
                  <span className="btn-primary-inner justify-center py-1">
                    {busy ? 'Atualizando…' : 'Atualizar senha'}
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
