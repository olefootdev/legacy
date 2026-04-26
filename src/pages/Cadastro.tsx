import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

const FORMATION_OPTIONS: FormationSchemeId[] = [
  '4-3-3',
  '4-4-2',
  '4-2-3-1',
  '3-5-2',
  '4-5-1',
  '5-3-2',
  '3-4-3',
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
  const [ddd, setDdd] = useState('');
  const [localPhone, setLocalPhone] = useState('');
  const [referrerCode, setReferrerCode] = useState('');

  const [clubName, setClubName] = useState('');
  const [initials, setInitials] = useState('');
  const [formationScheme, setFormationScheme] = useState<FormationSchemeId>('4-3-3');

  const [favoriteTeam, setFavoriteTeam] = useState<FavoriteRealTeamRef | null>(null);
  const [leagueBucketId, setLeagueBucketId] = useState<string>('brasil');

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
  const step3Valid = !!favoriteTeam;

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
    <div className="flex min-h-svh w-full min-w-0 flex-col items-center justify-center bg-deep-black px-4 py-10 sm:px-6">
      <div className="sports-panel w-full min-w-0 max-w-lg rounded-xl p-6 sm:p-8">
        <h1 className="font-display text-center text-2xl font-bold uppercase tracking-wide text-white">Cadastro</h1>
        <p className="mt-2 text-center font-sans text-xs text-white/55">
          Cria o teu perfil de treinador.
        </p>

        <div className="mt-6 flex justify-center gap-2" aria-hidden>
          {([1, 2, 3] as const).map((n) => (
            <div
              key={n}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full font-display text-xs font-bold',
                step === n ? 'bg-neon-yellow text-black' : 'bg-white/10 text-white/50',
              )}
            >
              {n}
            </div>
          ))}
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
              <span className="mb-1 block text-xs font-medium text-white/65">Telefone</span>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                <select
                  className={cn(inputClass, 'sm:max-w-[200px]')}
                  value={dialOption.iso2}
                  onChange={(e) => {
                    const o = COUNTRY_DIAL_OPTIONS.find((x) => x.iso2 === e.target.value);
                    if (o) setDialOption(o);
                  }}
                >
                  {COUNTRY_DIAL_OPTIONS.map((c) => (
                    <option key={c.iso2} value={c.iso2}>
                      {isoToFlag(c.iso2)} {c.name} ({c.dial})
                    </option>
                  ))}
                </select>
                {dialOption.iso2 === 'OTHER' && (
                  <input
                    className={inputClass}
                    placeholder="Código país (ex. 352)"
                    value={customDialDigits}
                    onChange={(e) => setCustomDialDigits(e.target.value)}
                    inputMode="numeric"
                  />
                )}
                <input
                  className={cn(inputClass, 'sm:max-w-[88px]')}
                  placeholder="DDD"
                  value={ddd}
                  onChange={(e) => setDdd(e.target.value)}
                  inputMode="numeric"
                />
                <input
                  className={inputClass}
                  placeholder="Número"
                  value={localPhone}
                  onChange={(e) => setLocalPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel-national"
                />
              </div>
              {phoneE164 ? (
                <p className="mt-1 font-mono text-[10px] text-white/40">Seu telefone é {phoneE164}</p>
              ) : null}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-8 space-y-4">
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
          <div className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-white/65">Crie um nome para o seu clube</span>
              <input
                className={inputClass}
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                maxLength={10}
              />
              <p className="mt-1 text-[10px] text-white/40">Máximo 10 caracteres</p>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-white/65">Iniciais</span>
              <input
                className={inputClass}
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase())}
                maxLength={6}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-white/65">Formação</span>
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
              <p className="mt-1 text-[10px] text-white/40">
                Estilo tático:{' '}
                <span className="text-neon-yellow/70">
                  {PRESET_LABEL_PT[FORMATION_TACTICAL_DEFAULTS[formationScheme].presetId]}
                </span>
              </p>
            </label>
          </div>
        )}

        {finishError ? (
          <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
            ✗ {finishError}
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
          {step > 1 ? (
            <button
              type="button"
              className="btn-secondary order-2 sm:order-1"
              onClick={() => setStep((step - 1) as 1 | 2 | 3)}
            >
              <span className="btn-secondary-inner justify-center">Voltar</span>
            </button>
          ) : (
            <Link to="/login" className="btn-secondary order-2 sm:order-1 text-center">
              <span className="btn-secondary-inner justify-center">Cancelar</span>
            </Link>
          )}
          {step < 3 ? (
            <button
              type="button"
              className={cn(
                'btn-primary order-1 sm:order-2',
                (step === 1 && !step1Valid) || (step === 2 && !step2Valid) ? 'pointer-events-none opacity-40' : '',
              )}
              disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
              onClick={goNext}
            >
              <span className="btn-primary-inner justify-center">Continuar</span>
            </button>
          ) : (
            <button
              type="button"
              className={cn(
                'btn-primary order-1 sm:order-2',
                !step3Valid || finishBusy ? 'pointer-events-none opacity-40' : '',
              )}
              disabled={!step3Valid || finishBusy}
              onClick={() => void finish()}
            >
              <span className="btn-primary-inner justify-center">
                {finishBusy ? 'A preparar o teu plantel…' : 'Concluir'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

