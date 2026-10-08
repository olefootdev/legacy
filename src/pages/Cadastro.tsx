import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { User, Shield, Heart, ArrowRight, ArrowLeft, Check, Sparkles, Trophy, Users, Briefcase, Mic, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarraAcao } from '@/components/ui/BarraAcao';
import { Hashtag, MarcaRua } from '@/components/ui';
import { COUNTRY_DIAL_OPTIONS, isoToFlag, type CountryDialOption } from '@/lib/countryDialCodes';
import type { FormationSchemeId } from '@/match-engine/types';
import { useGameDispatch, useGameStore } from '@/game/store';
import { FORMATION_TACTICAL_DEFAULTS } from '@/tactics/formationDefaults';
import {
  clearPendingReferrerCode,
  readPendingReferrerCode,
  normalizeReferralCode,
} from '@/wallet/referralCode';
import { PRESET_LABEL_PT } from '@/tactics/playingStyle';
import { syncProfileManagerFirstName } from '@/supabase/profileDisplayName';
import { LEAGUE_BUCKETS, SELECAO_BRASIL } from '@/settings/worldClubs';
import type { FavoriteRealTeamRef } from '@/game/types';
import { signUpWithEmail, checkEmailExists } from '@/supabase/auth';
import { fetchMyReferralCode } from '@/supabase/referrals';
import { checkClubShortAvailable, computeUsername } from '@/supabase/managerUsername';
import { destinoAposEntrar } from '@/supabase/expansaoConvite';
import { FaixaConvitePendente } from '@/components/FaixaConvitePendente';
import { L } from '@/i18n/L';

type UserProfile =
  | 'apaixonado'
  | 'novo_talento'
  | 'atleta_atuacao'
  | 'profissional'
  | 'midia'
  | 'ex_jogador';

const FORMATION_OPTIONS: FormationSchemeId[] = [
  '4-3-3',
  '4-4-2',
  '4-2-3-1',
  '3-5-2',
  '4-5-1',
  '5-3-2',
  '3-4-3',
];

const BRAZIL_STATES_DDD = [
  {
    state: 'AC',
    name: 'Acre',
    cities: [
      { name: 'Rio Branco e região', ddd: '68' },
    ]
  },
  {
    state: 'AL',
    name: 'Alagoas',
    cities: [
      { name: 'Maceió e região', ddd: '82' },
    ]
  },
  {
    state: 'AP',
    name: 'Amapá',
    cities: [
      { name: 'Macapá e região', ddd: '96' },
    ]
  },
  {
    state: 'AM',
    name: 'Amazonas',
    cities: [
      { name: 'Manaus', ddd: '92' },
      { name: 'Interior', ddd: '97' },
    ]
  },
  {
    state: 'BA',
    name: 'Bahia',
    cities: [
      { name: 'Salvador', ddd: '71' },
      { name: 'Feira de Santana', ddd: '75' },
      { name: 'Vitória da Conquista', ddd: '77' },
      { name: 'Ilhéus e Itabuna', ddd: '73' },
      { name: 'Juazeiro', ddd: '74' },
    ]
  },
  {
    state: 'CE',
    name: 'Ceará',
    cities: [
      { name: 'Fortaleza', ddd: '85' },
      { name: 'Juazeiro do Norte e Crato', ddd: '88' },
    ]
  },
  {
    state: 'DF',
    name: 'Distrito Federal',
    cities: [
      { name: 'Brasília', ddd: '61' },
    ]
  },
  {
    state: 'ES',
    name: 'Espírito Santo',
    cities: [
      { name: 'Vitória', ddd: '27' },
      { name: 'Cachoeiro de Itapemirim', ddd: '28' },
    ]
  },
  {
    state: 'GO',
    name: 'Goiás',
    cities: [
      { name: 'Goiânia', ddd: '62' },
      { name: 'Rio Verde', ddd: '64' },
    ]
  },
  {
    state: 'MA',
    name: 'Maranhão',
    cities: [
      { name: 'São Luís', ddd: '98' },
      { name: 'Imperatriz', ddd: '99' },
    ]
  },
  {
    state: 'MT',
    name: 'Mato Grosso',
    cities: [
      { name: 'Cuiabá', ddd: '65' },
      { name: 'Rondonópolis e Sinop', ddd: '66' },
    ]
  },
  {
    state: 'MS',
    name: 'Mato Grosso do Sul',
    cities: [
      { name: 'Campo Grande e região', ddd: '67' },
    ]
  },
  {
    state: 'MG',
    name: 'Minas Gerais',
    cities: [
      { name: 'Belo Horizonte', ddd: '31' },
      { name: 'Juiz de Fora', ddd: '32' },
      { name: 'Governador Valadares', ddd: '33' },
      { name: 'Uberlândia', ddd: '34' },
      { name: 'Poços de Caldas e Varginha', ddd: '35' },
      { name: 'Divinópolis e Pará de Minas', ddd: '37' },
      { name: 'Montes Claros', ddd: '38' },
    ]
  },
  {
    state: 'PA',
    name: 'Pará',
    cities: [
      { name: 'Belém', ddd: '91' },
      { name: 'Santarém', ddd: '93' },
      { name: 'Marabá', ddd: '94' },
    ]
  },
  {
    state: 'PB',
    name: 'Paraíba',
    cities: [
      { name: 'João Pessoa e região', ddd: '83' },
    ]
  },
  {
    state: 'PR',
    name: 'Paraná',
    cities: [
      { name: 'Curitiba', ddd: '41' },
      { name: 'Ponta Grossa', ddd: '42' },
      { name: 'Londrina', ddd: '43' },
      { name: 'Maringá', ddd: '44' },
      { name: 'Foz do Iguaçu', ddd: '45' },
      { name: 'Francisco Beltrão e Pato Branco', ddd: '46' },
    ]
  },
  {
    state: 'PE',
    name: 'Pernambuco',
    cities: [
      { name: 'Recife', ddd: '81' },
      { name: 'Caruaru e Petrolina', ddd: '87' },
    ]
  },
  {
    state: 'PI',
    name: 'Piauí',
    cities: [
      { name: 'Teresina', ddd: '86' },
      { name: 'Parnaíba e Picos', ddd: '89' },
    ]
  },
  {
    state: 'RJ',
    name: 'Rio de Janeiro',
    cities: [
      { name: 'Rio de Janeiro', ddd: '21' },
      { name: 'Campos dos Goytacazes', ddd: '22' },
      { name: 'Volta Redonda e Petrópolis', ddd: '24' },
    ]
  },
  {
    state: 'RN',
    name: 'Rio Grande do Norte',
    cities: [
      { name: 'Natal e região', ddd: '84' },
    ]
  },
  {
    state: 'RS',
    name: 'Rio Grande do Sul',
    cities: [
      { name: 'Porto Alegre', ddd: '51' },
      { name: 'Pelotas e Rio Grande', ddd: '53' },
      { name: 'Caxias do Sul', ddd: '54' },
      { name: 'Santa Maria', ddd: '55' },
    ]
  },
  {
    state: 'RO',
    name: 'Rondônia',
    cities: [
      { name: 'Porto Velho e região', ddd: '69' },
    ]
  },
  {
    state: 'RR',
    name: 'Roraima',
    cities: [
      { name: 'Boa Vista e região', ddd: '95' },
    ]
  },
  {
    state: 'SC',
    name: 'Santa Catarina',
    cities: [
      { name: 'Joinville e Blumenau', ddd: '47' },
      { name: 'Florianópolis', ddd: '48' },
      { name: 'Chapecó e Criciúma', ddd: '49' },
    ]
  },
  {
    state: 'SP',
    name: 'São Paulo',
    cities: [
      { name: 'São Paulo', ddd: '11' },
      { name: 'São José dos Campos', ddd: '12' },
      { name: 'Santos', ddd: '13' },
      { name: 'Bauru', ddd: '14' },
      { name: 'Sorocaba', ddd: '15' },
      { name: 'Ribeirão Preto', ddd: '16' },
      { name: 'São José do Rio Preto', ddd: '17' },
      { name: 'Presidente Prudente', ddd: '18' },
      { name: 'Campinas', ddd: '19' },
    ]
  },
  {
    state: 'SE',
    name: 'Sergipe',
    cities: [
      { name: 'Aracaju e região', ddd: '79' },
    ]
  },
  {
    state: 'TO',
    name: 'Tocantins',
    cities: [
      { name: 'Palmas e região', ddd: '63' },
    ]
  },
];

/** `supabase/auth.ts` é compartilhado com o REVELA e fica em PT; o inglês sai aqui, na tela. */
const ERRO_AUTH_EN: Record<string, string> = {
  'Supabase não configurado.': 'Supabase not configured.',
  'Conta criada, confirma teu e-mail e tenta login.': 'Account created — confirm your email and sign in.',
};
function traduzErroAuth(msg: string | undefined): string | undefined {
  return msg ? L(msg, ERRO_AUTH_EN[msg] ?? msg) : msg;
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

function buildPhoneE164(dialDigits: string, ddd: string, local: string): string {
  const a = digitsOnly(ddd);
  const n = digitsOnly(local);
  if (!dialDigits || !a || !n) return '';
  return `+${dialDigits}${a}${n}`;
}

function simpleEmailOk(email: string): boolean {
  const t = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

const inputClass =
  'w-full min-h-[48px] border-2 border-linha bg-concreto px-3.5 py-2.5 text-[15px] text-papel placeholder:text-fio focus:border-rua focus:outline-none';

/** Rótulo de campo DS 2027 (A PROVA: Geist Mono, mudo). */
const labelClass = 'mb-1.5 block font-prova text-[11.5px] font-bold uppercase tracking-[0.2em] text-mudo';
/** Aviso inline de limite/caractere — mono, cor de atenção. */
const warnClass = 'font-prova text-[11px] font-bold uppercase tracking-[0.14em] text-rua';
const hintClass = 'font-prova text-[11px] text-mudo';
/** Opção selecionável (perfil, clube): card chapado; selecionado = borda volt. */
const opcao = (selected: boolean) =>
  cn(
    'border-2 bg-concreto transition-colors',
    selected ? 'border-rua' : 'border-linha hover:border-fio',
  );

export function Cadastro() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const lineup = useGameStore((s) => s.lineup);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dialOption, setDialOption] = useState<CountryDialOption>(COUNTRY_DIAL_OPTIONS[0]);
  const [customDialDigits, setCustomDialDigits] = useState('');
  const [brazilState, setBrazilState] = useState<string>('');
  const [brazilCity, setBrazilCity] = useState<string>('');
  const [ddd, setDdd] = useState('');
  const [localPhone, setLocalPhone] = useState('');
  const [referrerCode, setReferrerCode] = useState('');

  const [clubName, setClubName] = useState('');
  const [initials, setInitials] = useState('');
  /** Avisos inline pro usuário quando ele excede limite ou usa caractere inválido. */
  const [clubNameWarn, setClubNameWarn] = useState<string | null>(null);
  const [initialsWarn, setInitialsWarn] = useState<string | null>(null);
  const [formationScheme, setFormationScheme] = useState<FormationSchemeId>('4-3-3');

  const [favoriteTeam, setFavoriteTeam] = useState<FavoriteRealTeamRef | null>(null);
  const [leagueBucketId, setLeagueBucketId] = useState<string>('brasil');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [finishBusy, setFinishBusy] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const [initialsTaken, setInitialsTaken] = useState(false);
  const [initialsChecking, setInitialsChecking] = useState(false);

  const { inviteCode: inviteCodeFromPath } = useParams<{ inviteCode?: string }>();
  const [referrerFromInvite, setReferrerFromInvite] = useState(false);
  useEffect(() => {
    // Prioridade: código no path (/cadastro/:inviteCode) > sessionStorage (legacy).
    const fromPath = inviteCodeFromPath ? normalizeReferralCode(inviteCodeFromPath) : null;
    const p = fromPath ?? readPendingReferrerCode();
    if (p) {
      setReferrerCode(p);
      setReferrerFromInvite(true);
    }
  }, [inviteCodeFromPath]);

  useEffect(() => {
    setEmailTaken(false);
    if (!simpleEmailOk(email)) return;
    setEmailChecking(true);
    const t = setTimeout(async () => {
      const taken = await checkEmailExists(email);
      setEmailTaken(taken);
      setEmailChecking(false);
    }, 450);
    return () => {
      clearTimeout(t);
      setEmailChecking(false);
    };
  }, [email]);

  useEffect(() => {
    setInitialsTaken(false);
    const clean = initials.trim();
    if (clean.length < 2) return;
    setInitialsChecking(true);
    const t = setTimeout(async () => {
      const available = await checkClubShortAvailable(clean);
      setInitialsTaken(!available);
      setInitialsChecking(false);
    }, 400);
    return () => {
      clearTimeout(t);
      setInitialsChecking(false);
    };
  }, [initials]);

  const previewUsername = useMemo(
    () => computeUsername(firstName, initials),
    [firstName, initials],
  );

  const dialDigits = useMemo(() => {
    if (dialOption.iso2 === 'OTHER') return digitsOnly(customDialDigits);
    return digitsOnly(dialOption.dial);
  }, [dialOption, customDialDigits]);

  const phoneE164 = useMemo(() => buildPhoneE164(dialDigits, ddd, localPhone), [dialDigits, ddd, localPhone]);

  const step1Valid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    simpleEmailOk(email) &&
    !emailTaken &&
    !emailChecking &&
    password.length >= 6 &&
    phoneE164.length >= 8;

  const step2Valid = clubName.trim().length > 0 && initials.trim().length > 0 && !initialsTaken && !initialsChecking;
  const step3Valid = !!favoriteTeam && !!userProfile;

  const goNext = () => {
    if (step === 1 && step1Valid) setStep(2);
    else if (step === 2 && step2Valid) setStep(3);
  };

  const [finishError, setFinishError] = useState<string | null>(null);

  const finish = async () => {
    if (!step3Valid || finishBusy) return;
    setFinishError(null);
    setFinishBusy(true);
    const sn = initials.trim().toUpperCase().slice(0, 6);
    try {
      // Supabase signup ANTES de alterar o save local. Se der erro (email já
      // existente, senha fraca, etc), não quebramos o estado local.
      const managerProfile = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phoneE164,
      };
      const signUp = await signUpWithEmail({
        email: email.trim(),
        password,
        managerProfile,
        favoriteRealTeam: favoriteTeam,
        clubName: clubName.trim(),
        clubShort: sn,
        formationScheme,
        referredByCode: normalizeReferralCode(referrerCode),
        userProfile: userProfile ?? null,
      });
      if (!signUp.ok) {
        setFinishError(traduzErroAuth(signUp.error) ?? L('Falha ao criar conta.', 'Could not create account.'));
        return;
      }
      dispatch({
        type: 'SET_USER_SETTINGS',
        partial: {
          managerProfile,
          favoriteRealTeam: favoriteTeam,
        },
      });
      clearPendingReferrerCode();
      const refNorm = normalizeReferralCode(referrerCode);
      if (refNorm) {
        dispatch({ type: 'WALLET_SET_SPONSOR', sponsorId: refNorm });
      }
      // Sincroniza código de indicação gerado pelo servidor (trigger DB).
      try {
        const serverCode = await fetchMyReferralCode();
        if (serverCode) {
          dispatch({ type: 'WALLET_SYNC_REFERRAL_CODE', code: serverCode });
        }
      } catch (e) {
        console.warn('[Cadastro] referral code sync skipped', e);
      }
      dispatch({
        type: 'ADMIN_PATCH_CLUB',
        partial: { name: clubName.trim(), shortName: sn },
      });
      const tacticalDefaults = FORMATION_TACTICAL_DEFAULTS[formationScheme];
      dispatch({
        type: 'SET_MANAGER_SLIDERS',
        partial: {
          formationScheme,
          tacticalMentality: tacticalDefaults.tacticalMentality,
          defensiveLine: tacticalDefaults.defensiveLine,
          tempo: tacticalDefaults.tempo,
          tacticalStyle: tacticalDefaults.style,
        },
      });
      dispatch({ type: 'SET_LINEUP', lineup: { ...lineup }, formationScheme });

      // [2026-05-18] Auto-grant silencioso REMOVIDO. O novo manager cai na
      // Home com plantel vazio → OnboardingCeremony entra automaticamente
      // (6 capítulos: intro, sorteio EXP, 25 pioneiros, top 3, daily bonus,
      // boas-vindas). Não duplicar a entrega do pack aqui.

      await syncProfileManagerFirstName(firstName.trim());

      navigate(destinoAposEntrar());
    } finally {
      setFinishBusy(false);
    }
  };

  return (
    <div className="rua-grao relative flex min-h-svh flex-col overflow-hidden bg-asfalto-27 max-sm:pb-[var(--altura-barra-acao,0px)]">
      {/* Quem veio de um convite de expansão precisa ver isso aqui — senão a
          tela de venda apaga o motivo pelo qual a pessoa clicou. */}
      <div className="relative z-20"><FaixaConvitePendente /></div>
      {/* Background layers */}
      {/* Foto do muro só no topo, apagada; o scrim preto → transparente é o
          único degradê do DS (escurecer foto pra leitura). */}
      <div
        className="absolute inset-x-0 top-0 z-0 h-[48svh] bg-cover bg-[center_22%] bg-no-repeat opacity-35 grayscale sm:bg-center"
        style={{ backgroundImage: 'url(/login-hero.png)' }}
        aria-hidden
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 z-0 h-[48svh]"
        style={{ background: 'linear-gradient(180deg, rgba(13,13,12,0.55) 0%, rgba(13,13,12,0.8) 50%, #0D0D0C 100%)' }}
      />

      {/* Header */}
      <header role="banner" className="relative z-[100] w-full shrink-0 bg-transparent px-4 pb-2 pt-5 sm:px-6 sm:pb-3 sm:pt-6 md:px-8">
        <div className="mx-auto flex w-full min-w-0 max-w-6xl items-center justify-between gap-3">
          <Link to="/login" className="flex min-w-0 flex-1 items-center gap-3" aria-label="Olefoot">
            <MarcaRua tipo="wordmark" label="Olefoot" className="h-[22px] bg-rua sm:h-[26px]" />
          </Link>
          <Hashtag className="shrink-0 text-[12px] text-suave">{L('#cadastro', '#signup')}</Hashtag>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 pb-6 sm:px-8 sm:pb-8 md:px-10">
        <div className="min-h-[4vh] shrink-0 sm:min-h-[8vh]" aria-hidden />

        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
          <div className="flex flex-col">

            {/* Passos: 3 segmentos de rua + contagem em spray. */}
            <div className="mb-6 flex flex-col gap-2.5" aria-label={L(`Passo ${step} de 3`, `Step ${step} of 3`)}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-prova text-[11.5px] font-bold uppercase tracking-[0.22em] text-mudo">
                  — {L('Cadastro', 'Sign-up')}
                </span>
                <span className="font-spray text-[30px] font-black leading-none text-rua">
                  0{step}<span className="text-fio">/03</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {([1, 2, 3] as const).map((n) => {
                  const Icon = step > n ? Check : n === 1 ? User : n === 2 ? Shield : Heart;
                  return (
                    <div key={n} className="flex min-w-0 flex-col gap-1.5">
                      <span aria-hidden className={cn('h-2', step >= n ? 'bg-rua' : 'bg-linha')} />
                      <span
                        className={cn(
                          'flex min-w-0 items-center gap-1 font-prova text-[10.5px] font-bold uppercase tracking-[0.12em]',
                          step === n ? 'text-papel' : step > n ? 'text-suave' : 'text-fio',
                        )}
                      >
                        <Icon aria-hidden className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {n === 1 ? L('Conta', 'Account') : n === 2 ? L('Clube', 'Club') : L('Coração', 'Heart')}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step title */}
            <div className="mb-2 border-t-2 border-papel pt-5">
              <h1
                className="font-impact uppercase leading-[0.92] text-papel"
                style={{ fontSize: 'clamp(40px, 12vw, 58px)' }}
              >
                {step === 1 && L('Crie sua conta', 'Create your account')}
                {step === 2 && L('Monte seu clube', 'Build your club')}
                {step === 3 && L('Escolha seu time', 'Pick your team')}
              </h1>
              <Hashtag className="mt-2 text-[12px]">
                {step === 1 && L('#passo1 · dados e acesso', '#step1 · details & access')}
                {step === 2 && L('#passo2 · clube e formação', '#step2 · club & formation')}
                {step === 3 && L('#passo3 · time do coração', '#step3 · team you support')}
              </Hashtag>
            </div>

        {step === 1 && (
          <div className="mt-8 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className={labelClass}>{L('Nome', 'First name')}</span>
                <input
                  className={inputClass}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className={labelClass}>{L('Sobrenome', 'Last name')}</span>
                <input
                  className={inputClass}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </label>
            </div>
            <label className="block">
              <span className={labelClass}>{L('E-mail', 'Email')}</span>
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-invalid={emailTaken || undefined}
              />
              {simpleEmailOk(email) && emailChecking ? (
                <p className="mt-1 text-[11px] text-mudo">{L('Verificando…', 'Checking…')}</p>
              ) : null}
              {emailTaken ? (
                <p className="mt-1 text-[11px] text-baixa">
                  ✗ {L('E-mail já cadastrado.', 'Email already registered.')}{' '}
                  <Link to="/login" className="underline decoration-baixa/50 hover:text-papel">
                    {L('Fazer login', 'Sign in')}
                  </Link>
                </p>
              ) : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-mudo">
                <span className="font-prova text-[10.5px] font-medium uppercase tracking-[0.14em]">{L('Senha', 'Password')}</span>{' '}
                <span className="text-mudo">{L('(mín. 6 chars — usada pra entrar de qualquer dispositivo)', '(min. 6 chars — used to sign in on any device)')}</span>
              </span>
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
              />
            </label>
            <label className="block">
              <span className="mb-1 flex items-center justify-between gap-2">
                <span className="font-prova text-[10.5px] font-medium uppercase tracking-[0.14em] text-mudo">
                  {L('Código de indicação', 'Referral code')} <span className="normal-case tracking-normal text-mudo">{L('(opcional)', '(optional)')}</span>
                </span>
                {referrerFromInvite && normalizeReferralCode(referrerCode) ? (
                  <span className="shrink-0 bg-rua px-2 py-0.5 font-prova text-[10.5px] font-bold uppercase tracking-[0.1em] text-asfalto-27">
                    ✓ {L('Convite aplicado', 'Invite applied')}
                  </span>
                ) : null}
              </span>
              <input
                className={inputClass}
                value={referrerCode}
                onChange={(e) => {
                  setReferrerCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
                  setReferrerFromInvite(false);
                }}
                placeholder={L('ex. ABC123XY', 'e.g. ABC123XY')}
                maxLength={8}
                autoComplete="off"
              />
              <p className="mt-1 text-[10.5px] text-mudo">
                {L('Se você tiver um link de convite, o código já vem preenchido. Não dá pra alterar depois de concluir o cadastro.', "If you have an invite link, the code is already filled in. It can't be changed after you finish signing up.")}
              </p>
            </label>
            <div>
              <span className={cn(labelClass, 'mb-2')}>{L('Telefone', 'Phone')}</span>
              <div className="space-y-2.5">
                {/* Linha 1: DDI + DDD */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[10.5px] text-mudo">{L('DDI (País)', 'Country code')}</label>
                    <select
                      className={inputClass}
                      value={dialOption.iso2}
                      onChange={(e) => {
                        const o = COUNTRY_DIAL_OPTIONS.find((x) => x.iso2 === e.target.value);
                        if (o) {
                          setDialOption(o);
                          if (o.iso2 !== 'BR') {
                            setBrazilState('');
                            setDdd('');
                          }
                        }
                      }}
                    >
                      {COUNTRY_DIAL_OPTIONS.map((c) => (
                        <option key={c.iso2} value={c.iso2}>
                          {isoToFlag(c.iso2)} {c.name} {c.dial}
                        </option>
                      ))}
                    </select>
                  </div>
                  {dialOption.iso2 === 'OTHER' && (
                    <div className="w-28">
                      <label className="mb-1 block text-[10.5px] text-mudo">{L('Código', 'Code')}</label>
                      <input
                        className={inputClass}
                        placeholder={L('ex. 352', 'e.g. 352')}
                        value={customDialDigits}
                        onChange={(e) => setCustomDialDigits(e.target.value)}
                        inputMode="numeric"
                      />
                    </div>
                  )}
                  {dialOption.iso2 === 'BR' ? (
                    <div className="w-20">
                      <label className="mb-1 block text-[10.5px] text-mudo">{L('UF', 'State')}</label>
                      <select
                        className={inputClass}
                        value={brazilState}
                        onChange={(e) => {
                          setBrazilState(e.target.value);
                          setBrazilCity('');
                          setDdd('');
                        }}
                      >
                        <option value="">--</option>
                        {BRAZIL_STATES_DDD.map((s) => (
                          <option key={s.state} value={s.state}>
                            {s.state}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : dialOption.iso2 !== 'OTHER' ? (
                    <div className="w-24">
                      <label className="mb-1 block text-[10.5px] text-mudo">{L('DDD', 'Area code')}</label>
                      <input
                        className={inputClass}
                        placeholder={L('DDD', 'Area code')}
                        value={ddd}
                        onChange={(e) => setDdd(e.target.value)}
                        inputMode="numeric"
                      />
                    </div>
                  ) : null}
                </div>

                {/* Linha 2: Cidade + Número */}
                <div className="flex gap-2">
                  {dialOption.iso2 === 'BR' && brazilState ? (
                    <div className="flex-1">
                      <label className="mb-1 block text-[10.5px] text-mudo">{L('Cidade/Região', 'City/Region')}</label>
                      <select
                        className={inputClass}
                        value={brazilCity}
                        onChange={(e) => {
                          setBrazilCity(e.target.value);
                          const state = BRAZIL_STATES_DDD.find((s) => s.state === brazilState);
                          const city = state?.cities.find((c) => c.name === e.target.value);
                          if (city) {
                            setDdd(city.ddd);
                          }
                        }}
                      >
                        <option value="">{L('Selecione', 'Select')}</option>
                        {BRAZIL_STATES_DDD.find((s) => s.state === brazilState)?.cities.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div className={dialOption.iso2 === 'BR' && brazilState ? 'flex-1' : 'w-full'}>
                    <label className="mb-1 block text-[10.5px] text-mudo">{L('Número', 'Number')}</label>
                    <input
                      className={inputClass}
                      placeholder={L('Número do telefone', 'Phone number')}
                      value={localPhone}
                      onChange={(e) => setLocalPhone(e.target.value)}
                      inputMode="tel"
                      autoComplete="tel-national"
                    />
                  </div>
                </div>
              </div>
              {phoneE164 ? (
                <p className="mt-1.5 font-prova text-[10.5px] text-mudo">{L('Seu telefone é', 'Your phone is')} {phoneE164}</p>
              ) : null}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-8 space-y-6">
            {/* Seleção de perfil */}
            <div>
              <p className="mb-3 font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">
                — {L('Qual seu perfil?', "What's your profile?")}
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {[
                  { id: 'apaixonado' as const, label: L('Apaixonado por futebol', 'Football lover'), icon: Heart, color: 'rose' },
                  { id: 'novo_talento' as const, label: L('Novo talento', 'New talent'), icon: Sparkles, color: 'cyan' },
                  { id: 'atleta_atuacao' as const, label: L('Atleta em atuação', 'Active athlete'), icon: Trophy, color: 'amber' },
                  { id: 'profissional' as const, label: L('Profissional', 'Professional'), icon: Briefcase, color: 'blue' },
                  { id: 'midia' as const, label: L('Mídia', 'Media'), icon: Mic, color: 'purple' },
                  { id: 'ex_jogador' as const, label: L('Ex-Jogador', 'Former player'), icon: Star, color: 'yellow' },
                ].map((profile) => {
                  const Icon = profile.icon;
                  const selected = userProfile === profile.id;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => setUserProfile(profile.id)}
                      className={cn('flex flex-col items-center gap-2 p-3', opcao(selected))}
                      aria-pressed={selected}
                    >
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center transition-colors',
                        selected ? 'bg-rua text-asfalto-27' : 'border-2 border-linha text-mudo',
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className={cn(
                        'text-center font-impact text-[14px] uppercase leading-tight',
                        selected ? 'text-rua' : 'text-papel',
                      )}>
                        {profile.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {userProfile === 'ex_jogador' && (
                <div className="mt-3 -rotate-1 bg-cal px-3.5 py-2.5">
                  <p className="text-center text-[12px] text-asfalto-27">
                    {L('Entraremos em contato para validar seu perfil de ex-jogador', "We'll contact you to verify your former-player profile")}
                  </p>
                </div>
              )}
            </div>

            {/* Divisor */}
            <div className="border-t-2 border-dashed border-linha" />

            <div>
              <p className="mb-1 font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">
                — {L('Time do coração', 'Team you support')}
              </p>
              <Hashtag>{L(`#${LEAGUE_BUCKETS.length}ligas`, `#${LEAGUE_BUCKETS.length}leagues`)}</Hashtag>
            </div>

            {/* Seleção Brasil em destaque (1 card cheio no topo) */}
            <button
              type="button"
              onClick={() => setFavoriteTeam(SELECAO_BRASIL)}
              className={cn('flex w-full items-center gap-3 p-3', opcao(favoriteTeam?.id === SELECAO_BRASIL.id))}
              aria-pressed={favoriteTeam?.id === SELECAO_BRASIL.id}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-linha bg-asfalto-27">
                {SELECAO_BRASIL.logo ? (
                  <img
                    src={SELECAO_BRASIL.logo}
                    alt={SELECAO_BRASIL.name}
                    className="h-9 w-9 object-contain"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate font-voz text-[22px] leading-[1.05] text-papel">🇧🇷 {L('Seleção Brasil', 'Brazil National Team')}</p>
                <Hashtag className="text-[11px]">{L('#seleção', '#nationalteam')}</Hashtag>
              </div>
            </button>

            {/* Chips de ligas */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {LEAGUE_BUCKETS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setLeagueBucketId(b.id)}
                  className={cn(
                    'min-h-[34px] border-2 px-2.5 py-1 font-prova text-[11px] font-bold uppercase tracking-[0.08em] transition-colors',
                    leagueBucketId === b.id
                      ? 'border-rua bg-rua text-asfalto-27'
                      : 'border-linha text-mudo hover:border-fio hover:text-papel',
                  )}
                >
                  <span className="mr-1">{b.flag}</span>
                  {b.label.split(' — ')[1] ?? b.label}
                </button>
              ))}
            </div>

            {/* Grid de clubes da liga selecionada */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(LEAGUE_BUCKETS.find((b) => b.id === leagueBucketId)?.teams ?? []).map((c) => {
                const selected = favoriteTeam?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setFavoriteTeam(c)}
                    className={cn('group flex flex-col items-center gap-1 p-2', opcao(selected))}
                    aria-pressed={selected}
                  >
                    <div className={cn(
                      'flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border',
                      selected ? 'border-2 border-rua bg-asfalto-27' : 'border-2 border-linha bg-asfalto-27',
                    )}>
                      {c.logo ? (
                        <img
                          src={c.logo}
                          alt={c.name}
                          className="h-9 w-9 object-contain"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <span className={cn(
                      'line-clamp-2 text-center text-[11px] font-semibold leading-tight',
                      selected ? 'text-rua' : 'text-papel',
                    )}>
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {favoriteTeam ? (
              <p className="text-center font-voz text-[22px] leading-none text-rua">
                ✓ {favoriteTeam.name} {L('selecionado', 'selected')}
              </p>
            ) : null}
          </div>
        )}

        {step === 2 && (
          <div className="mt-8 space-y-5">
            {/* Nome do clube — limite 10 caracteres com aviso inline */}
            <label className="block">
              <span className={cn(labelClass, 'mb-2')}>
                {L('Nome do clube', 'Club name')}
              </span>
              <input
                className={inputClass}
                value={clubName}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw.length > 10) {
                    setClubName(raw.slice(0, 10));
                    setClubNameWarn(L('Máximo 10 letras', 'Max 10 letters'));
                    window.setTimeout(() => setClubNameWarn(null), 2400);
                    return;
                  }
                  setClubName(raw);
                  setClubNameWarn(null);
                }}
                onKeyDown={(e) => {
                  // Aviso quando tenta digitar além do limite
                  if (
                    clubName.length >= 10 &&
                    e.key.length === 1 &&
                    !e.metaKey && !e.ctrlKey && !e.altKey
                  ) {
                    setClubNameWarn(L('Máximo 10 letras', 'Max 10 letters'));
                    window.clearTimeout((window as any).__cnTimer);
                    (window as any).__cnTimer = window.setTimeout(
                      () => setClubNameWarn(null),
                      2400,
                    );
                  }
                }}
                maxLength={10}
                placeholder={L('Ex.: OLE FC', 'e.g. OLE FC')}
              />
              <div className="mt-1.5 flex items-center justify-between gap-3">
                {clubNameWarn ? (
                  <p
                    className={warnClass}
                    role="status"
                    aria-live="polite"
                  >
                    ⚠ {clubNameWarn}
                  </p>
                ) : (
                  <p className={hintClass}>
                    {L('Máximo 10 caracteres', 'Max 10 characters')}
                  </p>
                )}
                <span className="ole-num text-[10.5px] text-mudo">
                  {clubName.length}/10
                </span>
              </div>
            </label>

            {/* Iniciais — só A–Z, máximo 3 letras, sem pontos/caracteres especiais */}
            <label className="block">
              <span className={cn(labelClass, 'mb-2')}>
                {L('Iniciais', 'Initials')}
              </span>
              <input
                className={cn(inputClass, 'tracking-[0.4em] text-center font-spray font-black uppercase')}
                value={initials}
                onChange={(e) => {
                  const raw = e.target.value.toUpperCase();
                  // Filtra só A–Z (sem pontos, números ou especiais)
                  const cleaned = raw.replace(/[^A-Z]/g, '');
                  const trimmed = cleaned.slice(0, 3);
                  if (cleaned !== raw.replace(/\s/g, '')) {
                    setInitialsWarn(L('Use apenas letras A–Z', 'Letters A–Z only'));
                    window.clearTimeout((window as any).__inTimer);
                    (window as any).__inTimer = window.setTimeout(
                      () => setInitialsWarn(null),
                      2400,
                    );
                  } else if (cleaned.length > 3) {
                    setInitialsWarn(L('Máximo 3 letras', 'Max 3 letters'));
                    window.clearTimeout((window as any).__inTimer);
                    (window as any).__inTimer = window.setTimeout(
                      () => setInitialsWarn(null),
                      2400,
                    );
                  } else {
                    setInitialsWarn(null);
                  }
                  setInitials(trimmed);
                }}
                maxLength={3}
                placeholder="OLE"
                style={{ fontSize: '18px' }}
              />
              <div className="mt-1.5 flex items-center justify-between gap-3">
                {initialsWarn ? (
                  <p
                    className={warnClass}
                    role="status"
                    aria-live="polite"
                  >
                    ⚠ {initialsWarn}
                  </p>
                ) : (
                  <p className={hintClass}>
                    {L('3 letras (sem pontos ou números)', '3 letters (no dots or numbers)')}
                  </p>
                )}
                <span className="ole-num text-[10.5px] text-mudo">
                  {initials.length}/3
                </span>
              </div>

              {/* Status de disponibilidade das iniciais */}
              {initials.trim().length >= 2 && (
                <div className="mt-1">
                  {initialsChecking ? (
                    <p className={hintClass}>{L('Verificando…', 'Checking…')}</p>
                  ) : initialsTaken ? (
                    <p className="font-prova text-[10px] font-medium uppercase tracking-[0.14em] text-baixa">
                      ✗ {L('Iniciais já em uso — escolha outras', 'Initials taken — pick others')}
                    </p>
                  ) : (
                    <p className="font-prova text-[10px] font-medium uppercase tracking-[0.14em] text-alta">
                      ✓ {L('DISPONÍVEL', 'AVAILABLE')}
                    </p>
                  )}
                </div>
              )}

              {/* Preview do @username */}
              {previewUsername && !initialsTaken && !initialsChecking && (
                <div className="mt-2 flex min-w-0 items-center gap-1.5 border border-linha bg-concreto px-3 py-1.5">
                  <span className="shrink-0 font-prova text-[10px] font-medium uppercase tracking-[0.14em] text-mudo">
                    {L('Seu username:', 'Your username:')}
                  </span>
                  <span className="min-w-0 truncate font-prova text-[12px] font-medium text-rua">
                    @{previewUsername}
                  </span>
                </div>
              )}
            </label>

            {/* Formação */}
            <label className="block">
              <span className={cn(labelClass, 'mb-2')}>
                {L('Formação', 'Formation')}
              </span>
              <select
                className={inputClass}
                value={formationScheme}
                onChange={(e) => setFormationScheme(e.target.value as FormationSchemeId)}
              >
                {FORMATION_OPTIONS.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[10.5px] text-mudo">
                {L('Estilo tático:', 'Tactical style:')}{' '}
                <span className="font-prova font-medium uppercase tracking-[0.14em] text-rua">
                  {PRESET_LABEL_PT[FORMATION_TACTICAL_DEFAULTS[formationScheme].presetId]}
                </span>
              </p>
            </label>
          </div>
        )}

        {finishError ? (
          <div role="alert" className="mt-6 flex items-start gap-2.5 border-l-[5px] border-baixa bg-concreto px-4 py-3 text-[13px] text-papel">
            <span aria-hidden className="font-impact text-baixa">✗</span>
            <span>{finishError}</span>
          </div>
        ) : null}

        {/* No celular o Continuar fica preso embaixo: o passo 3 (escolha do
            time) é longo e o botão ficava muito abaixo da dobra. Do `sm` para
            cima a barra volta ao fluxo, onde sempre esteve. */}
        <div className="mt-8">
        <BarraAcao
          fixaAte="sm"
          espacador={false}
          ajuda={
            step === 1 && !step1Valid
              ? L('Preencha seus dados para continuar', 'Fill in your details to continue')
              : step === 2 && !step2Valid
                ? L('Dê nome e sigla ao clube', 'Name your club and pick initials')
                : step === 3 && !step3Valid
                  ? L('Escolha o time do coração e o perfil', 'Pick your heart team and profile')
                  : undefined
          }
          className="sm:[&>div:last-child]:max-w-none sm:[&>div:last-child]:justify-between"
        >
          {step > 1 ? (
            <button
              type="button"
              className="btn-secondary flex min-h-[52px] basis-2/5 items-center justify-center text-[19px] sm:basis-auto"
              onClick={() => setStep((step - 1) as 1 | 2 | 3)}
            >
              {L('Voltar', 'Back')}
            </button>
          ) : (
            <Link
              to="/login"
              className="btn-secondary flex min-h-[52px] basis-2/5 items-center justify-center text-[19px] sm:basis-auto"
            >
              {L('Cancelar', 'Cancel')}
            </Link>
          )}
          {step < 3 ? (
            <button
              type="button"
              className="btn-primary flex min-h-[52px] flex-1 items-center justify-center text-[20px] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
              disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
              onClick={goNext}
            >
              <>{L('Continuar', 'Continue')} <span aria-hidden>→</span></>
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary flex min-h-[52px] flex-1 items-center justify-center text-[20px] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
              disabled={!step3Valid || finishBusy}
              onClick={() => void finish()}
            >
              {finishBusy ? L('Preparando plantel…', 'Preparing squad…') : <>{L('Concluir', 'Finish')} <span aria-hidden>→</span></>}
            </button>
          )}
        </BarraAcao>
        </div>
        </div>
      </div>
    </div>

    <footer className="relative z-10 mx-auto mt-8 w-full max-w-md pb-6 text-center font-prova text-[11px] uppercase tracking-[0.14em] text-fio">
      Olefoot © 2026 · {L('Todos os direitos reservados', 'All rights reserved')}
    </footer>
  </div>
);
}

