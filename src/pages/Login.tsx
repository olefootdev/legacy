import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameDispatch } from '@/game/store';
import { signInWithEmail, fetchOnboardingProfile, sendPasswordResetEmail } from '@/supabase/auth';
import { FORMATION_TACTICAL_DEFAULTS } from '@/tactics/formationDefaults';
import { tryGrantWelcomeGenesisPack } from '@/game/welcomeGenesisPack';

export function Login() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const [mode, setMode] = useState<'landing' | 'form' | 'forgot'>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  const onForgotSubmit = async (e: import('react').FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = await sendPasswordResetEmail(email);
      if (!r.ok) {
        setError(r.error ?? 'Não foi possível enviar o e-mail.');
        return;
      }
      setForgotSent(true);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: import('react').FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = await signInWithEmail(email, password);
      if (!r.ok) {
        setError(r.error ?? 'Falha ao entrar.');
        return;
      }
      // Hidrata managerProfile do Supabase pro Zustand local.
      const remote = await fetchOnboardingProfile();
      if (!remote || !remote.onboarding) {
        setError('Conta existe mas não tem onboarding completo. Cadastra novamente.');
        return;
      }
      const o = remote.onboarding;
      dispatch({
        type: 'SET_USER_SETTINGS',
        partial: {
          managerProfile: o.managerProfile,
          favoriteRealTeam: o.favoriteRealTeam ?? null,
        },
      });
      if (remote.clubName && remote.clubShort) {
        dispatch({
          type: 'ADMIN_PATCH_CLUB',
          partial: { name: remote.clubName, shortName: remote.clubShort },
        });
      }
      const tacticalDefaults = FORMATION_TACTICAL_DEFAULTS[o.formationScheme];
      dispatch({
        type: 'SET_MANAGER_SLIDERS',
        partial: {
          formationScheme: o.formationScheme,
          tacticalMentality: tacticalDefaults.tacticalMentality,
          defensiveLine: tacticalDefaults.defensiveLine,
          tempo: tacticalDefaults.tempo,
          tacticalStyle: tacticalDefaults.style,
        },
      });
      // Se plantel vazio (novo dispositivo), tenta re-aplicar welcome pack.
      const welcome = await tryGrantWelcomeGenesisPack();
      if (welcome.ok === false) {
        const ignorable =
          welcome.reason === 'already_granted' || welcome.reason === 'squad_not_empty';
        if (!ignorable) console.warn('[Login] welcome genesis pack:', welcome.reason);
      }
      navigate('/', { replace: true });
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
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_95%_60%_at_50%_75%,rgba(0,0,0,0.65),transparent_52%)]"
        aria-hidden
      />

      <header
        role="banner"
        className="relative z-[100] w-full shrink-0 bg-transparent px-4 pb-2 pt-5 sm:px-6 sm:pb-3 sm:pt-6 md:px-8"
      >
        <div className="mx-auto flex w-full min-w-0 max-w-6xl items-center justify-between gap-3">
          <Link to="/login" className="flex min-w-0 flex-1 items-center gap-3" aria-label="Olefoot">
            <img
              src="/test-pitch/olefoot-logo-game.svg"
              alt="Olefoot"
              width={260}
              height={72}
              decoding="async"
              fetchPriority="high"
              className="h-10 w-auto max-h-11 max-w-[min(100%,280px)] object-contain object-left drop-shadow-[0_2px_16px_rgba(0,0,0,0.75)] sm:h-12 sm:max-h-[3.25rem]"
            />
          </Link>
          <span className="shrink-0 rounded-full border border-white/20 bg-black/35 px-4 py-2 font-display text-[9px] font-bold uppercase tracking-[0.28em] text-white/95 sm:px-5 sm:text-[10px] sm:tracking-[0.32em]">
            Manager de Futebol
          </span>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 pb-6 sm:px-8 sm:pb-8 md:px-10">
        <div className="min-h-[10vh] shrink-0 sm:min-h-[12vh] md:min-h-[14vh]" aria-hidden />

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-end">
          {mode === 'landing' ? (
            <div
              className={cn(
                'relative overflow-hidden rounded-sm border border-white/[0.1]',
                'bg-black/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_40px_rgba(0,0,0,0.45)]',
                'backdrop-blur-md',
              )}
            >
              <div className="absolute left-0 top-0 h-full w-1 bg-neon-yellow/90" aria-hidden />
              <div className="relative px-5 py-6 pl-6 sm:px-6 sm:py-7 sm:pl-7">
                <h1 className="font-display text-[clamp(1.65rem,6.8vw,2.65rem)] font-bold uppercase leading-[1.02] tracking-tight text-white [text-shadow:0_3px_28px_rgba(0,0,0,0.92)]">
                  Mostre que você entende de <span className="text-neon-yellow">futebol</span>
                </h1>
                <p className="mt-4 font-sans text-sm font-medium leading-snug text-white/88 [text-shadow:0_2px_14px_rgba(0,0,0,0.85)] sm:text-base">
                  Seja o maior Manager do mundo
                </p>
              </div>
            </div>
          ) : mode === 'forgot' ? (
            <div className="relative overflow-hidden rounded-sm border border-white/[0.1] bg-black/70 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
              <div className="absolute left-0 top-0 h-full w-1 bg-neon-yellow/90" aria-hidden />
              <div className="relative px-5 py-5 pl-6 sm:px-6 sm:py-6 sm:pl-7">
                <h2 className="font-display text-xl font-bold uppercase tracking-tight text-white sm:text-2xl">
                  Recuperar Senha
                </h2>
                {forgotSent ? (
                  <div className="mt-4 space-y-3">
                    <p className="rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-200">
                      ✓ Enviamos um link de recuperação para <strong>{email}</strong>. Abre o e-mail para definir uma nova senha.
                    </p>
                    <p className="text-[11px] text-white/55">
                      Não recebeu? Verifica a pasta de spam ou tenta novamente.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={(e) => void onForgotSubmit(e)} className="mt-4 space-y-3" autoComplete="on">
                    <p className="text-[12px] text-white/70">
                      Informa o e-mail da tua conta. Te enviaremos um link para redefinir a senha.
                    </p>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/60">E-mail</span>
                      <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e: import('react').ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                        required
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
                      disabled={busy || !email}
                      className="btn-primary w-full disabled:pointer-events-none disabled:opacity-40"
                    >
                      <span className="btn-primary-inner justify-center py-1">
                        {busy ? 'Enviando…' : 'Enviar link'}
                      </span>
                    </button>
                  </form>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMode('landing');
                    setError(null);
                    setForgotSent(false);
                  }}
                  className="mt-3 w-full text-center text-[11px] text-white/50 hover:text-white"
                >
                  ← Voltar
                </button>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-sm border border-white/[0.1] bg-black/70 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
              <div className="absolute left-0 top-0 h-full w-1 bg-neon-yellow/90" aria-hidden />
              <div className="relative px-5 py-5 pl-6 sm:px-6 sm:py-6 sm:pl-7">
                <h2 className="font-display text-xl font-bold uppercase tracking-tight text-white sm:text-2xl">
                  Entrar
                </h2>
                <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-3" autoComplete="on">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/60">E-mail</span>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full rounded-sm border border-white/15 bg-black/50 px-3 py-2 text-sm text-white focus:border-neon-yellow/50 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/60">Senha</span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                    disabled={busy || !email || !password}
                    className="btn-primary w-full disabled:pointer-events-none disabled:opacity-40"
                  >
                    <span className="btn-primary-inner justify-center py-1">
                      {busy ? 'Entrando…' : 'Entrar'}
                    </span>
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setMode('landing')}
                  className="mt-3 w-full text-center text-[11px] text-white/50 hover:text-white"
                >
                  ← Voltar
                </button>
              </div>
            </div>
          )}

          {mode === 'landing' ? (
            <nav className="mt-8 flex w-full flex-col gap-3 sm:mt-10" aria-label="Acesso à conta">
              <button
                type="button"
                onClick={() => setMode('form')}
                className="btn-primary block w-full text-center"
              >
                <span className="btn-primary-inner justify-center py-1">Entrar</span>
              </button>
              <Link to="/cadastro" className="btn-secondary block w-full text-center">
                <span className="btn-secondary-inner justify-center py-1">Cadastrar</span>
              </Link>
              <button
                type="button"
                className="pt-1 text-center font-sans text-xs font-bold uppercase tracking-wide text-white/60 underline decoration-white/30 underline-offset-[6px] transition hover:text-neon-yellow hover:decoration-neon-yellow/45"
                onClick={() => {
                  setError(null);
                  setForgotSent(false);
                  setMode('forgot');
                }}
              >
                Esqueci Senha
              </button>
            </nav>
          ) : null}
        </div>

        <footer className="mx-auto mt-8 max-w-md text-center text-[10px] text-white/35 sm:mt-10 sm:text-[11px]">
          Olefoot © 2026 · Todos os direitos reservados
        </footer>
      </div>
    </div>
  );
}
