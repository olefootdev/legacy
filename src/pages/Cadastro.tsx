import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { COUNTRY_DIAL_OPTIONS, type CountryDialOption } from '@/lib/countryDialCodes';
import type { FormationSchemeId } from '@/match-engine/types';
import { useGameDispatch, useGameStore } from '@/game/store';
import { useSportsDataStore, type SportsClub, type SportsLeague } from '@/admin/sportsDataStore';
import { Search } from 'lucide-react';

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
  const [dialOption, setDialOption] = useState<CountryDialOption>(COUNTRY_DIAL_OPTIONS[0]);
  const [customDialDigits, setCustomDialDigits] = useState('');
  const [ddd, setDdd] = useState('');
  const [localPhone, setLocalPhone] = useState('');

  const [clubName, setClubName] = useState('');
  const [initials, setInitials] = useState('');
  const [formationScheme, setFormationScheme] = useState<FormationSchemeId>('4-3-3');

  const leagues = useSportsDataStore((s) => s.leagues);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [selectedClub, setSelectedClub] = useState<SportsClub | null>(null);
  const [searchQ, setSearchQ] = useState('');

  const hasData = leagues.length > 0;

  const selectedLeague = useMemo(
    () => leagues.find((l) => l.id === selectedLeagueId) ?? null,
    [leagues, selectedLeagueId],
  );

  const filteredClubs = useMemo(() => {
    if (!selectedLeague) return [];
    const q = searchQ.trim().toLowerCase();
    if (!q) return selectedLeague.clubs;
    return selectedLeague.clubs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.short_name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q),
    );
  }, [selectedLeague, searchQ]);

  const dialDigits = useMemo(() => {
    if (dialOption.iso2 === 'OTHER') return digitsOnly(customDialDigits);
    return digitsOnly(dialOption.dial);
  }, [dialOption, customDialDigits]);

  const phoneE164 = useMemo(() => buildPhoneE164(dialDigits, ddd, localPhone), [dialDigits, ddd, localPhone]);

  const step1Valid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    simpleEmailOk(email) &&
    phoneE164.length >= 8;

  const step2Valid = clubName.trim().length > 0 && initials.trim().length > 0;

  const step3Valid = !hasData || selectedClub !== null;

  const goNext = () => {
    if (step === 1 && step1Valid) setStep(2);
    else if (step === 2 && step2Valid) setStep(3);
  };

  const finish = () => {
    if (!step3Valid) return;
    const sn = initials.trim().toUpperCase().slice(0, 6);
    dispatch({
      type: 'SET_USER_SETTINGS',
      partial: {
        managerProfile: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phoneE164,
        },
        ...(selectedClub
          ? {
              favoriteRealTeam: {
                id: 0,
                name: selectedClub.name,
                logo: selectedClub.logo_url ?? null,
              },
            }
          : {}),
      },
    });
    dispatch({
      type: 'ADMIN_PATCH_CLUB',
      partial: { name: clubName.trim(), shortName: sn },
    });
    dispatch({ type: 'SET_MANAGER_SLIDERS', partial: { formationScheme } });
    dispatch({ type: 'SET_LINEUP', lineup: { ...lineup }, formationScheme });
    navigate('/');
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-deep-black px-4 py-10 sm:px-6">
      <div className="sports-panel w-full max-w-lg rounded-xl p-6 sm:p-8">
        <h1 className="font-display text-center text-2xl font-bold uppercase tracking-wide text-white">Cadastro</h1>
        <p className="mt-2 text-center font-sans text-xs text-white/55">
          Três passos — os dados ficam no teu save local (e nas definições de utilizador).
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
              />
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
                      {c.name} ({c.dial})
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
                <p className="mt-1 font-mono text-[10px] text-white/40">Formato: {phoneE164}</p>
              ) : null}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-white/65">Nome do clube</span>
              <input
                className={inputClass}
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
              />
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
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="mt-8 space-y-4">
            {!hasData ? (
              <div className="rounded-lg border border-dashed border-white/15 p-6 text-center">
                <p className="text-sm text-white/50">Nenhuma liga cadastrada ainda.</p>
                <p className="mt-1 text-xs text-white/30">
                  O administrador pode importar dados em Admin → Sports Data.
                </p>
              </div>
            ) : (
              <>
                {/* Seleção de liga */}
                <div>
                  <span className="mb-2 block text-xs font-medium text-white/65">Escolha a liga</span>
                  <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2">
                    {leagues.map((league) => (
                      <button
                        key={league.id}
                        type="button"
                        className={cn(
                          'rounded-md px-3 py-2.5 text-left text-sm transition',
                          selectedLeagueId === league.id
                            ? 'bg-neon-yellow/20 text-white'
                            : 'text-white/80 hover:bg-white/5',
                        )}
                        onClick={() => {
                          setSelectedLeagueId(league.id);
                          setSelectedClub(null);
                          setSearchQ('');
                        }}
                      >
                        <span className="font-medium">{league.name}</span>
                        <span className="ml-2 text-white/40 text-xs">
                          {league.country} · {league.clubs.length} clubes
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Seleção de clube */}
                {selectedLeague && (
                  <div>
                    <span className="mb-2 block text-xs font-medium text-white/65">
                      Escolha seu time — {selectedLeague.name}
                    </span>
                    {selectedLeague.clubs.length > 8 && (
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 pointer-events-none" />
                        <input
                          className={cn(inputClass, 'pl-9')}
                          placeholder="Filtrar clube…"
                          value={searchQ}
                          onChange={(e) => setSearchQ(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2">
                      {filteredClubs.map((club) => (
                        <ClubRow
                          key={club.id}
                          club={club}
                          selected={selectedClub?.id === club.id}
                          onPick={() => setSelectedClub(club)}
                        />
                      ))}
                      {filteredClubs.length === 0 && (
                        <p className="px-2 py-3 text-center text-sm text-white/45">Nenhum clube encontrado.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Clube selecionado */}
                {selectedClub && (
                  <div className="flex items-center gap-3 rounded-lg border border-neon-yellow/25 bg-neon-yellow/5 p-3">
                    {selectedClub.logo_url ? (
                      <img
                        src={selectedClub.logo_url}
                        alt=""
                        className="h-12 w-12 shrink-0 object-contain"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-white/10 font-display text-sm font-bold text-white/50">
                        {selectedClub.short_name.slice(0, 3)}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-white">Time do coração</p>
                      <p className="text-sm text-white/70">{selectedClub.name}</p>
                      {selectedClub.city && (
                        <p className="text-[10px] text-white/40">{selectedClub.city}</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
          {step > 1 ? (
            <button type="button" className="btn-secondary order-2 sm:order-1" onClick={() => setStep((s) => (s === 2 ? 1 : 2))}>
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
              className={cn('btn-primary order-1 sm:order-2', (step === 1 && !step1Valid) || (step === 2 && !step2Valid) ? 'pointer-events-none opacity-40' : '')}
              disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
              onClick={goNext}
            >
              <span className="btn-primary-inner justify-center">Continuar</span>
            </button>
          ) : (
            <button
              type="button"
              className={cn('btn-primary order-1 sm:order-2', !step3Valid ? 'pointer-events-none opacity-40' : '')}
              disabled={!step3Valid}
              onClick={finish}
            >
              <span className="btn-primary-inner justify-center">Concluir</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ClubRow({
  club,
  selected,
  onPick,
}: {
  key?: string;
  club: SportsClub;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition',
        selected ? 'bg-neon-yellow/20 text-white' : 'text-white/85 hover:bg-white/5',
      )}
    >
      {club.logo_url ? (
        <img src={club.logo_url} alt="" className="h-8 w-8 shrink-0 object-contain" />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/10 font-display text-[10px] font-bold text-white/40">
          {club.short_name.slice(0, 3)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium">{club.name}</span>
        {club.city && <span className="block truncate text-[10px] text-white/40">{club.city}</span>}
      </div>
    </button>
  );
}
