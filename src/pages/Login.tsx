import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, ShoppingCart, Trophy, Users, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FitaRua, Hashtag, MarcaRua, SeletorDeIdioma } from '@/components/ui';
import { useGameDispatch, getGameState } from '@/game/store';
import { signInWithEmail, fetchOnboardingProfile, sendPasswordResetEmail, saveOnboardingProfile } from '@/supabase/auth';
import type { FormationSchemeId } from '@/match-engine/types';
import { fetchMyReferralCode, syncMyExpLifetime } from '@/supabase/referrals';
import { FORMATION_TACTICAL_DEFAULTS } from '@/tactics/formationDefaults';
import { FaixaConvitePendente } from '@/components/FaixaConvitePendente';
import { destinoAposEntrar } from '@/supabase/expansaoConvite';
import { L, emIngles } from '@/i18n/L';

/**
 * Proposta de valor da landing.
 *
 * Aqui havia um "A/B" de 3 propostas: sorteava uma, guardava no localStorage e
 * fazia console.log. Ninguém conseguia ler o resultado — `product_events` só
 * aceita escrita de quem JÁ está logado, e esta tela é pré-sessão. Medido em
 * 2026-09-20: 5 logins em 30 dias. Um experimento assim não fecharia nunca.
 * Ficou a proposta que o jogo de fato é: revelar talento, construir clube,
 * disputar liga. Trocar o texto é editar aqui.
 */
const VALUE_PROP = {
  headline: {
    white1: L('A gente sabe que', 'We know'),
    yellow: L('você já virou noite para ser o melhor', 'you have pulled all-nighters to build the best'),
    white2: L('clube do mundo!', 'club in the world!'),
  },
  subheadline: L('Bem vindo ao OLEFOOT', 'Welcome to OLEFOOT'),
  features: [
    { icon: ShoppingCart, text: L('Revele novos talentos no mercado', 'Discover new talent in the market') },
    { icon: Trophy, text: L('Construa sua cidade do futebol', 'Build your football city') },
    { icon: Users, text: L('Dispute ligas contra gringos', 'Play leagues against the world') },
  ],
};

/**
 * DS 2027 · "RESPEITO É OURO" — o login é a capa do PDF: fita inclinada,
 * o grito em Anton com OURO chapado, o 9 de respeito. Formulário em concreto,
 * rótulo em mono, botão rua com sombra dura de papel.
 */
const INPUT =
  'w-full min-h-[50px] border-2 border-linha bg-concreto px-3.5 py-3 text-[15px] text-papel placeholder:text-fio focus:border-rua focus:outline-none';
const LABEL = 'mb-1.5 block font-prova text-[11.5px] font-bold uppercase tracking-[0.2em] text-mudo';
const CAIXA = 'flex flex-col border-t-2 border-papel pt-5';
const TITULO = 'font-impact text-[clamp(38px,11vw,52px)] uppercase leading-[0.92] text-papel';
/** Botão de ação do DS (rua + sombra dura de papel) — aqui precisa ser type="submit". */
const BOTAO_RUA =
  'inline-flex min-h-[54px] w-full items-center justify-center gap-2 bg-rua px-6 font-impact text-[21px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rua disabled:pointer-events-none disabled:opacity-40';
const VOLTAR =
  'mt-5 min-h-[40px] self-center font-prova text-[12px] font-bold uppercase tracking-[0.18em] text-mudo transition-colors hover:text-papel';

function Erro({ children }: { children: import('react').ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 border-l-[5px] border-baixa bg-concreto px-3.5 py-3 text-[13px] leading-snug text-papel">
      <span aria-hidden className="shrink-0 font-impact text-baixa">✗</span>
      <span className="flex-1">{children}</span>
    </div>
  );
}

export function Login() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const [mode, setMode] = useState<'landing' | 'form' | 'forgot' | 'complete'>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  // Mini-cadastro para usuários migrados (auth existe, profile não)
  const [compFirstName, setCompFirstName] = useState('');
  const [compLastName, setCompLastName] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compClubName, setCompClubName] = useState('');
  const [compFormation, setCompFormation] = useState<FormationSchemeId>('4-3-3');

  const onForgotSubmit = async (e: import('react').FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = await sendPasswordResetEmail(email);
      if (!r.ok) {
        setError(r.error ?? L('Não foi possível enviar o e-mail.', 'Could not send the email.'));
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
        let errorMsg = r.error === 'Supabase não configurado.' ? L(r.error, 'Supabase not configured.') : (r.error ?? L('Falha ao entrar.', 'Sign-in failed.'));
        if (errorMsg.includes('Invalid login credentials')) {
          errorMsg = L('E-mail ou senha incorretos. Verifica os dados e tenta novamente.', 'Wrong email or password. Check your details and try again.');
        } else if (errorMsg.includes('Email not confirmed')) {
          errorMsg = L('E-mail não confirmado. Verifica tua caixa de entrada.', 'Email not confirmed. Check your inbox.');
        } else if (errorMsg.includes('User not found')) {
          errorMsg = L('Conta não encontrada. Confira o e-mail ou cadastre-se.', 'Account not found. Check your email or sign up.');
        }
        setError(errorMsg);
        return;
      }
      // Hidrata managerProfile do Supabase pro Zustand local.
      const remote = await fetchOnboardingProfile();
      if (!remote || !remote.onboarding) {
        // Usuário migrado: auth OK mas sem profile. Mini-cadastro inline.
        setError(null);
        setMode('complete');
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
      // Full reload para que os hydrators re-montem com sessão válida.
      // Sem isso, os hydrators já rodaram (e falharam) antes do login.
      //
      // 🐞 E é por isso que o destino tem que ser resolvido AQUI. Eu tinha
      // posto a volta-pro-convite no RedirectIfRegistered, que nunca roda:
      // `window.location.href` recarrega a página e passa por cima do React
      // Router inteiro. O fundador clicou no convite, logou, e teve que colar
      // a URL de novo.
      window.location.href = destinoAposEntrar();
    } finally {
      setBusy(false);
    }
  };

  const onCompleteSubmit = async (e: import('react').FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const clubShort = compClubName.trim().split(/\s+/).filter(Boolean).length >= 2
        ? (compClubName.trim().split(/\s+/)[0]![0]! + compClubName.trim().split(/\s+/)[1]![0]!).toUpperCase()
        : compClubName.trim().slice(0, 3).toUpperCase();

      const managerProfile = {
        firstName: compFirstName.trim(),
        lastName: compLastName.trim(),
        email: email.trim(),
        phoneE164: compPhone.trim(),
      };

      const saveErr = await saveOnboardingProfile({
        displayName: managerProfile.firstName,
        clubName: compClubName.trim(),
        clubShort,
        onboarding: {
          managerProfile,
          favoriteRealTeam: null,
          formationScheme: compFormation,
        },
      });
      if (saveErr) {
        setError(saveErr);
        return;
      }

      dispatch({
        type: 'SET_USER_SETTINGS',
        partial: { managerProfile, favoriteRealTeam: null },
      });
      dispatch({
        type: 'ADMIN_PATCH_CLUB',
        partial: { name: compClubName.trim(), shortName: clubShort },
      });
      const tacticalDefaults = FORMATION_TACTICAL_DEFAULTS[compFormation];
      dispatch({
        type: 'SET_MANAGER_SLIDERS',
        partial: {
          formationScheme: compFormation,
          tacticalMentality: tacticalDefaults.tacticalMentality,
          defensiveLine: tacticalDefaults.defensiveLine,
          tempo: tacticalDefaults.tempo,
          tacticalStyle: tacticalDefaults.style,
        },
      });

      window.location.href = destinoAposEntrar();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rua-grao relative flex min-h-svh flex-col overflow-hidden bg-asfalto-27">
      {/* Quem veio de um convite de expansão precisa ver isso aqui — senão a
          tela de venda apaga o motivo pelo qual a pessoa clicou. */}
      <div className="relative z-20"><FaixaConvitePendente /></div>
      {/* Foto do muro só no topo, apagada; o scrim (preto → transparente) é o
          único degradê que o DS aceita: escurecer foto pra leitura. */}
      <div
        className="absolute inset-x-0 top-0 z-0 h-[62svh] bg-cover bg-[center_22%] bg-no-repeat opacity-45 grayscale sm:bg-center"
        style={{ backgroundImage: 'url(/login-hero.png)' }}
        aria-hidden
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 z-0 h-[62svh]"
        style={{ background: 'linear-gradient(180deg, rgba(13,13,12,0.55) 0%, rgba(13,13,12,0.75) 45%, #0D0D0C 100%)' }}
      />

      <header
        role="banner"
        className="relative z-[100] w-full shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pb-3 sm:pt-6 md:px-8"
      >
        <div className="mx-auto flex w-full min-w-0 max-w-6xl items-center justify-between gap-3">
          <Link to="/login" className="flex min-w-0 flex-1 items-center" aria-label="Olefoot">
            <MarcaRua tipo="wordmark" label="Olefoot" className="h-[22px] bg-rua sm:h-[26px]" />
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            <Hashtag className="hidden text-[12px] text-suave sm:inline">{L('#manager #futebol', '#manager #football')}</Hashtag>
            <SeletorDeIdioma />
          </div>
        </div>
      </header>

      {/* A fita da capa: #persista #correloko, inclinada, colada no muro. */}
      <FitaRua inclinacao={-3} className="relative z-10 mt-3 py-3" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 pb-6 sm:px-8 sm:pb-8 md:px-10">
        <div className="min-h-[5vh] shrink-0 sm:min-h-[8vh]" aria-hidden />

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-end">
          {mode === 'landing' ? (
            <>
              <div className="flex flex-col gap-4">
                <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.24em] text-rua">
                  Olefoot 2027 — {L('Jogue agora', 'Play now')}
                </span>

                <div className="flex min-w-0 items-end justify-between gap-3">
                  <h1
                    className="min-w-0 font-impact uppercase leading-[0.9] text-papel"
                    style={{ fontSize: 'clamp(56px, 17vw, 92px)' }}
                  >
                    {L('Respeito', 'Respect')}
                    <br />
                    {L('é ', 'is ')}
                    <span className="text-ouro-27">{L('ouro.', 'gold.')}</span>
                  </h1>
                  <div className="flex w-[22%] max-w-[96px] shrink-0 flex-col items-center gap-1 pb-1">
                    <MarcaRua tipo="nove" label={L('9 de respeito', '9 of respect')} className="w-full bg-rua" />
                  </div>
                </div>

                {/* A frase do fundador, na voz. */}
                <p className="font-voz text-[clamp(22px,6.4vw,28px)] leading-[1.08] text-papel">
                  {VALUE_PROP.headline.white1}{' '}
                  <span className="text-rua">{VALUE_PROP.headline.yellow}</span>{' '}
                  {VALUE_PROP.headline.white2}
                </p>

                <p className="font-prova text-[12.5px] leading-relaxed text-suave">
                  {L(
                    'A rua é o suporte. O jogo é a régua. O ouro é o prêmio de quem subiu do chão até lenda.',
                    'The street is the support. The game is the measure. Gold is the prize for whoever rose from the ground to legend.',
                  )}
                </p>
              </div>

              {/* O que é o jogo — lista de muro, não fila de cards. */}
              <ul className="mt-6 flex flex-col border-t-2 border-linha" aria-label={VALUE_PROP.subheadline}>
                {[
                  {
                    icon: ShoppingCart,
                    title: L('Mercado Real', 'Real Market'),
                    desc: L('Leilões ao vivo, garimpe talentos baratos e venda por fortuna', 'Live auctions: scout cheap talent and sell for a fortune'),
                  },
                  {
                    icon: Trophy,
                    title: L('Construa Sua Dinastia', 'Build Your Dynasty'),
                    desc: L('Décadas de carreira, jogadores envelhecem e novos talentos surgem', 'Decades of career: players age and new talent emerges'),
                  },
                  {
                    icon: Zap,
                    title: L('O Jogo Começou', 'Kick-off'),
                    desc: L('Mostre que você entende de futebol e domine o ranking mundial', 'Prove you know football and rule the world ranking'),
                  },
                ].map((f, i) => (
                  <li key={f.title} className="flex min-w-0 items-center gap-3.5 border-b border-linha py-3">
                    <span className="w-9 shrink-0 font-spray text-[26px] font-black leading-none text-rua">
                      0{i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-impact text-[19px] uppercase leading-[1.05] text-papel">{f.title}</h3>
                      <p className="mt-0.5 text-[12.5px] leading-snug text-suave">{f.desc}</p>
                    </div>
                    <f.icon aria-hidden className="h-5 w-5 shrink-0 text-mudo" strokeWidth={2.25} />
                  </li>
                ))}
              </ul>
              <p className="sr-only">{VALUE_PROP.features.map((f) => f.text).join(' · ')}</p>
            </>
          ) : mode === 'complete' ? (
            <div className={CAIXA}>
              <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.22em] text-ouro-27">
                — {L('Bem-vindo de volta', 'Welcome back')}
              </span>
              <h2 className={cn(TITULO, 'mt-2')}>{L('Completar cadastro', 'Complete sign-up')}</h2>
              <p className="mt-3 font-voz text-[21px] leading-[1.1] text-suave">
                {L('Tua conta da era anterior tá aqui. Completa e entra.', 'Your account from the previous era is here. Fill it in and come in.')}
              </p>
              <p className="sr-only">
                {L('Encontramos tua conta da era anterior. Completa os dados abaixo para entrar na nova plataforma.', 'We found your account from the previous era. Fill in the details below to join the new platform.')}
              </p>
              <form onSubmit={(e) => void onCompleteSubmit(e)} className="mt-5 flex flex-col gap-3.5" autoComplete="on">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block min-w-0">
                    <span className={LABEL}>{L('Nome', 'First name')}</span>
                    <input
                      type="text"
                      autoComplete="given-name"
                      value={compFirstName}
                      onChange={(e) => setCompFirstName(e.target.value)}
                      required
                      className={INPUT}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className={LABEL}>{L('Sobrenome', 'Last name')}</span>
                    <input
                      type="text"
                      autoComplete="family-name"
                      value={compLastName}
                      onChange={(e) => setCompLastName(e.target.value)}
                      required
                      className={INPUT}
                    />
                  </label>
                </div>
                <label className="block">
                  <span className={LABEL}>{L('Telefone (com DDD)', 'Phone (with country code)')}</span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={compPhone}
                    onChange={(e) => setCompPhone(e.target.value)}
                    placeholder="+5511999999999"
                    className={INPUT}
                  />
                </label>
                <label className="block">
                  <span className={LABEL}>{L('Nome do Clube', 'Club name')}</span>
                  <input
                    type="text"
                    value={compClubName}
                    onChange={(e) => setCompClubName(e.target.value)}
                    required
                    placeholder={L('Ex: Olefoot FC', 'e.g. Olefoot FC')}
                    className={INPUT}
                  />
                </label>
                <label className="block">
                  <span className={LABEL}>{L('Formação', 'Formation')}</span>
                  <select
                    value={compFormation}
                    onChange={(e) => setCompFormation(e.target.value as FormationSchemeId)}
                    className={INPUT}
                  >
                    {(['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '4-5-1', '5-3-2', '3-4-3'] as FormationSchemeId[]).map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </label>
                {error ? <Erro>{error}</Erro> : null}
                <button
                  type="submit"
                  disabled={busy || !compFirstName.trim() || !compLastName.trim() || !compClubName.trim()}
                  className={cn(BOTAO_RUA, 'mt-1')}
                >
                  {busy ? L('Salvando…', 'Saving…') : <>{L('Entrar na Plataforma', 'Enter the Platform')} <span aria-hidden>→</span></>}
                </button>
              </form>
            </div>
          ) : mode === 'forgot' ? (
            <div className={CAIXA}>
              <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.22em] text-mudo">— {L('Senha', 'Password')}</span>
              <h2 className={cn(TITULO, 'mt-2')}>{L('Recuperar senha', 'Reset password')}</h2>
              {forgotSent ? (
                <div className="mt-5 flex flex-col gap-3">
                  {/* Lambe colado: o aviso de que o link saiu. */}
                  <p className="-rotate-1 bg-cal px-4 py-3.5 text-[13.5px] leading-snug text-asfalto-27">
                    {emIngles()
                      ? <>✓ We sent a reset link to <strong>{email}</strong>. Open the email to set a new password.</>
                      : <>✓ Enviamos um link de recuperação para <strong>{email}</strong>. Abre o e-mail para definir uma nova senha.</>}
                  </p>
                  <p className="font-prova text-[12px] text-mudo">
                    {L('Não recebeu? Verifica a pasta de spam ou tenta novamente.', "Didn't get it? Check your spam folder or try again.")}
                  </p>
                </div>
              ) : (
                <form onSubmit={(e) => void onForgotSubmit(e)} className="mt-4 flex flex-col gap-3.5" autoComplete="on">
                  <p className="text-[13px] leading-snug text-suave">
                    {L('Informa o e-mail da tua conta. Te enviaremos um link para redefinir a senha.', "Enter your account email. We'll send you a link to reset your password.")}
                  </p>
                  <label className="block">
                    <span className={LABEL}>{L('E-mail', 'Email')}</span>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e: import('react').ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                      required
                      className={INPUT}
                    />
                  </label>
                  {error ? <Erro>{error}</Erro> : null}
                  <button type="submit" disabled={busy || !email} className={cn(BOTAO_RUA, 'mt-1')}>
                    {busy ? L('Enviando…', 'Sending…') : <>{L('Enviar link', 'Send link')} <span aria-hidden>→</span></>}
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
                className={VOLTAR}
              >
                ← {L('Voltar', 'Back')}
              </button>
            </div>
          ) : (
            <div className={CAIXA}>
              <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.22em] text-mudo">— {L('Vestiário', 'Locker room')}</span>
              <h2 className={cn(TITULO, 'mt-2')}>{L('Entrar', 'Sign in')}</h2>
              <form onSubmit={(e) => void onSubmit(e)} className="mt-5 flex flex-col gap-3.5" autoComplete="on">
                <label className="block">
                  <span className={LABEL}>{L('E-mail', 'Email')}</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={INPUT}
                  />
                </label>
                <label className="block">
                  <span className={LABEL}>{L('Senha', 'Password')}</span>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className={cn(INPUT, 'pr-12')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-mudo transition-colors hover:text-papel"
                      aria-label={showPassword ? L('Ocultar senha', 'Hide password') : L('Mostrar senha', 'Show password')}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                {error ? <Erro>{error}</Erro> : null}
                <button type="submit" disabled={busy || !email || !password} className={cn(BOTAO_RUA, 'mt-1')}>
                  {busy ? L('Entrando…', 'Signing in…') : <>{L('Entrar', 'Sign in')} <span aria-hidden>→</span></>}
                </button>
              </form>
              <button type="button" onClick={() => setMode('landing')} className={VOLTAR}>
                ← {L('Voltar', 'Back')}
              </button>
            </div>
          )}

          {mode === 'landing' ? (
            <nav className="mt-8 flex w-full flex-col gap-4 sm:mt-10" aria-label={L('Acesso à conta', 'Account access')}>
              <button
                type="button"
                onClick={() => {
                  setMode('form');
                }}
                className={BOTAO_RUA}
              >
                {L('Entrar', 'Sign in')} <span aria-hidden>→</span>
              </button>
              <Link
                to="/cadastro"
                className="inline-flex min-h-[54px] w-full items-center justify-center border-2 border-papel font-impact text-[21px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rua"
              >
                {L('Cadastrar', 'Sign up')}
              </Link>
              <button
                type="button"
                className="min-h-[40px] self-center font-prova text-[12px] font-bold uppercase tracking-[0.18em] text-mudo underline decoration-fio underline-offset-4 transition-colors hover:text-papel"
                onClick={() => {
                  setError(null);
                  setForgotSent(false);
                  setMode('forgot');
                }}
              >
                {L('Esqueci minha senha', 'Forgot my password')}
              </button>
            </nav>
          ) : null}
        </div>

        <footer className="mx-auto mt-10 w-full max-w-md text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <a
              href="https://www.instagram.com/olefootgame"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 w-11 items-center justify-center border-2 border-linha text-mudo transition-colors hover:border-papel hover:text-papel"
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
              className="flex h-11 w-11 items-center justify-center border-2 border-linha text-mudo transition-colors hover:border-papel hover:text-papel"
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
              className="flex h-11 w-11 items-center justify-center border-2 border-linha text-mudo transition-colors hover:border-papel hover:text-papel"
              aria-label="X (Twitter)"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
          </div>
          <p className="font-prova text-[11px] uppercase tracking-[0.14em] text-fio">
            Olefoot © 2026 · {L('Todos os direitos reservados', 'All rights reserved')}
          </p>
        </footer>
      </div>
    </div>
  );
}
