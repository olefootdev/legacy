import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, UserCog, Users } from 'lucide-react';
import { useGameDispatch, useGameStore } from '@/game/store';
import { getStaffUpgradeCost, maxStaffSlotsByLevel, STAFF_LABELS, STAFF_ROLE_IDS } from '@/systems/staff';
import type { StaffRoleId } from '@/game/types';

const COLLECTIVE_GROUPS = ['defensivo', 'criativo', 'ataque'] as const;

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-black uppercase tracking-wider min-[390px]:text-3xl">Meu Time / Staff</h2>
          <p className="mt-1 text-xs text-gray-400">
            Profissionais contratados, evolução e slots de orientação por jogador e coletivo.
          </p>
        </div>
        <Link
          to="/team"
          className="flex shrink-0 items-center gap-2 self-start rounded bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20 sm:self-auto"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </Link>
      </div>

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
                <div className="text-[11px] text-gray-500 mt-2">
                  Impacto cresce com o nível; nível 1-3 via EXP, nível 4-5 via BRO.
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
        <div className="flex gap-2">
          {COLLECTIVE_GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={group === g ? 'bg-neon-yellow text-black px-4 py-2 rounded text-xs font-bold uppercase' : 'bg-white/5 border border-white/10 px-4 py-2 rounded text-xs font-bold uppercase'}
            >
              {g}
            </button>
          ))}
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
