import { useMemo, useState } from 'react';
import { Crosshair, Lightbulb, Shield, UserCog, Users } from 'lucide-react';
import { TeamMeuTimeHeader } from '@/pages/TeamMeuTimeHeader';
import { useGameDispatch, useGameStore } from '@/game/store';
import { getStaffUpgradeCost, maxStaffSlotsByLevel, STAFF_LABELS, STAFF_ROLE_IDS } from '@/systems/staff';
import { STAFF_BENEFIT_SUMMARY } from '@/systems/staffBenefits';
import type { StaffRoleId } from '@/game/types';

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
  const [playerId, setPlayerId] = useState<string>('');
  const [group, setGroup] = useState<(typeof COLLECTIVE_GROUPS)[number]>('defensivo');

  const roster = useMemo(() => Object.values(players).sort((a, b) => a.num - b.num), [players]);
  const slotLimit = maxStaffSlotsByLevel(manager.staff.roles.treinador ?? 1);

  const togglePlayerRole = (roleId: StaffRoleId) => {
    if (!playerId) return;
    const current = manager.staff.assignedByPlayer[playerId] ?? [];
    const exists = current.includes(roleId);
    const next = exists ? current.filter((x) => x !== roleId) : [...current, roleId].slice(0, slotLimit);
    dispatch({ type: 'ASSIGN_STAFF_TO_PLAYER', playerId, roleIds: next });
  };

  const toggleCollectiveRole = (roleId: StaffRoleId) => {
    const current = manager.staff.assignedCollective[group] ?? [];
    const exists = current.includes(roleId);
    const next = exists ? current.filter((x) => x !== roleId) : [...current, roleId].slice(0, slotLimit);
    dispatch({ type: 'ASSIGN_STAFF_TO_COLLECTIVE', group, roleIds: next });
  };

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-6 pb-8">
      <TeamMeuTimeHeader
        title="Staff"
        subtitle="Profissionais contratados, evolução e slots de orientação por jogador e coletivo."
      />

      <div className="sports-panel p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-black/40 border border-white/10 rounded p-3 text-xs">
            <div className="text-gray-500 uppercase font-bold">Slots de orientação</div>
            <div className="text-neon-yellow text-lg font-black">{slotLimit}</div>
          </div>
          <div className="bg-black/40 border border-white/10 rounded p-3 text-xs">
            <div className="text-gray-500 uppercase font-bold">EXP disponível</div>
            <div className="text-white text-lg font-black">{Math.round(finance.ole)}</div>
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
                  {cost ? `Evoluir (${cost.currency.toUpperCase()} ${cost.currency === 'bro' ? (cost.amount / 100).toFixed(2) : cost.amount})` : 'Nível máximo'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sports-panel p-5 space-y-4">
        <h3 className="font-display font-black uppercase tracking-wider flex items-center gap-2"><UserCog className="w-4 h-4" /> Orientação por jogador</h3>
        <select
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          className="w-full bg-black/40 border border-white/15 rounded px-3 py-2 text-sm"
        >
          <option value="">Selecione um jogador</option>
          {roster.map((p) => (
            <option key={p.id} value={p.id}>{p.num} · {p.name} ({p.pos})</option>
          ))}
        </select>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {STAFF_ROLE_IDS.map((id) => {
            const selected = playerId ? (manager.staff.assignedByPlayer[playerId] ?? []).includes(id) : false;
            return (
              <button
                key={id}
                disabled={!playerId}
                onClick={() => togglePlayerRole(id)}
                className={selected ? 'bg-neon-yellow text-black py-2 rounded text-xs font-bold' : 'bg-white/5 border border-white/10 py-2 rounded text-xs font-bold disabled:opacity-40'}
              >
                {STAFF_LABELS[id]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sports-panel p-5 space-y-4">
        <h3 className="font-display font-black uppercase tracking-wider flex items-center gap-2"><Users className="w-4 h-4" /> Orientação coletiva</h3>
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
