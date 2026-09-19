import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { User, Shield, Heart, ArrowRight, ArrowLeft, Check, Sparkles, Trophy, Users, Briefcase, Mic, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Hashtag } from '@/components/ui';
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
  'w-full border border-white/16 bg-deep-black px-3 py-2.5 text-sm text-white placeholder:text-poeira focus:border-neon-yellow focus:outline-none';

/** Rótulo de campo VOLT2 (mono, cimento). */
const labelClass = 'mb-1 block font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-cimento';
/** Aviso inline de limite/caractere — mono, cor de atenção. */
const warnClass = 'animate-pulse font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-atencao';
const hintClass = 'text-[10.5px] text-poeira';
/** Opção selecionável (perfil, clube): card chapado; selecionado = borda volt. */
const opcao = (selected: boolean) =>
  cn(
    'border bg-deep-black transition-colors',
    selected ? 'border-neon-yellow bg-neon-yellow/10' : 'border-white/10 hover:border-white/30',
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
        setFinishError(signUp.error ?? 'Falha ao criar conta.');
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

      navigate('/');
    } finally {
      setFinishBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-deep-black">
      {/* Background layers */}
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

      {/* Header */}
      <header role="banner" className="relative z-[100] w-full shrink-0 bg-transparent px-4 pb-2 pt-5 sm:px-6 sm:pb-3 sm:pt-6 md:px-8">
        <div className="mx-auto flex w-full min-w-0 max-w-6xl items-center justify-between gap-3">
          <Link to="/login" className="flex min-w-0 flex-1 items-center gap-3" aria-label="Olefoot">
            <img
              src="/test-pitch/olefoot-logo-game.svg"
              alt="Olefoot"
              width={260}
              height={72}
              decoding="async"
              fetchPriority="high"
              className="h-10 w-auto max-h-11 max-w-[min(100%,280px)] object-contain object-left sm:h-12 sm:max-h-[3.25rem]"
            />
          </Link>
          <Hashtag className="shrink-0 text-[12px] text-giz">#cadastro</Hashtag>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 pb-6 sm:px-8 sm:pb-8 md:px-10">
        <div className="min-h-[8vh] shrink-0 sm:min-h-[10vh]" aria-hidden />

        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
          <div className="border border-white/10 bg-panel p-6 sm:p-8">

            {/* Step indicator */}
            <div className="mb-8 flex items-center justify-center gap-2">
              {([1, 2, 3] as const).map((n) => {
                const Icon = n === 1 ? User : n === 2 ? Shield : Heart;
                const isActive = step === n;
                const isComplete = step > n;
                return (
                  <div key={n} className="flex items-center gap-2">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center border-2 transition-colors',
                        isActive
                          ? 'border-neon-yellow bg-neon-yellow text-black'
                          : isComplete
                            ? 'border-neon-yellow bg-deep-black text-neon-yellow'
                            : 'border-white/16 bg-deep-black text-poeira',
                      )}
                    >
                      {isComplete ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    {n < 3 && (
                      <div
                        className={cn(
                          'h-0.5 w-8 transition-colors',
                          step > n ? 'bg-neon-yellow' : 'bg-white/10',
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Step title */}
            <div className="mb-6 text-center">
              <h1
                className="font-impact uppercase leading-[1.05] text-white"
                style={{ fontSize: 'clamp(30px, 8vw, 42px)' }}
              >
                {step === 1 && 'Crie sua conta'}
                {step === 2 && 'Monte seu clube'}
                {step === 3 && 'Escolha seu time'}
              </h1>
              <Hashtag className="mt-2 text-[12px]">
                {step === 1 && '#passo1 · dados e acesso'}
                {step === 2 && '#passo2 · clube e formação'}
                {step === 3 && '#passo3 · time do coração'}
              </Hashtag>
            </div>

        {step === 1 && (
          <div className="mt-8 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className={labelClass}>Nome</span>
                <input
                  className={inputClass}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className={labelClass}>Sobrenome</span>
                <input
                  className={inputClass}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </label>
            </div>
            <label className="block">
              <span className={labelClass}>E-mail</span>
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-invalid={emailTaken || undefined}
              />
              {simpleEmailOk(email) && emailChecking ? (
                <p className="mt-1 text-[11px] text-poeira">Verificando…</p>
              ) : null}
              {emailTaken ? (
                <p className="mt-1 text-[11px] text-baixa">
                  ✗ E-mail já cadastrado.{' '}
                  <Link to="/login" className="underline decoration-baixa/50 hover:text-white">
                    Fazer login
                  </Link>
                </p>
              ) : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-cimento">
                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em]">Senha</span>{' '}
                <span className="text-poeira">(mín. 6 chars — usada pra entrar de qualquer dispositivo)</span>
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
                <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-cimento">
                  Código de indicação <span className="normal-case tracking-normal text-poeira">(opcional)</span>
                </span>
                {referrerFromInvite && normalizeReferralCode(referrerCode) ? (
                  <span className="shrink-0 border border-alta/40 bg-alta/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-alta">
                    ✓ Convite aplicado
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
                placeholder="ex. ABC123XY"
                maxLength={8}
                autoComplete="off"
              />
              <p className="mt-1 text-[10.5px] text-poeira">
                Se você tiver um link de convite, o código já vem preenchido. Não dá pra alterar depois de concluir o cadastro.
              </p>
            </label>
            <div>
              <span className={cn(labelClass, 'mb-2')}>Telefone</span>
              <div className="space-y-2.5">
                {/* Linha 1: DDI + DDD */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[10.5px] text-poeira">DDI (País)</label>
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
                      <label className="mb-1 block text-[10.5px] text-poeira">Código</label>
                      <input
                        className={inputClass}
                        placeholder="ex. 352"
                        value={customDialDigits}
                        onChange={(e) => setCustomDialDigits(e.target.value)}
                        inputMode="numeric"
                      />
                    </div>
                  )}
                  {dialOption.iso2 === 'BR' ? (
                    <div className="w-20">
                      <label className="mb-1 block text-[10.5px] text-poeira">UF</label>
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
                      <label className="mb-1 block text-[10.5px] text-poeira">DDD</label>
                      <input
                        className={inputClass}
                        placeholder="DDD"
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
                      <label className="mb-1 block text-[10.5px] text-poeira">Cidade/Região</label>
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
                        <option value="">Selecione</option>
                        {BRAZIL_STATES_DDD.find((s) => s.state === brazilState)?.cities.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div className={dialOption.iso2 === 'BR' && brazilState ? 'flex-1' : 'w-full'}>
                    <label className="mb-1 block text-[10.5px] text-poeira">Número</label>
                    <input
                      className={inputClass}
                      placeholder="Número do telefone"
                      value={localPhone}
                      onChange={(e) => setLocalPhone(e.target.value)}
                      inputMode="tel"
                      autoComplete="tel-national"
                    />
                  </div>
                </div>
              </div>
              {phoneE164 ? (
                <p className="mt-1.5 font-mono text-[10.5px] text-cimento">Seu telefone é {phoneE164}</p>
              ) : null}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-8 space-y-6">
            {/* Seleção de perfil */}
            <div>
              <p className="mb-3 text-center font-impact text-[20px] uppercase leading-[1.1] text-white">
                Qual seu perfil?
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {[
                  { id: 'apaixonado' as const, label: 'Apaixonado por futebol', icon: Heart, color: 'rose' },
                  { id: 'novo_talento' as const, label: 'Novo talento', icon: Sparkles, color: 'cyan' },
                  { id: 'atleta_atuacao' as const, label: 'Atleta em atuação', icon: Trophy, color: 'amber' },
                  { id: 'profissional' as const, label: 'Profissional', icon: Briefcase, color: 'blue' },
                  { id: 'midia' as const, label: 'Mídia', icon: Mic, color: 'purple' },
                  { id: 'ex_jogador' as const, label: 'Ex-Jogador', icon: Star, color: 'yellow' },
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
                        'flex h-10 w-10 items-center justify-center border transition-colors',
                        selected ? 'border-neon-yellow bg-neon-yellow text-black' : 'border-white/16 text-cimento',
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className={cn(
                        'text-center text-[11px] font-bold leading-tight',
                        selected ? 'text-neon-yellow' : 'text-giz',
                      )}>
                        {profile.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {userProfile === 'ex_jogador' && (
                <div className="mt-3 border border-atencao/40 bg-atencao/10 px-3 py-2">
                  <p className="text-center text-[11px] text-giz">
                    Entraremos em contato para validar seu perfil de ex-jogador
                  </p>
                </div>
              )}
            </div>

            {/* Divisor */}
            <div className="border-t border-white/10" />

            <div>
              <p className="mb-1 text-center font-impact text-[20px] uppercase leading-[1.1] text-white">
                Time do coração
              </p>
              <Hashtag className="text-center">{`#${LEAGUE_BUCKETS.length}ligas`}</Hashtag>
            </div>

            {/* Seleção Brasil em destaque (1 card cheio no topo) */}
            <button
              type="button"
              onClick={() => setFavoriteTeam(SELECAO_BRASIL)}
              className={cn('flex w-full items-center gap-3 p-3', opcao(favoriteTeam?.id === SELECAO_BRASIL.id))}
              aria-pressed={favoriteTeam?.id === SELECAO_BRASIL.id}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/16 bg-panel">
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
                <p className="truncate font-impact text-[17px] uppercase leading-[1.1] text-white">🇧🇷 Seleção Brasil</p>
                <Hashtag className="text-[11px]">#seleção</Hashtag>
              </div>
            </button>

            {/* Chips de ligas */}
            <div className="flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
              {LEAGUE_BUCKETS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setLeagueBucketId(b.id)}
                  className={cn(
                    'border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors',
                    leagueBucketId === b.id
                      ? 'border-neon-yellow bg-neon-yellow text-black'
                      : 'border-white/10 bg-deep-black text-cimento hover:border-white/30 hover:text-white',
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
                      selected ? 'border-neon-yellow bg-panel' : 'border-white/16 bg-panel',
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
                      'line-clamp-2 text-center text-[10px] font-bold leading-tight',
                      selected ? 'text-neon-yellow' : 'text-giz',
                    )}>
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {favoriteTeam ? (
              <p className="text-center text-[11px] font-medium text-neon-yellow">
                ✓ {favoriteTeam.name} selecionado
              </p>
            ) : null}
          </div>
        )}

        {step === 2 && (
          <div className="mt-8 space-y-5">
            {/* Nome do clube — limite 10 caracteres com aviso inline */}
            <label className="block">
              <span className={cn(labelClass, 'mb-2')}>
                Nome do clube
              </span>
              <input
                className={inputClass}
                value={clubName}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw.length > 10) {
                    setClubName(raw.slice(0, 10));
                    setClubNameWarn('Máximo 10 letras');
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
                    setClubNameWarn('Máximo 10 letras');
                    window.clearTimeout((window as any).__cnTimer);
                    (window as any).__cnTimer = window.setTimeout(
                      () => setClubNameWarn(null),
                      2400,
                    );
                  }
                }}
                maxLength={10}
                placeholder="Ex.: OLE FC"
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
                    Máximo 10 caracteres
                  </p>
                )}
                <span className="ole-num text-[10.5px] text-poeira">
                  {clubName.length}/10
                </span>
              </div>
            </label>

            {/* Iniciais — só A–Z, máximo 3 letras, sem pontos/caracteres especiais */}
            <label className="block">
              <span className={cn(labelClass, 'mb-2')}>
                Iniciais
              </span>
              <input
                className={cn(inputClass, 'tracking-[0.4em] text-center font-display font-black uppercase')}
                value={initials}
                onChange={(e) => {
                  const raw = e.target.value.toUpperCase();
                  // Filtra só A–Z (sem pontos, números ou especiais)
                  const cleaned = raw.replace(/[^A-Z]/g, '');
                  const trimmed = cleaned.slice(0, 3);
                  if (cleaned !== raw.replace(/\s/g, '')) {
                    setInitialsWarn('Use apenas letras A–Z');
                    window.clearTimeout((window as any).__inTimer);
                    (window as any).__inTimer = window.setTimeout(
                      () => setInitialsWarn(null),
                      2400,
                    );
                  } else if (cleaned.length > 3) {
                    setInitialsWarn('Máximo 3 letras');
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
                    3 letras (sem pontos ou números)
                  </p>
                )}
                <span className="ole-num text-[10.5px] text-poeira">
                  {initials.length}/3
                </span>
              </div>

              {/* Status de disponibilidade das iniciais */}
              {initials.trim().length >= 2 && (
                <div className="mt-1">
                  {initialsChecking ? (
                    <p className={hintClass}>Verificando…</p>
                  ) : initialsTaken ? (
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-baixa">
                      ✗ Iniciais já em uso — escolha outras
                    </p>
                  ) : (
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-alta">
                      ✓ DISPONÍVEL
                    </p>
                  )}
                </div>
              )}

              {/* Preview do @username */}
              {previewUsername && !initialsTaken && !initialsChecking && (
                <div className="mt-2 flex min-w-0 items-center gap-1.5 border border-white/10 bg-deep-black px-3 py-1.5">
                  <span className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento">
                    Seu username:
                  </span>
                  <span className="min-w-0 truncate font-mono text-[12px] font-medium text-neon-yellow">
                    @{previewUsername}
                  </span>
                </div>
              )}
            </label>

            {/* Formação */}
            <label className="block">
              <span className={cn(labelClass, 'mb-2')}>
                Formação
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
              <p className="mt-1.5 text-[10.5px] text-cimento">
                Estilo tático:{' '}
                <span className="font-mono font-medium uppercase tracking-[0.14em] text-neon-yellow">
                  {PRESET_LABEL_PT[FORMATION_TACTICAL_DEFAULTS[formationScheme].presetId]}
                </span>
              </p>
            </label>
          </div>
        )}

        {finishError ? (
          <div className="mt-6 flex items-start gap-2 border border-baixa/50 bg-baixa/10 px-4 py-3 text-sm text-giz">
            <span className="text-baixa">✗</span>
            <span>{finishError}</span>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
          {step > 1 ? (
            <button
              type="button"
              className="btn-secondary flex h-12 items-center justify-center sm:order-1"
              onClick={() => setStep((step - 1) as 1 | 2 | 3)}
            >
              Voltar
            </button>
          ) : (
            <Link
              to="/login"
              className="btn-secondary flex h-12 items-center justify-center sm:order-1"
            >
              Cancelar
            </Link>
          )}
          {step < 3 ? (
            <button
              type="button"
              className={cn(
                'btn-primary flex h-12 items-center justify-center sm:order-2',
                (step === 1 && !step1Valid) || (step === 2 && !step2Valid) ? 'pointer-events-none opacity-40' : '',
              )}
              disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
              onClick={goNext}
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              className={cn(
                'btn-primary flex h-12 items-center justify-center sm:order-2',
                !step3Valid || finishBusy ? 'pointer-events-none opacity-40' : '',
              )}
              disabled={!step3Valid || finishBusy}
              onClick={() => void finish()}
            >
              {finishBusy ? 'Preparando plantel…' : 'Concluir'}
            </button>
          )}
        </div>
        </div>
      </div>
    </div>

    <footer className="relative z-10 mx-auto mt-6 max-w-md text-center text-[10px] text-poeira sm:text-[11px]">
      Olefoot © 2026 · Todos os direitos reservados
    </footer>
  </div>
);
}

