import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { COUNTRY_DIAL_OPTIONS, type CountryDialOption } from '@/lib/countryDialCodes';
import { MAJOR_LEAGUES } from '@/lib/apiFootball/majorLeagues';
import {
  fetchCountries,
  fetchLeaguesByCountry,
  fetchTeamsByLeague,
  searchTeams,
} from '@/lib/apiFootball/queries';
import { hasApiFootballClientConfig } from '@/lib/apiFootball/client';
import type { ApiCountry, ApiLeagueEntry, ApiTeamEntry } from '@/lib/apiFootball/types';
import type { FormationSchemeId } from '@/match-engine/types';
import { useGameDispatch, useGameStore } from '@/game/store';

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

  const apiOk = hasApiFootballClientConfig();
  const [countries, setCountries] = useState<ApiCountry[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countriesErr, setCountriesErr] = useState<string | null>(null);

  const [discoverTab, setDiscoverTab] = useState<'major' | 'country' | 'search'>('major');
  const [countryFilter, setCountryFilter] = useState('');
  const [selectedApiCountry, setSelectedApiCountry] = useState<string>('');
  const [leagues, setLeagues] = useState<ApiLeagueEntry[]>([]);
  const [leaguesLoading, setLeaguesLoading] = useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | ''>('');
  const [teams, setTeams] = useState<ApiTeamEntry[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<ApiTeamEntry[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [selectedTeam, setSelectedTeam] = useState<ApiTeamEntry | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const dialDigits = useMemo(() => {
    if (dialOption.iso2 === 'OTHER') return digitsOnly(customDialDigits);
    return digitsOnly(dialOption.dial);
  }, [dialOption, customDialDigits]);

  const phoneE164 = useMemo(() => buildPhoneE164(dialDigits, ddd, localPhone), [dialDigits, ddd, localPhone]);

  useEffect(() => {
    if (step !== 3 || !apiOk) return;
    let cancelled = false;
    (async () => {
      setCountriesLoading(true);
      setCountriesErr(null);
      try {
        const list = await fetchCountries();
        if (!cancelled) setCountries(list ?? []);
      } catch (e) {
        if (!cancelled) setCountriesErr(e instanceof Error ? e.message : 'Erro ao carregar países.');
      } finally {
        if (!cancelled) setCountriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, apiOk]);

  const loadLeaguesForCountry = useCallback(async (countryName: string) => {
    if (!countryName.trim()) {
      setLeagues([]);
      return;
    }
    setLeaguesLoading(true);
    setApiError(null);
    try {
      const list = await fetchLeaguesByCountry(countryName.trim());
      setLeagues(list);
      setSelectedLeagueId('');
      setTeams([]);
    } catch (e) {
      setLeagues([]);
      setApiError(e instanceof Error ? e.message : 'Erro ao carregar ligas.');
    } finally {
      setLeaguesLoading(false);
    }
  }, []);

  const loadTeamsForLeague = useCallback(async (leagueId: number) => {
    setTeamsLoading(true);
    setApiError(null);
    try {
      const list = await fetchTeamsByLeague(leagueId);
      setTeams(list ?? []);
    } catch (e) {
      setTeams([]);
      setApiError(e instanceof Error ? e.message : 'Erro ao carregar equipas.');
    } finally {
      setTeamsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof selectedLeagueId !== 'number') return;
    void loadTeamsForLeague(selectedLeagueId);
  }, [selectedLeagueId, loadTeamsForLeague]);

  useEffect(() => {
    const q = searchQ.trim();
    if (discoverTab !== 'search' || q.length < 2 || !apiOk) {
      setSearchResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setSearchLoading(true);
        setApiError(null);
        try {
          const list = await searchTeams(q);
          setSearchResults(list ?? []);
        } catch (e) {
          setSearchResults([]);
          setApiError(e instanceof Error ? e.message : 'Erro na pesquisa.');
        } finally {
          setSearchLoading(false);
        }
      })();
    }, 400);
    return () => window.clearTimeout(t);
  }, [searchQ, discoverTab, apiOk]);

  const filteredCountries = useMemo(() => {
    const f = countryFilter.trim().toLowerCase();
    if (!f) return countries;
    return countries.filter((c) => c.name.toLowerCase().includes(f));
  }, [countries, countryFilter]);

  const step1Valid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    simpleEmailOk(email) &&
    phoneE164.length >= 8;

  const step2Valid = clubName.trim().length > 0 && initials.trim().length > 0;

  /** Sem chave/proxy não há busca de equipas — permite fechar o cadastro só com passos 1–2. */
  const step3Valid = !apiOk || selectedTeam !== null;

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
        ...(selectedTeam
          ? {
              favoriteRealTeam: {
                id: selectedTeam.team.id,
                name: selectedTeam.team.name,
                logo: selectedTeam.team.logo,
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

  const pickMajorLeague = (id: number) => {
    setDiscoverTab('major');
    setSelectedLeagueId(id);
    setSelectedApiCountry('');
    setLeagues([]);
    setSelectedTeam(null);
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
            {!apiOk ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
                Para carregar escudos e equipas, define <code className="text-xs">VITE_API_FOOTBALL_KEY</code> no build
                ou <code className="text-xs">API_FOOTBALL_KEY</code> no <code className="text-xs">.env</code> com{' '}
                <code className="text-xs">npm run dev</code> (proxy Vite). Chave:{' '}
                <a
                  href="https://dashboard.api-football.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-neon-yellow underline underline-offset-2"
                >
                  dashboard.api-football.com
                </a>
                .
              </p>
            ) : null}

            {apiOk && countriesErr ? (
              <p className="text-sm text-red-300/90">{countriesErr}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {(['major', 'country', 'search'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={cn(
                    'rounded-full px-3 py-1 font-display text-[10px] font-bold uppercase tracking-wider',
                    discoverTab === tab ? 'bg-neon-yellow text-black' : 'bg-white/10 text-white/70 hover:bg-white/15',
                  )}
                  onClick={() => {
                    setDiscoverTab(tab);
                    setApiError(null);
                    if (tab !== 'search') {
                      setSearchQ('');
                      setSearchResults([]);
                    }
                  }}
                >
                  {tab === 'major' ? 'Grandes ligas' : tab === 'country' ? 'Por país' : 'Pesquisar'}
                </button>
              ))}
            </div>

            {apiError ? <p className="text-sm text-red-300/90">{apiError}</p> : null}

            {discoverTab === 'major' && (
              <div className="space-y-3">
                <p className="text-xs text-white/50">Ligas principais (API-Football).</p>
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2">
                  {MAJOR_LEAGUES.map((L) => (
                    <button
                      key={L.id}
                      type="button"
                      className={cn(
                        'rounded-md px-2 py-2 text-left text-sm transition',
                        selectedLeagueId === L.id ? 'bg-neon-yellow/20 text-white' : 'text-white/80 hover:bg-white/5',
                      )}
                      onClick={() => pickMajorLeague(L.id)}
                    >
                      <span className="font-medium">{L.name}</span>
                      <span className="text-white/45"> — {L.country}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {discoverTab === 'country' && (
              <div className="space-y-3">
                <input
                  className={inputClass}
                  placeholder="Filtrar país…"
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    className={inputClass}
                    disabled={countriesLoading || !countries.length}
                    value={selectedApiCountry}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedApiCountry(v);
                      setSelectedTeam(null);
                      void loadLeaguesForCountry(v);
                    }}
                  >
                    <option value="">{countriesLoading ? 'A carregar…' : 'País'}</option>
                    {filteredCountries.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className={inputClass}
                    disabled={!leagues.length || leaguesLoading}
                    value={selectedLeagueId === '' ? '' : String(selectedLeagueId)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedLeagueId(v ? Number(v) : '');
                      setSelectedTeam(null);
                    }}
                  >
                    <option value="">{leaguesLoading ? 'A carregar ligas…' : 'Liga'}</option>
                    {leagues.map((row) => (
                      <option key={row.league.id} value={row.league.id}>
                        {row.league.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {discoverTab === 'search' && (
              <div className="space-y-2">
                <input
                  className={inputClass}
                  placeholder="Nome da equipa (mín. 2 letras)"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                />
                {searchLoading ? <p className="text-xs text-white/45">A pesquisar…</p> : null}
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2">
                  {searchResults.map((row) => (
                    <TeamRow
                      key={row.team.id}
                      row={row}
                      selected={selectedTeam?.team.id === row.team.id}
                      onPick={() => setSelectedTeam(row)}
                    />
                  ))}
                  {!searchLoading && searchQ.trim().length >= 2 && searchResults.length === 0 ? (
                    <p className="px-2 py-3 text-center text-sm text-white/45">Nenhum resultado.</p>
                  ) : null}
                </div>
              </div>
            )}

            {(discoverTab === 'major' || discoverTab === 'country') && (
              <div className="space-y-2">
                {teamsLoading ? <p className="text-xs text-white/45">A carregar equipas…</p> : null}
                <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2">
                  {teams.map((row) => (
                    <TeamRow
                      key={row.team.id}
                      row={row}
                      selected={selectedTeam?.team.id === row.team.id}
                      onPick={() => setSelectedTeam(row)}
                    />
                  ))}
                  {!teamsLoading && typeof selectedLeagueId === 'number' && teams.length === 0 ? (
                    <p className="px-2 py-3 text-center text-sm text-white/45">Sem equipas nesta liga/época.</p>
                  ) : null}
                </div>
              </div>
            )}

            {selectedTeam ? (
              <div className="flex items-center gap-3 rounded-lg border border-neon-yellow/25 bg-neon-yellow/5 p-3">
                {selectedTeam.team.logo ? (
                  <img
                    src={selectedTeam.team.logo}
                    alt=""
                    className="h-12 w-12 shrink-0 object-contain"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-white/10 text-xs text-white/50">
                    —
                  </div>
                )}
                <div>
                  <p className="font-medium text-white">Time do coração</p>
                  <p className="text-sm text-white/70">{selectedTeam.team.name}</p>
                </div>
              </div>
            ) : null}
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

function TeamRow({
  row,
  selected,
  onPick,
}: {
  row: ApiTeamEntry;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition',
        selected ? 'bg-neon-yellow/20 text-white' : 'text-white/85 hover:bg-white/5',
      )}
    >
      {row.team.logo ? (
        <img src={row.team.logo} alt="" className="h-8 w-8 shrink-0 object-contain" />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/10 text-[10px] text-white/40">?</span>
      )}
      <span className="truncate">{row.team.name}</span>
    </button>
  );
}
