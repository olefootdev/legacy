import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Zap, ShoppingCart, Trophy, Users, Clock, Brain, Rocket, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch, getGameState } from '@/game/store';
import { signInWithEmail, fetchOnboardingProfile, sendPasswordResetEmail } from '@/supabase/auth';
import { fetchMyReferralCode, syncMyExpLifetime } from '@/supabase/referrals';
import { FORMATION_TACTICAL_DEFAULTS } from '@/tactics/formationDefaults';

// A/B Test: 3 propostas de valor
type ValueProposition = 'nostalgia' | 'ai' | 'speed';

const VALUE_PROPS: Record<ValueProposition, {
  headline: { white1: string; yellow: string; white2: string };
  subheadline: string;
  features: Array<{ icon: typeof Clock; text: string; color: string }>;
}> = {
  nostalgia: {
    headline: {
      white1: 'A gente sabe que',
      yellow: 'você já virou noite para ser o melhor',
      white2: 'clube do mundo!',
    },
    subheadline: 'Bem vindo ao OLEFOOT',
    features: [
      { icon: ShoppingCart, text: 'Revele novos talentos no mercado', color: 'text-neon-yellow' },
      { icon: Trophy, text: 'Construa sua cidade do futebol', color: 'text-neon-yellow' },
      { icon: Users, text: 'Dispute ligas contra gringos', color: 'text-neon-yellow' },
    ],
  },
  ai: {
    headline: {
      white1: 'A gente sabe que',
      yellow: 'você já virou noite para ser o melhor',
      white2: 'clube do mundo',
    },
    subheadline: 'Bem vindo ao OLEFOOT',
    features: [
      { icon: Brain, text: 'Assistente tático com IA', color: 'text-neon-yellow' },
      { icon: Sparkles, text: 'Crie jogadores com prompt', color: 'text-neon-yellow' },
      { icon: Zap, text: 'Análise em tempo real', color: 'text-neon-yellow' },
    ],
  },
  speed: {
    headline: {
      white1: 'A gente sabe que',
      yellow: 'você já virou noite para ser o melhor',
      white2: 'clube do mundo',
    },
    subheadline: 'Bem vindo ao OLEFOOT',
    features: [
      { icon: Rocket, text: 'Partidas de 30 segundos', color: 'text-neon-yellow' },
      { icon: Clock, text: 'Temporada completa em 5min', color: 'text-neon-yellow' },
      { icon: Trophy, text: 'Progressão transparente', color: 'text-neon-yellow' },
    ],
  },
};

/**
 * Feature card unificado Legacy Tech — sem rainbow, sempre neon-yellow.
 * Foto-rail amarelo + ícone amarelo + Agency uppercase + descrição compacta.
 */
function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: import('react').ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div
      className="group relative overflow-hidden border border-l-[3px] border-white/10 border-l-neon-yellow bg-dark-gray/85 px-5 py-4 backdrop-blur-sm transition-all hover:border-neon-yellow/40 hover:-translate-y-0.5"
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center bg-deep-black border border-neon-yellow/45 text-neon-yellow"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className="text-white uppercase truncate"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.18em',
              lineHeight: 1.1,
            }}
          >
            {title}
          </h3>
          <p
            className="mt-1 leading-snug text-white/60"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '11px' }}
          >
            {desc}
          </p>
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const [mode, setMode] = useState<'landing' | 'form' | 'forgot'>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  // A/B Test: rotaciona proposta de valor a cada visita
  const [variant, setVariant] = useState<ValueProposition>('nostalgia');

  useEffect(() => {
    // Detecta qual variante mostrar (baseado em hash do timestamp ou localStorage)
    const stored = localStorage.getItem('olefoot_ab_variant');
    if (stored && ['nostalgia', 'ai', 'speed'].includes(stored)) {
      setVariant(stored as ValueProposition);
    } else {
      // Distribui aleatoriamente entre as 3 variantes
      const variants: ValueProposition[] = ['nostalgia', 'ai', 'speed'];
      const selected = variants[Math.floor(Math.random() * variants.length)];
      setVariant(selected);
      localStorage.setItem('olefoot_ab_variant', selected);
    }

    // Track impressão da variante (para analytics futuro)
    console.log('[A/B Test] Variant shown:', stored || variant);
  }, []);

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
        // Mensagens de erro mais específicas
        let errorMsg = r.error ?? 'Falha ao entrar.';
        if (errorMsg.includes('Invalid login credentials')) {
          errorMsg = 'E-mail ou senha incorretos. Verifica os dados e tenta novamente.';
        } else if (errorMsg.includes('Email not confirmed')) {
          errorMsg = 'E-mail não confirmado. Verifica tua caixa de entrada.';
        } else if (errorMsg.includes('User not found')) {
          errorMsg = 'Conta não encontrada. Verifica o e-mail ou cadastra-te.';
        }
        setError(errorMsg);
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
      // Sincroniza código de indicação autoritativo do servidor.
      try {
        const serverCode = await fetchMyReferralCode();
        if (serverCode) {
          dispatch({ type: 'WALLET_SYNC_REFERRAL_CODE', code: serverCode });
        }
      } catch (e) {
        console.warn('[Login] referral code sync skipped', e);
      }
      // Sincroniza lifetime EXP local com o servidor. Trigger no banco detecta
      // delta e credita 5% de comissão pro referrer (se houver).
      try {
        const lifetimeLocal = Number(
          (getGameState().finance as { expLifetimeEarned?: number }).expLifetimeEarned ?? 0,
        );
        if (lifetimeLocal > 0) await syncMyExpLifetime(lifetimeLocal);
      } catch (e) {
        console.warn('[Login] exp lifetime sync skipped', e);
      }
      // [2026-05-18] Auto-grant silencioso REMOVIDO. Se o plantel está vazio,
      // o OnboardingCeremony entra em cena e o manager passa pelos 6 capítulos
      // (sorteio EXP → 25 pioneiros → top 3 → daily bonus → boas-vindas).
      // Cerimônia só roda 1× por user (gate `hasDoneOnboarding` em
      // userSettings + tabela `welcome_pack_grants` no Supabase).
      // Full reload para que os hydrators re-montem com sessão válida.
      // Sem isso, os hydrators já rodaram (e falharam) antes do login.
      window.location.href = '/';
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
          <span
            className="shrink-0 border border-neon-yellow/35 bg-deep-black/65 px-4 py-2 font-display font-black uppercase text-neon-yellow sm:px-5"
            style={{
              fontSize: '10px',
              letterSpacing: '0.32em',
              borderRadius: 'var(--radius-pill)',
            }}
          >
            Manager de Futebol
          </span>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 pb-6 sm:px-8 sm:pb-8 md:px-10">
        <div className="min-h-[10vh] shrink-0 sm:min-h-[12vh] md:min-h-[14vh]" aria-hidden />

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-end">
          {mode === 'landing' ? (
            <>
              <div
                className={cn(
                  'relative overflow-hidden rounded-xl border border-white/[0.12]',
                  'bg-gradient-to-br from-black/60 via-black/50 to-black/70',
                  'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_50px_rgba(0,0,0,0.6)]',
                  'backdrop-blur-xl',
                )}
              >
                <div className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-neon-yellow via-neon-yellow/80 to-neon-yellow/60" aria-hidden />
                <div className="relative px-6 py-8 pl-8 sm:px-8 sm:py-10 sm:pl-10">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-neon-yellow/30 bg-neon-yellow/10 px-3 py-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-yellow" />
                    <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-neon-yellow">Jogue Agora</span>
                  </div>

                  {/* Headline dinâmico baseado na variante A/B */}
                  <h1 className="font-serif-hero text-[clamp(1.8rem,7vw,3rem)] font-normal italic leading-[1.05] tracking-tight [text-shadow:0_4px_32px_rgba(0,0,0,0.95)]">
                    <span className="text-white">{VALUE_PROPS[variant].headline.white1} </span>
                    <span className="text-neon-yellow">{VALUE_PROPS[variant].headline.yellow} </span>
                    <span className="text-white">{VALUE_PROPS[variant].headline.white2}</span>
                  </h1>

                  {/* Subheadline com Moret italic */}
                  <p
                    className="mt-6 italic text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.9)]"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontSize: 'clamp(1.5rem, 5vw, 2rem)',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {VALUE_PROPS[variant].subheadline}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3 font-display text-[11px] font-bold uppercase tracking-[0.15em]">
                    {VALUE_PROPS[variant].features.map((feature, i) => (
                      <span key={i} className="flex items-center gap-1.5 text-white/70">
                        <feature.icon className={cn('h-3.5 w-3.5', feature.color)} />
                        {feature.text}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Feature Highlights — adapta ao contexto da variante */}
              <div className="mt-6 space-y-3">
                {variant === 'nostalgia' && (
                  <>
                    <FeatureCard
                      icon={<ShoppingCart className="h-5 w-5" strokeWidth={2.5} />}
                      title="Mercado Real"
                      desc="Leilões ao vivo, garimpe talentos baratos e venda por fortuna"
                    />
                    <FeatureCard
                      icon={<Trophy className="h-5 w-5" strokeWidth={2.5} />}
                      title="Construa Sua Dinastia"
                      desc="Décadas de carreira, jogadores envelhecem e novos talentos surgem"
                    />
                    <FeatureCard
                      icon={<Zap className="h-5 w-5" strokeWidth={2.5} />}
                      title="O Jogo Começou"
                      desc="Mostre que você entende de futebol e domine o ranking mundial"
                    />
                  </>
                )}

                {variant === 'ai' && (
                  <>
                    <FeatureCard
                      icon={<span className="font-display text-base font-black">AI</span>}
                      title="Crie Jogadores com IA"
                      desc="Descreva o perfil e gere jogadores únicos com atributos reais"
                    />
                    <FeatureCard
                      icon={<Zap className="h-5 w-5" strokeWidth={2.5} />}
                      title="Análise Tática em Tempo Real"
                      desc="IA analisa partidas e sugere mudanças táticas instantâneas"
                    />
                  </>
                )}

                {variant === 'speed' && (
                  <>
                    <FeatureCard
                      icon={<Rocket className="h-5 w-5" strokeWidth={2.5} />}
                      title="Partidas Ultrarrápidas"
                      desc="Jogue uma partida completa em 30 segundos, gratificação instantânea"
                    />
                    <FeatureCard
                      icon={<Clock className="h-5 w-5" strokeWidth={2.5} />}
                      title="Temporada Completa em 5 Minutos"
                      desc="Simule 38 jogos rapidamente e veja seu time subir na tabela"
                    />
                  </>
                )}
              </div>
            </>
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
                      <div className="flex items-start gap-2 rounded-sm border border-rose-500/50 bg-rose-500/15 px-3 py-2.5 text-[12px] leading-snug text-rose-100">
                        <span className="shrink-0 text-rose-300">✗</span>
                        <span className="flex-1">{error}</span>
                      </div>
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
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full rounded-sm border border-white/15 bg-black/50 px-3 py-2 pr-10 text-sm text-white focus:border-neon-yellow/50 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </label>
                  {error ? (
                    <div className="flex items-start gap-2 rounded-sm border border-rose-500/50 bg-rose-500/15 px-3 py-2.5 text-[12px] leading-snug text-rose-100">
                      <span className="shrink-0 text-rose-300">✗</span>
                      <span className="flex-1">{error}</span>
                    </div>
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
                onClick={() => {
                  setMode('form');
                  // Track conversão do A/B test
                  console.log('[A/B Test] User clicked "Entrar" on variant:', variant);
                  localStorage.setItem('olefoot_ab_converted', variant);
                }}
                className="relative overflow-hidden bg-neon-yellow px-6 py-4 font-display font-black uppercase text-black shadow-[0_8px_24px_rgba(253,224,71,0.28)] transition-all hover:bg-white hover:scale-[1.005] active:scale-[0.99]"
                style={{
                  fontSize: '14px',
                  letterSpacing: '0.24em',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                Entrar
              </button>
              <Link
                to="/cadastro"
                onClick={() => {
                  // Track conversão do A/B test
                  console.log('[A/B Test] User clicked "Cadastrar" on variant:', variant);
                  localStorage.setItem('olefoot_ab_converted', variant);
                }}
                className="flex items-center justify-center border border-white/20 bg-deep-black/60 px-6 py-4 font-display font-black uppercase text-white backdrop-blur-sm transition-all hover:border-neon-yellow/50 hover:text-neon-yellow active:scale-[0.99]"
                style={{
                  fontSize: '14px',
                  letterSpacing: '0.24em',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                Cadastrar
              </Link>
              <button
                type="button"
                className="mt-2 pt-1 text-center font-sans text-xs font-bold uppercase tracking-wider text-white/55 underline decoration-white/25 underline-offset-4 transition hover:text-neon-yellow/90 hover:decoration-neon-yellow/40"
                onClick={() => {
                  setError(null);
                  setForgotSent(false);
                  setMode('forgot');
                }}
              >
                Esqueci minha senha
              </button>
            </nav>
          ) : null}
        </div>

        <footer className="mx-auto mt-8 max-w-md text-center sm:mt-10">
          {/* Redes sociais */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <a
              href="https://www.instagram.com/olefootgame"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/70 transition-all hover:border-neon-yellow/40 hover:bg-neon-yellow/10 hover:text-neon-yellow"
              aria-label="Instagram"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
            <a
              href="https://www.youtube.com/@olefoot"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/70 transition-all hover:border-neon-yellow/40 hover:bg-neon-yellow/10 hover:text-neon-yellow"
              aria-label="YouTube"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>
            <a
              href="https://x.com/olefootgame"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/70 transition-all hover:border-neon-yellow/40 hover:bg-neon-yellow/10 hover:text-neon-yellow"
              aria-label="X (Twitter)"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
          </div>
          <p className="text-[10px] text-white/35 sm:text-[11px]">
            Olefoot © 2026 · Todos os direitos reservados
          </p>
        </footer>
      </div>
    </div>
  );
}
