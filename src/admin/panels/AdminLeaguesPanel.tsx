import { useCallback, useMemo, useState } from 'react';
import { Plus, Save, Star, Trash2, ChevronDown, ChevronUp, Shuffle } from 'lucide-react';
import { useGameDispatch, useGameStore } from '@/game/store';
import type { AdminLeagueConfig, KnockoutBracketSize, LeagueFormat, LeagueStandingRow } from '@/match/adminLeagues';
import {
  generateKnockoutRounds,
  KNOCKOUT_BRACKET_SIZES,
  LEAGUE_FORMAT_LABELS,
  newTeamId,
  sortStandings,
} from '@/match/adminLeagues';
import { AdminNewLeagueModal } from '@/admin/components/AdminNewLeagueModal';
import { cn } from '@/lib/utils';

export function AdminLeaguesPanel() {
  const dispatch = useGameDispatch();
  const adminLeagues = useGameStore((s) => s.adminLeagues);
  const adminPrimaryLeagueId = useGameStore((s) => s.adminPrimaryLeagueId);
  const club = useGameStore((s) => s.club);

  const [newModalOpen, setNewModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(() => adminLeagues[0]?.id ?? null);
  const [draftById, setDraftById] = useState<Record<string, AdminLeagueConfig>>({});

  const getDraft = useCallback(
    (lg: AdminLeagueConfig) => draftById[lg.id] ?? lg,
    [draftById],
  );

  const setDraft = (id: string, next: AdminLeagueConfig) => {
    setDraftById((d) => ({ ...d, [id]: next }));
  };

  const discardDraft = (id: string) => {
    setDraftById((d) => {
      const { [id]: _, ...rest } = d;
      return rest;
    });
  };

  const saveLeague = (lg: AdminLeagueConfig) => {
    dispatch({ type: 'ADMIN_UPSERT_LEAGUE', league: lg });
    discardDraft(lg.id);
  };

  const sortedPreview = useMemo(() => {
    const map: Record<string, LeagueStandingRow[]> = {};
    for (const lg of adminLeagues) {
      const d = getDraft(lg);
      map[lg.id] = sortStandings(d.standings);
    }
    return map;
  }, [adminLeagues, getDraft]);

  return (
    <div className="space-y-4">
      <AdminNewLeagueModal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        clubName={club.name}
        onCreate={(league) => {
          dispatch({ type: 'ADMIN_UPSERT_LEAGUE', league });
          setExpandedId(league.id);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-white/55">
          Cria e edita competições persistidas no save. A liga <strong className="text-white/80">principal</strong>{' '}
          sincroniza cartão e tabela com <code className="text-neon-yellow/80">leagueSeason</code> quando a opção
          está ativa. Inclui uma equipa com o nome do clube actual (
          <span className="text-white">{club.name}</span>) para destacar na UI.
        </p>
        <button
          type="button"
          onClick={() => setNewModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-neon-yellow px-4 py-2.5 font-display text-xs font-black uppercase tracking-wide text-black hover:bg-white"
        >
          <Plus className="h-4 w-4" />
          Nova liga
        </button>
      </div>

      <div className="space-y-2">
        {adminLeagues.map((lg) => {
          const d = getDraft(lg);
          const isPrimary = adminPrimaryLeagueId === lg.id;
          const open = expandedId === lg.id;
          const sorted = sortedPreview[lg.id] ?? [];
          const bracketSize = d.knockoutBracketSize ?? 16;
          const canKnockoutTools = d.format === 'knockout' || d.format === 'hybrid';

          return (
            <div key={lg.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : lg.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-bold text-white">{d.name}</span>
                    {isPrimary ? (
                      <span className="rounded bg-neon-yellow/20 px-2 py-0.5 text-[9px] font-bold uppercase text-neon-yellow">
                        Principal
                      </span>
                    ) : null}
                    <span className="rounded border border-white/15 px-2 py-0.5 text-[9px] font-bold uppercase text-white/50">
                      {LEAGUE_FORMAT_LABELS[d.format]}
                    </span>
                  </div>
                  <p className="text-xs text-white/40">
                    {d.division} · {d.standings.length} equipas
                    {d.startDate && d.endDate ? ` · ${d.startDate} → ${d.endDate}` : null}
                  </p>
                </div>
                {open ? <ChevronUp className="h-5 w-5 shrink-0 text-white/40" /> : <ChevronDown className="h-5 w-5 shrink-0 text-white/40" />}
              </button>

              {open ? (
                <div className="space-y-4 border-t border-white/10 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
                      Nome
                      <input
                        value={d.name}
                        onChange={(e) => setDraft(lg.id, { ...d, name: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
                      Divisão / fase
                      <input
                        value={d.division}
                        onChange={(e) => setDraft(lg.id, { ...d, division: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
                      Formato
                      <select
                        value={d.format}
                        onChange={(e) => {
                          const format = e.target.value as LeagueFormat;
                          const next: AdminLeagueConfig = { ...d, format };
                          if (format === 'round_robin') {
                            next.knockoutRounds = undefined;
                            next.knockoutBracketSize = undefined;
                            next.knockoutStartDate = undefined;
                            next.hybridQualificationEndDate = undefined;
                          }
                          if (format === 'knockout') {
                            next.hybridQualificationEndDate = undefined;
                            if (!next.knockoutBracketSize) next.knockoutBracketSize = 16;
                          }
                          if (format === 'hybrid') {
                            if (!next.knockoutBracketSize) next.knockoutBracketSize = 16;
                          }
                          setDraft(lg.id, next);
                        }}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                      >
                        {(Object.keys(LEAGUE_FORMAT_LABELS) as LeagueFormat[]).map((f) => (
                          <option key={f} value={f}>
                            {LEAGUE_FORMAT_LABELS[f]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 pt-6 text-sm text-white/70">
                      <input
                        type="checkbox"
                        checked={d.syncStatsFromSeason}
                        onChange={(e) => setDraft(lg.id, { ...d, syncStatsFromSeason: e.target.checked })}
                        className="rounded border-white/30"
                      />
                      Sincronizar com temporada (leagueSeason)
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
                      Início
                      <input
                        type="date"
                        value={d.startDate}
                        onChange={(e) => setDraft(lg.id, { ...d, startDate: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
                      Fim
                      <input
                        type="date"
                        value={d.endDate}
                        onChange={(e) => setDraft(lg.id, { ...d, endDate: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 sm:col-span-2">
                      Prémios / notas
                      <input
                        value={d.prizeSummary}
                        onChange={(e) => setDraft(lg.id, { ...d, prizeSummary: e.target.value })}
                        placeholder="Taça, OLE, EXP…"
                        className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25"
                      />
                    </label>
                  </div>

                  {d.format === 'hybrid' ? (
                    <label className="block max-w-md text-[10px] font-bold uppercase tracking-wider text-white/40">
                      Fim da qualificação (tabela)
                      <input
                        type="date"
                        value={d.hybridQualificationEndDate ?? ''}
                        onChange={(e) =>
                          setDraft(lg.id, { ...d, hybridQualificationEndDate: e.target.value || undefined })
                        }
                        className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                      />
                    </label>
                  ) : null}

                  {canKnockoutTools ? (
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
                        Início mata-mata
                        <input
                          type="date"
                          value={d.knockoutStartDate ?? ''}
                          onChange={(e) =>
                            setDraft(lg.id, { ...d, knockoutStartDate: e.target.value || undefined })
                          }
                          className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                        />
                      </label>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
                        Bracket
                        <select
                          value={bracketSize}
                          onChange={(e) =>
                            setDraft(lg.id, {
                              ...d,
                              knockoutBracketSize: Number(e.target.value) as KnockoutBracketSize,
                            })
                          }
                          className="mt-1 w-full min-w-[8rem] rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                        >
                          {KNOCKOUT_BRACKET_SIZES.map((s) => (
                            <option key={s} value={s}>
                              {s} equipas
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            const rounds = generateKnockoutRounds(sortStandings(d.standings), bracketSize);
                            setDraft(lg.id, { ...d, knockoutRounds: rounds, knockoutBracketSize: bracketSize });
                          } catch {
                            alert('Não foi possível gerar chaves. Verifica o tamanho do bracket e as equipas.');
                          }
                        }}
                        className="flex items-center gap-2 rounded-lg border border-neon-yellow/40 bg-neon-yellow/10 px-3 py-2 text-xs font-bold uppercase text-neon-yellow hover:bg-neon-yellow/20"
                      >
                        <Shuffle className="h-3.5 w-3.5" />
                        Sortear chaves
                      </button>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-end gap-2">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'ADMIN_SET_PRIMARY_LEAGUE', id: lg.id })}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold uppercase',
                        isPrimary
                          ? 'border-neon-yellow/50 text-neon-yellow'
                          : 'border-white/15 text-white/70 hover:bg-white/10',
                      )}
                    >
                      <Star className="h-3.5 w-3.5" />
                      Principal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (adminLeagues.length <= 1) {
                          alert('Mantém pelo menos uma liga.');
                          return;
                        }
                        if (!window.confirm(`Eliminar "${d.name}"?`)) return;
                        dispatch({ type: 'ADMIN_REMOVE_LEAGUE', id: lg.id });
                        discardDraft(lg.id);
                        setExpandedId(null);
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold uppercase text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </button>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                        {d.format === 'knockout' ? 'Equipas inscritas' : 'Classificação'}
                      </h4>
                        <button
                          type="button"
                          onClick={() =>
                            setDraft(lg.id, {
                              ...d,
                              standings: [
                                ...d.standings,
                                {
                                  teamId: newTeamId(),
                                  name: 'Nova equipa',
                                  played: 0,
                                  points: 0,
                                  goalsFor: 0,
                                  goalsAgainst: 0,
                                },
                              ],
                            })
                          }
                          className="text-xs font-bold text-neon-yellow hover:underline"
                        >
                          + Linha
                        </button>
                      </div>
                      <div className="ole-scroll-x rounded-lg border border-white/10">
                        <table className="w-full min-w-[520px] text-left text-xs">
                          <thead>
                            <tr className="border-b border-white/10 text-[10px] uppercase text-white/40">
                              <th className="px-2 py-2">#</th>
                              <th className="px-2 py-2">Equipa</th>
                              <th className="px-2 py-2">J</th>
                              <th className="px-2 py-2">PTS</th>
                              <th className="px-2 py-2">GF</th>
                              <th className="px-2 py-2">GC</th>
                              <th className="px-2 py-2" />
                            </tr>
                          </thead>
                          <tbody>
                            {sorted.map((row, idx) => {
                              const origIdx = d.standings.findIndex((x) => x.teamId === row.teamId);
                              return (
                                <tr key={row.teamId} className="border-b border-white/5">
                                  <td className="px-2 py-2 font-mono text-white/50">{idx + 1}</td>
                                  <td className="px-2 py-1">
                                    <input
                                      value={row.name}
                                      onChange={(e) => {
                                        const standings = [...d.standings];
                                        const i = origIdx >= 0 ? origIdx : d.standings.indexOf(row);
                                        if (i < 0) return;
                                        standings[i] = { ...standings[i]!, name: e.target.value };
                                        setDraft(lg.id, { ...d, standings });
                                      }}
                                      className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-white"
                                    />
                                  </td>
                                  {(['played', 'points', 'goalsFor', 'goalsAgainst'] as const).map((field) => (
                                    <td key={field} className="px-2 py-1">
                                      <input
                                        type="number"
                                        value={row[field]}
                                        onChange={(e) => {
                                          const n = Number(e.target.value) || 0;
                                          const standings = [...d.standings];
                                          const i = origIdx >= 0 ? origIdx : d.standings.indexOf(row);
                                          if (i < 0) return;
                                          standings[i] = { ...standings[i]!, [field]: n };
                                          setDraft(lg.id, { ...d, standings });
                                        }}
                                        className="w-14 rounded border border-white/10 bg-black/30 px-2 py-1 font-mono text-white"
                                      />
                                    </td>
                                  ))}
                                  <td className="px-2 py-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (d.standings.length <= 2) return;
                                        setDraft(lg.id, {
                                          ...d,
                                          standings: d.standings.filter((x) => x.teamId !== row.teamId),
                                        });
                                      }}
                                      className="text-red-400 hover:text-red-300"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    <p className="mt-1 text-[10px] text-white/30">
                      {d.format === 'knockout'
                        ? 'Estas linhas servem de base ao sorteio (ordem na tabela não define o embate até sorteares).'
                        : 'Ordenação na app: pontos → saldo de golos → GF. Pré-visualização acima reflecte essa ordem.'}
                    </p>
                  </div>

                  {canKnockoutTools && d.knockoutRounds && d.knockoutRounds.length > 0 && (
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <h4 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                        Chaves (pré-visualização)
                      </h4>
                      <div className="ole-scroll-x flex gap-3 pb-1">
                        {d.knockoutRounds.map((round) => (
                          <div key={round.name} className="min-w-[160px] shrink-0 space-y-2">
                            <p className="text-[9px] font-bold uppercase text-white/35">{round.name}</p>
                            {round.pairs.map((p, pi) => (
                              <div
                                key={pi}
                                className="rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white/80"
                              >
                                <div className="truncate">{p.homeName}</div>
                                <div className="text-center text-white/25">vs</div>
                                <div className="truncate">{p.awayName}</div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => saveLeague(d)}
                      className="flex items-center gap-2 rounded-lg bg-neon-yellow px-4 py-2 font-display text-xs font-black uppercase text-black hover:bg-white"
                    >
                      <Save className="h-4 w-4" />
                      Guardar liga
                    </button>
                    {draftById[lg.id] ? (
                      <button
                        type="button"
                        onClick={() => discardDraft(lg.id)}
                        className="rounded-lg border border-white/15 px-4 py-2 text-xs font-bold uppercase text-white/60 hover:bg-white/10"
                      >
                        Descartar rascunho
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
