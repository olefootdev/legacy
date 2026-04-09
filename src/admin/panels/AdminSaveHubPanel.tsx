/**
 * Hub de dados do save local: plantel, próximo jogo, escalação, clube, coleções, wallet, partida, definições.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Database,
  Landmark,
  LayoutGrid,
  Settings2,
  Shield,
  Trash2,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatBroFromCents } from '@/systems/economy';
import { overallFromAttributes } from '@/entities/player';
import type { PlayerAttributes } from '@/entities/types';
import { mergeLineupWithDefaults } from '@/entities/lineup';
import { FORMATION_SCHEME_LIST, slotsForScheme } from '@/match-engine/formations/catalog';
import type { FormationSchemeId } from '@/match-engine/types';
import { ALL_STRUCTURE_IDS, STRUCTURE_LABELS, MAX_LEVEL, MIN_LEVEL } from '@/clubStructures/types';
import { MEMORABLE_TROPHY_SLOTS } from '@/trophies/memorableCatalog';
import { STAFF_LABELS, STAFF_ROLE_IDS } from '@/systems/staff';
import { defaultUserSettings } from '@/settings/defaultUserSettings';
import type { GraphicQualityId, ReduceMotionPreference } from '@/game/types';

type SaveSection =
  | 'roster'
  | 'fixture'
  | 'lineup'
  | 'club'
  | 'collections'
  | 'wallet'
  | 'match'
  | 'settings';

const SECTIONS: { id: SaveSection; label: string; icon: typeof Users }[] = [
  { id: 'roster', label: 'Plantel', icon: Users },
  { id: 'fixture', label: 'Próximo jogo', icon: Calendar },
  { id: 'lineup', label: 'Escalação', icon: LayoutGrid },
  { id: 'club', label: 'Clube & staff', icon: Landmark },
  { id: 'collections', label: 'Coleções', icon: Database },
  { id: 'wallet', label: 'Wallet save', icon: Wallet },
  { id: 'match', label: 'Partida ao vivo', icon: Shield },
  { id: 'settings', label: 'Definições', icon: Settings2 },
];

const ATTR_FIELDS: (keyof PlayerAttributes)[] = [
  'passe',
  'marcacao',
  'velocidade',
  'drible',
  'finalizacao',
  'fisico',
  'tatico',
  'mentalidade',
  'confianca',
  'fairPlay',
];

function parseNum(s: string, fallback: number): number {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

export function AdminSaveHubPanel() {
  const dispatch = useGameDispatch();
  const [section, setSection] = useState<SaveSection>('roster');

  const players = useGameStore((s) => s.players);
  const lineup = useGameStore((s) => s.lineup);
  const formationScheme = useGameStore((s) => s.manager.formationScheme);
  const nextFixture = useGameStore((s) => s.nextFixture);
  const structures = useGameStore((s) => s.structures);
  const crowd = useGameStore((s) => s.crowd);
  const clubLogistics = useGameStore((s) => s.clubLogistics);
  const memorableIds = useGameStore((s) => s.memorableTrophyUnlockedIds);
  const cardCollections = useGameStore((s) => s.cardCollections);
  const wallet = useGameStore((s) => s.finance.wallet);
  const liveMatch = useGameStore((s) => s.liveMatch);
  const trainingPlans = useGameStore((s) => s.manager.trainingPlans);
  const staffRoles = useGameStore((s) => s.manager.staff.roles);
  const userSettings = useGameStore((s) => s.userSettings);
  const results = useGameStore((s) => s.results);
  const broCentsGame = useGameStore((s) => s.finance.broCents);

  const playerList = useMemo(
    () => Object.values(players).sort((a, b) => a.name.localeCompare(b.name)),
    [players],
  );

  const [pickId, setPickId] = useState<string>('');
  useEffect(() => {
    if (!pickId && playerList[0]) setPickId(playerList[0]!.id);
  }, [pickId, playerList]);

  const picked = pickId ? players[pickId] : undefined;
  const [fNum, setFNum] = useState('');
  const [fName, setFName] = useState('');
  const [fPos, setFPos] = useState('');
  const [fFatigue, setFFatigue] = useState('');
  const [fInjury, setFInjury] = useState('');
  const [fOut, setFOut] = useState('');
  const [fMvBro, setFMvBro] = useState('');
  const [fAttrs, setFAttrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!picked) return;
    setFNum(String(picked.num));
    setFName(picked.name);
    setFPos(picked.pos);
    setFFatigue(String(picked.fatigue));
    setFInjury(String(picked.injuryRisk));
    setFOut(String(picked.outForMatches));
    setFMvBro(picked.marketValueBroCents != null ? String(picked.marketValueBroCents / 100) : '');
    const a: Record<string, string> = {};
    for (const k of ATTR_FIELDS) a[k] = String(picked.attrs[k]);
    setFAttrs(a);
  }, [picked]);

  const applyPlayer = () => {
    if (!picked) return;
    const attrs: Partial<PlayerAttributes> = {};
    for (const k of ATTR_FIELDS) {
      const v = parseNum(fAttrs[k] ?? '0', picked.attrs[k]);
      attrs[k] = Math.min(99, Math.max(1, Math.round(v)));
    }
    const partial: Partial<import('@/entities/types').PlayerEntity> = {
      num: Math.min(99, Math.max(1, Math.round(parseNum(fNum, picked.num)))),
      name: fName.trim() || picked.name,
      pos: fPos.trim().toUpperCase() || picked.pos,
      fatigue: Math.min(100, Math.max(0, Math.round(parseNum(fFatigue, picked.fatigue)))),
      injuryRisk: Math.min(100, Math.max(0, Math.round(parseNum(fInjury, picked.injuryRisk)))),
      outForMatches: Math.min(20, Math.max(0, Math.round(parseNum(fOut, picked.outForMatches)))),
      attrs: attrs as PlayerAttributes,
    };
    if (fMvBro.trim() !== '') {
      partial.marketValueBroCents = Math.max(0, Math.round(parseNum(fMvBro, 0) * 100));
    }
    dispatch({ type: 'ADMIN_PATCH_PLAYER', playerId: picked.id, partial });
  };

  const removePlayer = () => {
    if (!picked) return;
    if (!window.confirm(`Remover ${picked.name} do save? Referências na escalação serão limpas.`)) return;
    dispatch({ type: 'ADMIN_REMOVE_PLAYER', playerId: picked.id });
    setPickId('');
  };

  const [fxKick, setFxKick] = useState('');
  const [fxVenue, setFxVenue] = useState('');
  const [fxComp, setFxComp] = useState('');
  const [fxHome, setFxHome] = useState('');
  const [fxAway, setFxAway] = useState('');
  const [fxIsHome, setFxIsHome] = useState(true);
  const [oppId, setOppId] = useState('');
  const [oppName, setOppName] = useState('');
  const [oppShort, setOppShort] = useState('');
  const [oppStr, setOppStr] = useState('');

  useEffect(() => {
    const f = nextFixture;
    setFxKick(f.kickoffLabel);
    setFxVenue(f.venue);
    setFxComp(f.competition);
    setFxHome(f.homeName);
    setFxAway(f.awayName);
    setFxIsHome(f.isHome);
    setOppId(f.opponent.id);
    setOppName(f.opponent.name);
    setOppShort(f.opponent.shortName);
    setOppStr(String(f.opponent.strength));
  }, [nextFixture]);

  const applyFixture = () => {
    dispatch({
      type: 'ADMIN_PATCH_NEXT_FIXTURE',
      partial: {
        kickoffLabel: fxKick.trim(),
        venue: fxVenue.trim(),
        competition: fxComp.trim(),
        homeName: fxHome.trim(),
        awayName: fxAway.trim(),
        isHome: fxIsHome,
        opponent: {
          id: oppId.trim() || nextFixture.opponent.id,
          name: oppName.trim(),
          shortName: oppShort.trim().slice(0, 8).toUpperCase() || nextFixture.opponent.shortName,
          strength: Math.min(99, Math.max(40, Math.round(parseNum(oppStr, nextFixture.opponent.strength)))),
        },
      },
    });
  };

  const [formScheme, setFormScheme] = useState<FormationSchemeId>(formationScheme);
  const slots = useMemo(() => slotsForScheme(formScheme), [formScheme]);
  const [slotPicks, setSlotPicks] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormScheme(formationScheme);
  }, [formationScheme]);

  useEffect(() => {
    const merged = mergeLineupWithDefaults(lineup, players);
    const next: Record<string, string> = {};
    for (const sid of slotsForScheme(formScheme)) {
      next[sid] = merged[sid] ?? '';
    }
    setSlotPicks(next);
  }, [formScheme, lineup, players]);

  const applyLineup = () => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(slotPicks)) {
      if (v) out[k] = v;
    }
    dispatch({ type: 'SET_LINEUP', lineup: out, formationScheme: formScheme });
  };

  const [collId, setCollId] = useState('');
  const [collName, setCollName] = useState('');
  const [collMax, setCollMax] = useState('10000');

  const [wBro, setWBro] = useState('');
  const [wExp, setWExp] = useState('');
  const [wSponsor, setWSponsor] = useState('');

  useEffect(() => {
    const w = wallet;
    if (!w) return;
    setWBro(String(w.spotBroCents / 100));
    setWExp(String(w.spotExpBalance));
    setWSponsor(w.sponsorId ?? '');
  }, [wallet]);

  const applyWallet = () => {
    dispatch({
      type: 'ADMIN_PATCH_WALLET_BALANCES',
      spotBroCents: Math.round(parseNum(wBro, 0) * 100),
      spotExpBalance: Math.round(parseNum(wExp, 0)),
      sponsorId: wSponsor.trim() || null,
    });
  };

  const [staffDraft, setStaffDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    const d: Record<string, string> = {};
    for (const id of STAFF_ROLE_IDS) d[id] = String(staffRoles[id] ?? 1);
    setStaffDraft(d);
  }, [staffRoles]);

  const inputCls =
    'mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white placeholder:text-white/25';
  const labelCls = 'block text-[10px] font-bold uppercase text-white/40';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50/95">
        <p className="font-display font-black text-white">Dados do save</p>
        <p className="mt-1 text-white/70">
          Edição directa do estado persistido em <code className="text-neon-yellow/85">localStorage</code>. Útil para QA,
          demos e cenários. A escalação e o próximo jogo afectam o arranque das partidas.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-white/10 pb-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const on = section === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-bold uppercase',
                on ? 'bg-neon-yellow text-black' : 'text-white/45 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {section === 'roster' ? (
        <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-xs text-white/50">
            OVR exibido é calculado a partir dos atributos. Alterar <code className="text-white/60">pos</code> actualiza a
            zona tática.
          </p>
          <div className="grid gap-4 lg:grid-cols-[220px,1fr]">
            <div>
              <label className={labelCls}>Jogador</label>
              <select
                value={pickId}
                onChange={(e) => setPickId(e.target.value)}
                className={inputCls}
              >
                {playerList.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.num} {p.name} ({p.pos}) — {overallFromAttributes(p.attrs)}
                  </option>
                ))}
              </select>
            </div>
            {picked ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelCls}>
                  Número
                  <input value={fNum} onChange={(e) => setFNum(e.target.value)} className={inputCls} />
                </label>
                <label className={labelCls}>
                  Nome
                  <input value={fName} onChange={(e) => setFName(e.target.value)} className={inputCls} />
                </label>
                <label className={labelCls}>
                  Pos (ATA, MC, GOL…)
                  <input value={fPos} onChange={(e) => setFPos(e.target.value)} className={inputCls} />
                </label>
                <label className={labelCls}>
                  Valor mercado (BRO)
                  <input value={fMvBro} onChange={(e) => setFMvBro(e.target.value)} className={inputCls} />
                </label>
                <label className={labelCls}>
                  Fadiga 0–100
                  <input value={fFatigue} onChange={(e) => setFFatigue(e.target.value)} className={inputCls} />
                </label>
                <label className={labelCls}>
                  Risco lesão 0–100
                  <input value={fInjury} onChange={(e) => setFInjury(e.target.value)} className={inputCls} />
                </label>
                <label className={labelCls}>
                  Fora N jogos
                  <input value={fOut} onChange={(e) => setFOut(e.target.value)} className={inputCls} />
                </label>
              </div>
            ) : null}
          </div>
          {picked ? (
            <>
              <p className="text-[10px] font-bold uppercase text-white/40">Atributos</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {ATTR_FIELDS.map((k) => (
                  <label key={k} className={labelCls}>
                    {k}
                    <input
                      value={fAttrs[k] ?? ''}
                      onChange={(e) => setFAttrs((prev) => ({ ...prev, [k]: e.target.value }))}
                      className={inputCls}
                    />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyPlayer}
                  className="rounded-lg bg-neon-yellow px-4 py-2 text-xs font-black uppercase text-black"
                >
                  Aplicar jogador
                </button>
                <button
                  type="button"
                  onClick={removePlayer}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 px-4 py-2 text-xs font-bold uppercase text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {section === 'fixture' ? (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className={labelCls}>
              Rótulo horário
              <input value={fxKick} onChange={(e) => setFxKick(e.target.value)} className={inputCls} />
            </label>
            <label className={labelCls}>
              Competição
              <input value={fxComp} onChange={(e) => setFxComp(e.target.value)} className={inputCls} />
            </label>
            <label className={labelCls}>
              Estádio / local
              <input value={fxVenue} onChange={(e) => setFxVenue(e.target.value)} className={inputCls} />
            </label>
            <label className={cn(labelCls, 'flex items-end gap-2')}>
              <input type="checkbox" checked={fxIsHome} onChange={(e) => setFxIsHome(e.target.checked)} className="h-4 w-4" />
              <span>Jogamos em casa</span>
            </label>
            <label className={labelCls}>
              Nome casa (tabela)
              <input value={fxHome} onChange={(e) => setFxHome(e.target.value)} className={inputCls} />
            </label>
            <label className={labelCls}>
              Nome visitante (tabela)
              <input value={fxAway} onChange={(e) => setFxAway(e.target.value)} className={inputCls} />
            </label>
          </div>
          <p className="text-[10px] font-bold uppercase text-white/40">Adversário (motor / narrativa)</p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={labelCls}>
              ID interno
              <input value={oppId} onChange={(e) => setOppId(e.target.value)} className={inputCls} />
            </label>
            <label className={labelCls}>
              Nome completo
              <input value={oppName} onChange={(e) => setOppName(e.target.value)} className={inputCls} />
            </label>
            <label className={labelCls}>
              Sigla (≤8)
              <input value={oppShort} onChange={(e) => setOppShort(e.target.value)} className={inputCls} />
            </label>
            <label className={labelCls}>
              Força 40–99
              <input value={oppStr} onChange={(e) => setOppStr(e.target.value)} className={inputCls} />
            </label>
          </div>
          <button
            type="button"
            onClick={applyFixture}
            className="rounded-lg bg-neon-yellow px-4 py-2 text-xs font-black uppercase text-black"
          >
            Aplicar próximo jogo
          </button>
        </div>
      ) : null}

      {section === 'lineup' ? (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <label className={labelCls}>
            Formação
            <select
              value={formScheme}
              onChange={(e) => setFormScheme(e.target.value as FormationSchemeId)}
              className={inputCls}
            >
              {FORMATION_SCHEME_LIST.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {slots.map((sid) => (
              <label key={sid} className={labelCls}>
                Slot {sid}
                <select
                  value={slotPicks[sid] ?? ''}
                  onChange={(e) => setSlotPicks((p) => ({ ...p, [sid]: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {playerList.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.num} {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={applyLineup}
            className="rounded-lg bg-neon-yellow px-4 py-2 text-xs font-black uppercase text-black"
          >
            Guardar escalação + formação
          </button>
        </div>
      ) : null}

      {section === 'club' ? (
        <div className="space-y-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase text-white/40">Estruturas (nível {MIN_LEVEL}–{MAX_LEVEL})</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {ALL_STRUCTURE_IDS.map((sid) => (
                <div key={sid} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                  <span className="text-sm text-white/80">{STRUCTURE_LABELS[sid]}</span>
                  <input
                    type="number"
                    min={MIN_LEVEL}
                    max={MAX_LEVEL}
                    value={structures[sid] ?? MIN_LEVEL}
                    onChange={(e) =>
                      dispatch({
                        type: 'ADMIN_SET_STRUCTURE_LEVEL',
                        structureId: sid,
                        level: parseNum(e.target.value, MIN_LEVEL),
                      })
                    }
                    className="w-16 rounded border border-white/20 bg-black/50 px-2 py-1 text-center text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase text-white/40">Torcida</p>
            <div className="flex flex-wrap gap-3">
              <label className={labelCls}>
                Apoio %
                <input
                  type="number"
                  value={crowd.supportPercent}
                  onChange={(e) =>
                    dispatch({
                      type: 'ADMIN_PATCH_CROWD',
                      partial: { supportPercent: parseNum(e.target.value, crowd.supportPercent) },
                    })
                  }
                  className={inputCls + ' w-28'}
                />
              </label>
              <label className={labelCls}>
                Rótulo de humor
                <input
                  value={crowd.moodLabel}
                  onChange={(e) =>
                    dispatch({ type: 'ADMIN_PATCH_CROWD', partial: { moodLabel: e.target.value } })
                  }
                  className={inputCls + ' min-w-[10rem]'}
                />
              </label>
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase text-white/40">Logística</p>
            <label className={labelCls}>
              Última viagem (km)
              <input
                type="number"
                value={clubLogistics.lastTripKm}
                onChange={(e) =>
                  dispatch({
                    type: 'ADMIN_PATCH_CLUB_LOGISTICS',
                    partial: { lastTripKm: Math.max(0, parseNum(e.target.value, 0)) },
                  })
                }
                className={inputCls + ' max-w-xs'}
              />
            </label>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase text-white/40">
              <Trophy className="h-3.5 w-3.5" />
              Troféus memoráveis
            </p>
            <ul className="space-y-2">
              {MEMORABLE_TROPHY_SLOTS.map((t) => {
                const on = memorableIds.includes(t.id);
                return (
                  <li key={t.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        const set = new Set(memorableIds);
                        if (on) set.delete(t.id);
                        else set.add(t.id);
                        dispatch({ type: 'ADMIN_SET_MEMORABLE_TROPHIES', ids: [...set] });
                      }}
                      className="mt-1 h-4 w-4"
                    />
                    <span>
                      <span className="font-bold text-white">{t.name}</span>
                      <span className="block text-xs text-white/45">{t.blurb}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase text-white/40">
              Staff — níveis (1–5) sem custo
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {STAFF_ROLE_IDS.map((rid) => (
                <label key={rid} className={labelCls}>
                  {STAFF_LABELS[rid]}
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={staffDraft[rid] ?? '1'}
                    onChange={(e) => setStaffDraft((d) => ({ ...d, [rid]: e.target.value }))}
                    className={inputCls}
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                const roles: Partial<Record<(typeof STAFF_ROLE_IDS)[number], number>> = {};
                for (const rid of STAFF_ROLE_IDS) {
                  roles[rid] = Math.min(5, Math.max(1, Math.round(parseNum(staffDraft[rid] ?? '1', 1))));
                }
                dispatch({ type: 'ADMIN_PATCH_STAFF_ROLES', roles });
              }}
              className="mt-2 rounded-lg border border-white/20 px-3 py-2 text-[10px] font-bold uppercase text-white/80 hover:bg-white/10"
            >
              Aplicar todos os níveis de staff
            </button>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase text-white/40">
              Planos de treino ({trainingPlans.length})
            </p>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm('Limpar todos os planos de treino em curso?')) return;
                dispatch({ type: 'ADMIN_CLEAR_TRAINING_PLANS' });
              }}
              className="rounded-lg border border-amber-500/40 px-3 py-2 text-xs font-bold uppercase text-amber-200"
            >
              Limpar planos de treino
            </button>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase text-white/40">
              Histórico de resultados ({results.length})
            </p>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm('Apagar todo o histórico de jogos do save?')) return;
                dispatch({ type: 'ADMIN_SET_RESULTS', results: [] });
              }}
              className="rounded-lg border border-rose-500/35 px-3 py-2 text-xs font-bold uppercase text-rose-200"
            >
              Limpar resultados
            </button>
          </div>
        </div>
      ) : null}

      {section === 'collections' ? (
        <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className={labelCls}>
              ID coleção
              <input value={collId} onChange={(e) => setCollId(e.target.value)} className={inputCls} placeholder="col_ole_gen1" />
            </label>
            <label className={labelCls}>
              Nome
              <input value={collName} onChange={(e) => setCollName(e.target.value)} className={inputCls} />
            </label>
            <label className={labelCls}>
              Max supply
              <input value={collMax} onChange={(e) => setCollMax(e.target.value)} className={inputCls} />
            </label>
          </div>
          <button
            type="button"
            onClick={() => {
              const id = collId.trim();
              const name = collName.trim();
              if (!id || !name) return;
              dispatch({
                type: 'UPSERT_CARD_COLLECTION',
                collection: {
                  id,
                  name,
                  maxSupply: Math.max(1, Math.floor(parseNum(collMax, 10000))),
                  createdAt: new Date().toISOString(),
                },
              });
              setCollId('');
              setCollName('');
            }}
            className="rounded-lg bg-neon-yellow px-4 py-2 text-xs font-black uppercase text-black"
          >
            Criar / actualizar coleção
          </button>
          <ul className="space-y-2">
            {Object.values(cardCollections).map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-mono text-neon-yellow/90">{c.id}</span> — {c.name}{' '}
                  <span className="text-white/45">(max {c.maxSupply})</span>
                </span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'ADMIN_REMOVE_CARD_COLLECTION', id: c.id })}
                  className="text-xs text-rose-400 hover:underline"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {section === 'wallet' ? (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-xs text-white/50">
            SPOT sincronizado com <code className="text-white/60">finance.broCents</code> ao gravar. BRO em unidades (ex.{' '}
            10,5).
          </p>
          <label className={labelCls}>
            SPOT BRO
            <input value={wBro} onChange={(e) => setWBro(e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            SPOT EXP
            <input value={wExp} onChange={(e) => setWExp(e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            Sponsor ID (referral) ou vazio
            <input value={wSponsor} onChange={(e) => setWSponsor(e.target.value)} className={inputCls} />
          </label>
          <button
            type="button"
            onClick={applyWallet}
            className="rounded-lg bg-neon-yellow px-4 py-2 text-xs font-black uppercase text-black"
          >
            Aplicar saldos wallet
          </button>
          <p className="text-[10px] text-white/35">
            BRO jogo actual (save): {formatBroFromCents(broCentsGame)} — actualiza ao aplicar SPOT acima.
          </p>
        </div>
      ) : null}

      {section === 'match' ? (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          {liveMatch ? (
            <>
              <p className="text-sm text-white/80">
                Fase: <strong className="text-white">{liveMatch.phase}</strong> · Modo{' '}
                <strong className="text-white">{liveMatch.mode}</strong> · {liveMatch.minute}&apos; · Placar{' '}
                {liveMatch.homeScore}–{liveMatch.awayScore}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm('Descartar o estado da partida ao vivo? O save ficará sem liveMatch.')) return;
                  dispatch({ type: 'ADMIN_CLEAR_LIVE_MATCH' });
                }}
                className="rounded-lg border border-rose-500/40 px-4 py-2 text-xs font-bold uppercase text-rose-200"
              >
                Limpar partida ao vivo
              </button>
              <p className="text-xs text-white/45">
                Para continuar o jogo normalmente, usa a interface de partida. Isto só remove o snapshot persistido.
              </p>
            </>
          ) : (
            <p className="text-sm text-white/50">Não há partida ao vivo no save.</p>
          )}
        </div>
      ) : null}

      {section === 'settings' ? (
        <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <label className={cn(labelCls, 'flex items-center gap-2')}>
            <input
              type="checkbox"
              checked={userSettings.soundEnabled}
              onChange={(e) =>
                dispatch({ type: 'SET_USER_SETTINGS', partial: { soundEnabled: e.target.checked } })
              }
              className="h-4 w-4"
            />
            Som activo
          </label>
          <label className={labelCls}>
            Qualidade gráfica
            <select
              value={userSettings.graphicQuality}
              onChange={(e) =>
                dispatch({ type: 'SET_USER_SETTINGS', partial: { graphicQuality: e.target.value as GraphicQualityId } })
              }
              className={inputCls}
            >
              {(['low', 'medium', 'high'] as const).map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Reduzir movimento
            <select
              value={userSettings.reduceMotion}
              onChange={(e) =>
                dispatch({
                  type: 'SET_USER_SETTINGS',
                  partial: { reduceMotion: e.target.value as ReduceMotionPreference },
                })
              }
              className={inputCls}
            >
              <option value="system">Sistema</option>
              <option value="reduce">Reduzir</option>
              <option value="noReduce">Não reduzir</option>
            </select>
          </label>
          <label className={cn(labelCls, 'flex items-center gap-2')}>
            <input
              type="checkbox"
              checked={userSettings.worldSimulateInBackground}
              onChange={(e) =>
                dispatch({
                  type: 'SET_USER_SETTINGS',
                  partial: { worldSimulateInBackground: e.target.checked },
                })
              }
              className="h-4 w-4"
            />
            Simular mundo em segundo plano
          </label>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_USER_SETTINGS', partial: { ...defaultUserSettings } })}
            className="rounded-lg border border-white/20 px-3 py-2 text-[10px] font-bold uppercase text-white/70 hover:bg-white/10"
          >
            Repor definições padrão
          </button>
          <p className="text-[10px] text-white/35">
            Avatar do treinador e brasão gerem-se na Config do jogo (data URLs grandes).
          </p>
        </div>
      ) : null}
    </div>
  );
}
