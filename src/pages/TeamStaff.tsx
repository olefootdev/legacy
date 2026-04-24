import { useMemo, useState } from 'react';
import { Check, ChevronDown, Crosshair, Lightbulb, Shield, Sparkles, UserCog, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TeamMeuTimeHeader } from '@/pages/TeamMeuTimeHeader';
import { useGameDispatch, useGameStore } from '@/game/store';
import { getStaffUpgradeCost, maxStaffSlotsByLevel, STAFF_LABELS, STAFF_ROLE_IDS } from '@/systems/staff';
import { STAFF_BENEFIT_SUMMARY } from '@/systems/staffBenefits';
import type { StaffRoleId } from '@/game/types';
import { cn } from '@/lib/utils';

const COLLECTIVE_GROUPS = ['defensivo', 'criativo', 'ataque'] as const;

function collectiveGroupIcon(g: (typeof COLLECTIVE_GROUPS)[number]) {
  if (g === 'defensivo') return Shield;
  if (g === 'criativo') return Lightbulb;
  return Crosshair;
}

export function TeamStaff() {
  const dispatch = useGameDispatch();
  const manager = useGameStore((s) => s.manager);
  const players = useGameStore((s) => s.players);
  const finance = useGameStore((s) => s.finance);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, StaffRoleId[]>>({});
  const [appliedFlash, setAppliedFlash] = useState<string | null>(null);
  const [group, setGroup] = useState<(typeof COLLECTIVE_GROUPS)[number]>('defensivo');

  /** Só jogadores criados pelo manager (academy) podem ser orientados individualmente. */
  const academyRoster = useMemo(
    () => Object.values(players).filter((p) => p.managerCreated === true).sort((a, b) => a.num - b.num),
    [players],
  );

  const treinadorLvl = manager.staff.roles.treinador ?? 1;
  const perRoleCap = maxStaffSlotsByLevel(treinadorLvl);

  /** Uso atual de cada role, somando todos os jogadores. */
  const roleUsage = useMemo(() => {
    const out: Record<StaffRoleId, number> = {
      preparador_fisico: 0,
      mental: 0,
      nutricao: 0,
      tatico: 0,
      treinador: 0,
      olheiro: 0,
      preparador_goleiros: 0,
    };
    for (const roles of Object.values(manager.staff.assignedByPlayer ?? {})) {
      for (const r of roles ?? []) out[r] = (out[r] ?? 0) + 1;
    }
    return out;
  }, [manager.staff.assignedByPlayer]);

  const draftFor = (pid: string): StaffRoleId[] => {
    if (draft[pid] !== undefined) return draft[pid];
    return manager.staff.assignedByPlayer[pid] ?? [];
  };

  const togglePending = (pid: string, roleId: StaffRoleId) => {
    setAppliedFlash(null);
    const current = draftFor(pid);
    const exists = current.includes(roleId);
    const next = exists ? current.filter((x) => x !== roleId) : [...current, roleId];
    setDraft((d) => ({ ...d, [pid]: next }));
  };

  const resetDraft = (pid: string) => {
    setDraft((d) => {
      const { [pid]: _unused, ...rest } = d;
      void _unused;
      return rest;
    });
  };

  const applyDraft = (pid: string) => {
    const roles = draftFor(pid);
    dispatch({ type: 'ASSIGN_STAFF_TO_PLAYER', playerId: pid, roleIds: roles });
    setAppliedFlash(pid);
    resetDraft(pid);
    setTimeout(() => setAppliedFlash((v) => (v === pid ? null : v)), 4500);
  };

  const toggleCollectiveRole = (roleId: StaffRoleId) => {
    const current = manager.staff.assignedCollective[group] ?? [];
    const exists = current.includes(roleId);
    const next = exists ? current.filter((x) => x !== roleId) : [...current, roleId].slice(0, perRoleCap);
    dispatch({ type: 'ASSIGN_STAFF_TO_COLLECTIVE', group, roleIds: next });
  };

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-6 pb-8">
      <TeamMeuTimeHeader
        title="Staff"
        subtitle="Profissionais contratados, evolução e orientação ativa por jogador da academia."
      />

      <div className="sports-panel p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-black/40 border border-white/10 rounded p-3 text-xs">
            <div className="text-gray-500 uppercase font-bold">Slots por role</div>
            <div className="text-neon-yellow text-lg font-black">{perRoleCap}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Treinador nível {treinadorLvl}</div>
          </div>
          <div className="bg-black/40 border border-white/10 rounded p-3 text-xs">
            <div className="text-gray-500 uppercase font-bold">EXP disponível</div>
            <div className="text-white text-lg font-black">{Math.round(finance.ole).toLocaleString('pt-BR')}</div>
          </div>
          <div className="bg-black/40 border border-white/10 rounded p-3 text-xs">
            <div className="text-gray-500 uppercase font-bold">BRO disponível</div>
            <div className="text-white text-lg font-black">{(finance.broCents / 100).toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="sports-panel p-5">
        <h3 className="font-display font-black uppercase tracking-wider mb-3">Profissionais contratados</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {STAFF_ROLE_IDS.map((id) => {
            const level = manager.staff.roles[id] ?? 1;
            const cost = getStaffUpgradeCost(level);
            return (
              <div key={id} className="bg-black/40 border border-white/10 rounded p-3">
                <div className="flex justify-between items-center">
                  <div className="text-sm font-bold text-white">{STAFF_LABELS[id]}</div>
                  <span className="text-xs bg-white/10 px-2 py-1 rounded">Nível {level}</span>
                </div>
                <div className="text-[11px] text-gray-500 mt-2 space-y-1">
                  <p>Impacto cresce com o nível; níveis 1–3 via EXP, 4–5 via BRO.</p>
                  <ul className="list-disc pl-3.5 text-gray-400 space-y-0.5">
                    {STAFF_BENEFIT_SUMMARY[id].lines.map((line, li) => (
                      <li key={li}>{line}</li>
                    ))}
                  </ul>
                </div>
                <button
                  disabled={!cost}
                  onClick={() => dispatch({ type: 'UPGRADE_STAFF_ROLE', roleId: id })}
                  className="mt-3 w-full bg-neon-yellow text-black py-2 rounded text-xs font-bold uppercase disabled:opacity-40"
                >
                  {cost
                    ? `Evoluir (${cost.currency === 'bro' ? 'BRO ' + (cost.amount / 100).toFixed(2) : 'EXP ' + cost.amount.toLocaleString('pt-BR')})`
                    : 'Nível máximo'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sports-panel p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-display font-black uppercase tracking-wider flex items-center gap-2">
            <UserCog className="w-4 h-4" /> Buff ativo por jogador
          </h3>
          <span className="text-[10px] uppercase tracking-wider text-gray-500">
            Só jogadores da academia · cada role aceita {perRoleCap} atleta(s)
          </span>
        </div>

        {academyRoster.length === 0 ? (
          <div className="rounded border border-dashed border-white/15 bg-black/30 p-6 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-neon-yellow/80" aria-hidden />
            <p className="mt-3 text-sm text-white/80">Ainda não há jogadores criados pelo manager.</p>
            <p className="mt-1 text-xs text-gray-500">
              Cria teu primeiro prospecto na{' '}
              <Link to="/city/youth-prospects" className="text-neon-yellow underline hover:text-white">
                Academia
              </Link>{' '}
              pra começar a dar buff específico com os profissionais.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {academyRoster.map((p) => {
              const savedAssigned = manager.staff.assignedByPlayer[p.id] ?? [];
              const pending = draftFor(p.id);
              const isOpen = expandedPlayerId === p.id;
              const dirty = JSON.stringify([...pending].sort()) !== JSON.stringify([...savedAssigned].sort());
              const showFlash = appliedFlash === p.id;
              const pillTone =
                savedAssigned.length === 0
                  ? 'bg-white/10 text-gray-400'
                  : 'bg-neon-yellow/20 text-neon-yellow';
              const isGoalkeeper = p.pos === 'GK' || p.pos === 'GOL';
              return (
                <div key={p.id} className="rounded border border-white/10 bg-black/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedPlayerId(isOpen ? null : p.id);
                      setAppliedFlash(null);
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-3 hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0 w-9 h-9 rounded bg-neon-yellow/15 text-neon-yellow flex items-center justify-center font-display font-black text-sm">
                        {p.num}
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="text-sm font-bold text-white truncate">{p.name}</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                          {p.pos} · OVR {Math.round(p.ovr ?? 0)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn('rounded px-2 py-0.5 text-[10px] font-bold', pillTone)}>
                        {savedAssigned.length} ativo(s)
                      </span>
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 text-gray-500 transition-transform',
                          isOpen && 'rotate-180 text-white',
                        )}
                      />
                    </div>
                  </button>
                  {isOpen ? (
                    <div className="border-t border-white/10 bg-black/60 p-3 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {STAFF_ROLE_IDS.map((id) => {
                          const selected = pending.includes(id);
                          const gkLocked = id === 'preparador_goleiros' && !isGoalkeeper;
                          const otherUsers = roleUsage[id] - (savedAssigned.includes(id) ? 1 : 0);
                          const roleFull = !selected && otherUsers >= perRoleCap;
                          const disabled = gkLocked || roleFull;
                          return (
                            <button
                              key={id}
                              type="button"
                              disabled={disabled}
                              onClick={() => togglePending(p.id, id)}
                              className={cn(
                                'py-2 px-2 rounded text-[11px] font-bold uppercase tracking-wide transition-colors',
                                selected
                                  ? 'bg-neon-yellow text-black'
                                  : 'bg-white/5 border border-white/10 text-white hover:bg-white/10',
                                disabled && 'opacity-35 pointer-events-none',
                              )}
                              title={gkLocked ? 'Só para goleiros' : roleFull ? 'Slots da role cheios' : undefined}
                            >
                              <div>{STAFF_LABELS[id]}</div>
                              <div className="mt-0.5 text-[9px] font-normal opacity-70">
                                {roleUsage[id]}/{perRoleCap} slot(s)
                                {gkLocked ? ' · GK' : ''}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => applyDraft(p.id)}
                          disabled={!dirty}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded bg-neon-yellow px-4 py-2 text-xs font-bold uppercase tracking-wider text-black disabled:opacity-40"
                        >
                          <Zap className="w-3.5 h-3.5" aria-hidden />
                          Aplicar
                        </button>
                        {dirty ? (
                          <button
                            type="button"
                            onClick={() => resetDraft(p.id)}
                            className="rounded border border-white/15 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-300 hover:bg-white/5"
                          >
                            Cancelar
                          </button>
                        ) : null}
                      </div>

                      {showFlash && savedAssigned.length > 0 ? (
                        <div className="rounded border border-neon-green/35 bg-neon-green/10 p-3">
                          <div className="flex items-center gap-2 text-neon-green text-[11px] font-bold uppercase tracking-wider">
                            <Check className="w-3.5 h-3.5" /> Buff ativo aplicado
                          </div>
                          <ul className="mt-2 space-y-0.5 text-[11px] text-white/85">
                            {savedAssigned.map((r) => (
                              <li key={r}>
                                <span className="font-bold text-neon-yellow">{STAFF_LABELS[r]}</span>
                                {' '}— N{manager.staff.roles[r] ?? 1} ativo em {p.name} durante partidas.
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="sports-panel p-5 space-y-4">
        <h3 className="font-display font-black uppercase tracking-wider flex items-center gap-2">
          <Users className="w-4 h-4" /> Orientação coletiva
        </h3>
        <div className="flex flex-wrap gap-2">
          {COLLECTIVE_GROUPS.map((g) => {
            const GIcon = collectiveGroupIcon(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                className={
                  group === g
                    ? 'inline-flex items-center gap-1.5 rounded bg-neon-yellow px-4 py-2 text-xs font-bold uppercase text-black'
                    : 'inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase text-gray-200'
                }
              >
                <GIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {g}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {STAFF_ROLE_IDS.map((id) => {
            const selected = (manager.staff.assignedCollective[group] ?? []).includes(id);
            return (
              <button
                key={id}
                onClick={() => toggleCollectiveRole(id)}
                className={selected ? 'bg-neon-yellow text-black py-2 rounded text-xs font-bold' : 'bg-white/5 border border-white/10 py-2 rounded text-xs font-bold'}
              >
                {STAFF_LABELS[id]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
