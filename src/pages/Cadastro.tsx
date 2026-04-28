import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Shield, Heart, ArrowRight, ArrowLeft, Check, Sparkles, Trophy, Users, Briefcase, Mic, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { tryGrantWelcomeGenesisPack } from '@/game/welcomeGenesisPack';
import { syncProfileManagerFirstName } from '@/supabase/profileDisplayName';
import { LEAGUE_BUCKETS, SELECAO_BRASIL } from '@/settings/worldClubs';
import type { FavoriteRealTeamRef } from '@/game/types';
import { signUpWithEmail, checkEmailExists } from '@/supabase/auth';
import { fetchMyReferralCode } from '@/supabase/referrals';

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
  'w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-neon-yellow/50 focus:outline-none focus:ring-1 focus:ring-neon-yellow/30';

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

  useEffect(() => {
    const p = readPendingReferrerCode();
    if (p) setReferrerCode(p);
  }, []);

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

  const step2Valid = clubName.trim().length > 0 && initials.trim().length > 0;
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

      const welcome = await tryGrantWelcomeGenesisPack();
      if (welcome.ok === false) {
        const ignorable =
          welcome.reason === 'already_granted' || welcome.reason === 'squad_not_empty';
        if (!ignorable) console.warn('[Cadastro] welcome genesis pack:', welcome.reason);
      }

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
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/88 via-black/35 to-black/90" aria-hidden />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/50 to-black/25 opacity-[0.96]" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_95%_60%_at_50%_75%,rgba(0,0,0,0.65),transparent_52%)]"
        aria-hidden
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
              className="h-10 w-auto max-h-11 max-w-[min(100%,280px)] object-contain object-left drop-shadow-[0_2px_16px_rgba(0,0,0,0.75)] sm:h-12 sm:max-h-[3.25rem]"
            />
          </Link>
          <span className="shrink-0 rounded-full border border-white/20 bg-black/35 px-4 py-2 font-display text-[9px] font-bold uppercase tracking-[0.28em] text-white/95 sm:px-5 sm:text-[10px] sm:tracking-[0.32em]">
            Cadastro
          </span>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 pb-6 sm:px-8 sm:pb-8 md:px-10">
        <div className="min-h-[8vh] shrink-0 sm:min-h-[10vh]" aria-hidden />

        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
          <div
            className={cn(
              'relative overflow-hidden rounded-xl border border-white/[0.12]',
              'bg-gradient-to-br from-black/60 via-black/50 to-black/70',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_50px_rgba(0,0,0,0.6)]',
              'backdrop-blur-xl p-6 sm:p-8',
            )}
          >
            <div className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-neon-yellow via-neon-yellow/80 to-neon-yellow/60" aria-hidden />

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
                        'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                        isActive
                          ? 'border-neon-yellow bg-neon-yellow text-black shadow-[0_0_16px_rgba(253,224,71,0.4)]'
                          : isComplete
                            ? 'border-neon-yellow/60 bg-neon-yellow/20 text-neon-yellow'
                            : 'border-white/20 bg-white/5 text-white/40',
                      )}
                    >
                      {isComplete ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    {n < 3 && (
                      <div
                        className={cn(
                          'h-0.5 w-8 transition-colors',
                          step > n ? 'bg-neon-yellow/60' : 'bg-white/10',
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Step title */}
            <div className="mb-6 text-center">
              <h1 className="font-serif-hero text-[clamp(1.8rem,6vw,2.4rem)] font-normal italic leading-tight text-white">
                {step === 1 && 'Crie sua conta'}
                {step === 2 && 'Monte seu clube'}
                {step === 3 && 'Escolha seu time'}
              </h1>
              <p className="mt-2 font-sans text-sm text-white/65">
                {step === 1 && 'Dados pessoais e credenciais de acesso'}
                {step === 2 && 'Nome, iniciais e formação tática'}
                {step === 3 && 'Selecione o time do coração'}
              </p>
            </div>

        {step === 1 && (
          <div className="mt-8 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="mb-1 block text-xs font-medium text-white/65">Nome</span>
                <input
                  className={inputClass}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="mb-1 block text-xs font-medium text-white/65">Sobrenome</span>
                <input
                  className={inputClass}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-white/65">E-mail</span>
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-invalid={emailTaken || undefined}
              />
              {simpleEmailOk(email) && emailChecking ? (
                <p className="mt-1 text-[11px] text-white/45">Verificando…</p>
              ) : null}
              {emailTaken ? (
                <p className="mt-1 text-[11px] text-rose-300">
                  ✗ E-mail já cadastrado.{' '}
                  <Link to="/login" className="underline decoration-rose-300/50 hover:text-rose-200">
                    Fazer login
                  </Link>
                </p>
              ) : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-white/65">
                Senha <span className="text-white/35">(mín. 6 chars — usada pra entrar de qualquer dispositivo)</span>
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
              <span className="mb-1 block text-xs font-medium text-white/65">
                Código de indicação <span className="text-white/35">(opcional)</span>
              </span>
              <input
                className={inputClass}
                value={referrerCode}
                onChange={(e) => setReferrerCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
                placeholder="ex. A3XY2"
                maxLength={5}
                autoComplete="off"
              />
              <p className="mt-1 text-[10px] text-white/35">
                Se tiveres um link de convite, o código já vem preenchido. Não podes alterar depois de concluíres o cadastro.
              </p>
            </label>
            <div>
              <span className="mb-2 block text-xs font-medium text-white/65">Telefone</span>
              <div className="space-y-2.5">
                {/* Linha 1: DDI + DDD */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] font-medium text-white/50">DDI (País)</label>
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
                      <label className="mb-1 block text-[10px] font-medium text-white/50">Código</label>
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
                      <label className="mb-1 block text-[10px] font-medium text-white/50">UF</label>
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
                      <label className="mb-1 block text-[10px] font-medium text-white/50">DDD</label>
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
                      <label className="mb-1 block text-[10px] font-medium text-white/50">Cidade/Região</label>
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
                    <label className="mb-1 block text-[10px] font-medium text-white/50">Número</label>
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
                <p className="mt-1.5 font-mono text-[10px] text-white/40">Seu telefone é {phoneE164}</p>
              ) : null}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-8 space-y-6">
            {/* Seleção de perfil */}
            <div>
              <p className="mb-3 text-center font-display text-base font-bold uppercase tracking-wide text-white">
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
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-lg border bg-black/30 p-3 transition-all',
                        selected
                          ? 'border-neon-yellow bg-neon-yellow/10 shadow-[0_0_16px_rgba(234,255,0,0.2)]'
                          : 'border-white/10 hover:border-white/30',
                      )}
                      aria-pressed={selected}
                    >
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full border transition-colors',
                        selected ? 'border-neon-yellow/70 bg-neon-yellow/20' : 'border-white/20 bg-white/5',
                      )}>
                        <Icon className={cn('h-5 w-5', selected ? 'text-neon-yellow' : 'text-white/60')} />
                      </div>
                      <span className={cn(
                        'text-center text-[11px] font-bold leading-tight',
                        selected ? 'text-neon-yellow' : 'text-white/75',
                      )}>
                        {profile.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {userProfile === 'ex_jogador' && (
                <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                  <p className="text-center text-[11px] text-amber-200/90">
                    ⭐ Entraremos em contato para validar seu perfil de ex-jogador
                  </p>
                </div>
              )}
            </div>

            {/* Divisor */}
            <div className="border-t border-white/10" />

            <div>
              <p className="mb-1 text-center font-display text-sm font-bold uppercase tracking-wide text-white">
                Escolhe o teu time do coração
              </p>
              <p className="text-center text-[11px] text-white/50">
                13 ligas disponíveis. O escudo aparece ao lado do nome do teu clube nas telas do jogo.
              </p>
            </div>

            {/* Seleção Brasil em destaque (1 card cheio no topo) */}
            <button
              type="button"
              onClick={() => setFavoriteTeam(SELECAO_BRASIL)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border bg-black/30 p-3 transition-colors',
                favoriteTeam?.id === SELECAO_BRASIL.id
                  ? 'border-neon-yellow bg-neon-yellow/10 shadow-[0_0_16px_rgba(234,255,0,0.2)]'
                  : 'border-white/10 hover:border-white/30',
              )}
              aria-pressed={favoriteTeam?.id === SELECAO_BRASIL.id}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-black/60">
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
                <p className="font-display text-sm font-bold text-white">🇧🇷 Seleção Brasil</p>
                <p className="text-[10px] text-white/50">Time do coração dos que torcem pela pátria.</p>
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
                    'rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors',
                    leagueBucketId === b.id
                      ? 'border-neon-yellow/60 bg-neon-yellow/15 text-neon-yellow'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/25 hover:text-white',
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
                    className={cn(
                      'group flex flex-col items-center gap-1 rounded-lg border bg-black/30 p-2 transition-colors',
                      selected
                        ? 'border-neon-yellow bg-neon-yellow/10 shadow-[0_0_16px_rgba(234,255,0,0.2)]'
                        : 'border-white/10 hover:border-white/30',
                    )}
                    aria-pressed={selected}
                  >
                    <div className={cn(
                      'flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border',
                      selected ? 'border-neon-yellow/70 bg-black' : 'border-white/20 bg-black/60',
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
                      selected ? 'text-neon-yellow' : 'text-white/75',
                    )}>
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {favoriteTeam ? (
              <p className="text-center text-[11px] text-neon-yellow/80">
                💛 {favoriteTeam.name} selecionado
              </p>
            ) : null}
          </div>
        )}

        {step === 2 && (
          <div className="mt-8 space-y-5">
            {/* Nome do clube — limite 10 caracteres com aviso inline */}
            <label className="block">
              <span
                className="mb-2 block uppercase text-white/60"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                }}
              >
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
                    className="uppercase text-[var(--color-warning)] animate-pulse"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '9px',
                      fontWeight: 800,
                      letterSpacing: '0.22em',
                    }}
                    role="status"
                    aria-live="polite"
                  >
                    ⚠ {clubNameWarn}
                  </p>
                ) : (
                  <p
                    className="text-white/40"
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '10px',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Máximo 10 caracteres
                  </p>
                )}
                <span
                  className="tabular-nums text-white/35"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                  }}
                >
                  {clubName.length}/10
                </span>
              </div>
            </label>

            {/* Iniciais — só A–Z, máximo 3 letras, sem pontos/caracteres especiais */}
            <label className="block">
              <span
                className="mb-2 block uppercase text-white/60"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                }}
              >
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
                    className="uppercase text-[var(--color-warning)] animate-pulse"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '9px',
                      fontWeight: 800,
                      letterSpacing: '0.22em',
                    }}
                    role="status"
                    aria-live="polite"
                  >
                    ⚠ {initialsWarn}
                  </p>
                ) : (
                  <p
                    className="text-white/40"
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '10px',
                      letterSpacing: '0.04em',
                    }}
                  >
                    3 letras (sem pontos ou números)
                  </p>
                )}
                <span
                  className="tabular-nums text-white/35"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                  }}
                >
                  {initials.length}/3
                </span>
              </div>
            </label>

            {/* Formação */}
            <label className="block">
              <span
                className="mb-2 block uppercase text-white/60"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                }}
              >
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
              <p
                className="mt-1.5 text-white/45"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '10px',
                  letterSpacing: '0.04em',
                }}
              >
                Estilo tático:{' '}
                <span className="font-display font-bold uppercase tracking-[0.2em] text-neon-yellow/85">
                  {PRESET_LABEL_PT[FORMATION_TACTICAL_DEFAULTS[formationScheme].presetId]}
                </span>
              </p>
            </label>
          </div>
        )}

        {finishError ? (
          <div className="mt-6 flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span className="text-rose-400">✗</span>
            <span>{finishError}</span>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
          {step > 1 ? (
            <button
              type="button"
              className="group flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-6 py-3 font-display text-sm font-bold uppercase tracking-wide text-white backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10 active:scale-[0.98] sm:order-1"
              onClick={() => setStep((step - 1) as 1 | 2 | 3)}
            >
              Voltar
            </button>
          ) : (
            <Link
              to="/login"
              className="group flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-6 py-3 font-display text-sm font-bold uppercase tracking-wide text-white backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10 active:scale-[0.98] sm:order-1"
            >
              Cancelar
            </Link>
          )}
          {step < 3 ? (
            <button
              type="button"
              className={cn(
                'group flex items-center justify-center rounded-lg border border-neon-yellow/40 bg-gradient-to-br from-neon-yellow via-neon-yellow/95 to-neon-yellow/90 px-6 py-3 font-display text-sm font-black uppercase tracking-wide text-black shadow-[0_0_20px_rgba(253,224,71,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(253,224,71,0.5)] active:scale-[0.98] sm:order-2',
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
                'group flex items-center justify-center rounded-lg border border-neon-yellow/40 bg-gradient-to-br from-neon-yellow via-neon-yellow/95 to-neon-yellow/90 px-6 py-3 font-display text-sm font-black uppercase tracking-wide text-black shadow-[0_0_20px_rgba(253,224,71,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(253,224,71,0.5)] active:scale-[0.98] sm:order-2',
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

    <footer className="relative z-10 mx-auto mt-6 max-w-md text-center text-[10px] text-white/35 sm:text-[11px]">
      Olefoot © 2026 · Todos os direitos reservados
    </footer>
  </div>
);
}

