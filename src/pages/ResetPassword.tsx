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
      {/* Scrim da foto (legibilidade) — único degradê permitido nesta tela. */}
      <div
        aria-hidden
        className="absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(13,13,13,0.85) 0%, rgba(13,13,13,0.45) 20%, rgba(13,13,13,0.8) 45%, #0D0D0D 80%)',
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <div className="border border-white/10 bg-panel">
          <div className="px-5 py-6 sm:px-6">
            <h2 className="font-impact text-[30px] uppercase leading-[1.05] text-white">
              Redefinir Senha
            </h2>
            {!ready ? (
              <p className="mt-4 text-[12px] text-cimento">Validando link…</p>
            ) : done ? (
              <p className="mt-4 border border-alta/40 bg-alta/10 px-3 py-2 text-[12px] text-giz">
                ✓ Senha atualizada. Redirecionando ao login…
              </p>
            ) : !hasSession ? (
              <div className="mt-4 space-y-3">
                <p className="border border-baixa/50 bg-baixa/10 px-3 py-2 text-[12px] text-giz">
                  ✗ Link inválido ou expirado. Solicite um novo e-mail de recuperação.
                </p>
                <Link to="/login" className="btn-primary flex h-12 w-full items-center justify-center">
                  <span className="btn-primary-inner justify-center py-1">Voltar ao login</span>
                </Link>
              </div>
            ) : (
              <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-3" autoComplete="off">
                <label className="block">
                  <span className="mb-1 block font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-cimento">Nova senha</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e: import('react').ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full border border-white/16 bg-deep-black px-3 py-2.5 text-sm text-white focus:border-neon-yellow focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-cimento">Confirmar senha</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e: import('react').ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    className="w-full border border-white/16 bg-deep-black px-3 py-2.5 text-sm text-white focus:border-neon-yellow focus:outline-none"
                  />
                </label>
                {error ? (
                  <p className="border border-baixa/50 bg-baixa/10 px-3 py-2 text-[11px] text-giz">
                    ✗ {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={busy || !password || !confirm}
                  className="btn-primary flex h-12 w-full items-center justify-center disabled:pointer-events-none disabled:opacity-40"
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
