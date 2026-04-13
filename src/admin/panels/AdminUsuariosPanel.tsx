import { useMemo, useState } from 'react';
import {
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getGameState } from '@/game/store';
import { formatBroFromCents, formatExp } from '@/systems/economy';
import type { AdminPlatformUser, AdminPlatformUserStatus } from '@/admin/platformTypes';
import {
  dispatchAdminPlatform,
  useAdminPlatformDispatch,
  useAdminPlatformStore,
} from '@/admin/platformStore';

function newUserTemplate(): AdminPlatformUser {
  const now = new Date().toISOString();
  return {
    id: `usr_${Date.now().toString(36)}`,
    displayName: 'Novo manager',
    clubName: 'Clube Novo',
    clubShort: 'NEW',
    broCents: 0,
    spotBroCents: 0,
    spotExpBalance: 0,
    ole: 0,
    olexpPrincipalLockedCents: 0,
    olexpYieldAccruedCents: 0,
    gatPositionsCount: 0,
    ledgerEntriesCount: 0,
    createdAtIso: now,
    updatedAtIso: now,
    status: 'active',
  };
}

export function AdminUsuariosPanel() {
  const platform = useAdminPlatformStore((s) => s);
  const dispatch = useAdminPlatformDispatch();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<AdminPlatformUser>>({});

  const sorted = useMemo(
    () => [...platform.users].sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso)),
    [platform.users],
  );

  const startEdit = (u: AdminPlatformUser) => {
    setEditingId(u.id);
    setDraft({ ...u });
  };

  const saveEdit = () => {
    if (!editingId) return;
    dispatch({
      type: 'UPDATE_USER',
      id: editingId,
      patch: {
        displayName: draft.displayName?.trim(),
        email: draft.email?.trim() || undefined,
        country: draft.country?.trim() || undefined,
        clubName: draft.clubName?.trim(),
        clubShort: draft.clubShort?.trim().slice(0, 8).toUpperCase(),
        broCents: Math.max(0, Math.round(Number(draft.broCents) || 0)),
        spotBroCents: Math.max(0, Math.round(Number(draft.spotBroCents) || 0)),
        spotExpBalance: Math.max(0, Math.round(Number(draft.spotExpBalance) || 0)),
        ole: Math.max(0, Math.round(Number(draft.ole) || 0)),
        olexpPrincipalLockedCents: Math.max(0, Math.round(Number(draft.olexpPrincipalLockedCents) || 0)),
        olexpYieldAccruedCents: Math.max(0, Math.round(Number(draft.olexpYieldAccruedCents) || 0)),
        gatPositionsCount: Math.max(0, Math.round(Number(draft.gatPositionsCount) || 0)),
        ledgerEntriesCount: Math.max(0, Math.round(Number(draft.ledgerEntriesCount) || 0)),
        status: draft.status,
        notes: draft.notes?.trim() || undefined,
        externalId: draft.externalId?.trim() || undefined,
      },
    });
    setEditingId(null);
    setDraft({});
  };

  const importSession = () => {
    dispatch({ type: 'IMPORT_SESSION_USER', game: getGameState() });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-2">
          <p className="text-sm text-white/55">
            Lista de <strong className="text-white/85">contas da plataforma</strong> (MVP: dados no armazenamento{' '}
            <code className="text-neon-yellow/80">olefoot-admin-platform-v1</code>, independente do save do jogo).
            Isto simula o que um back-office veria com API multi-tenant.
          </p>
          <p className="text-xs text-white/35">
            O separador <strong className="text-white/50">Sessão local</strong> continua a mexer só no teu save único
            deste browser.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={importSession}
            className="flex items-center gap-2 rounded-lg bg-neon-yellow px-3 py-2 text-xs font-black uppercase text-black hover:bg-white"
          >
            <Download className="h-4 w-4" />
            Importar sessão atual
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'ADD_USER', user: newUserTemplate() })}
            className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-bold uppercase text-white hover:bg-white/10"
          >
            <Plus className="h-4 w-4" />
            Novo utilizador
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Repor lista demo + tesouraria padrão?')) {
                dispatch({ type: 'RESET_SEED' });
              }
            }}
            className="flex items-center gap-2 rounded-lg border border-amber-500/40 px-3 py-2 text-xs font-bold uppercase text-amber-200 hover:bg-amber-500/10"
          >
            <RefreshCw className="h-4 w-4" />
            Repor demo
          </button>
        </div>
      </div>

      <div className="ole-scroll-x rounded-xl border border-white/10">
        <table className="w-full min-w-[960px] text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40">
              <th className="px-3 py-2">Utilizador / Clube</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">BRO</th>
              <th className="px-3 py-2">SPOT</th>
              <th className="px-3 py-2">EXP</th>
              <th className="px-3 py-2">OLEXP trancado</th>
              <th className="px-3 py-2">Atualizado</th>
              <th className="px-3 py-2 w-28">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((u) => (
              <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 shrink-0 text-white/30" />
                    <div>
                      <div className="font-bold text-white">{u.displayName}</div>
                      <div className="text-[10px] text-white/45">
                        {u.clubName} ({u.clubShort}) · <span className="font-mono text-white/30">{u.id}</span>
                      </div>
                      {u.email ? <div className="text-[10px] text-white/35">{u.email}</div> : null}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-[10px] font-bold uppercase',
                      u.status === 'active' ? 'bg-neon-green/15 text-neon-green' : 'bg-red-500/15 text-red-300',
                    )}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-neon-yellow">{formatBroFromCents(u.broCents)}</td>
                <td className="px-3 py-2 font-mono text-white/80">{formatBroFromCents(u.spotBroCents)}</td>
                <td className="px-3 py-2 font-mono">{formatExp(u.ole)}</td>
                <td className="px-3 py-2 font-mono text-violet-300">{formatBroFromCents(u.olexpPrincipalLockedCents)}</td>
                <td className="px-3 py-2 text-[10px] text-white/40 whitespace-nowrap">
                  {new Date(u.updatedAtIso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(u)}
                      className="rounded border border-white/15 p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Remover ${u.displayName}?`)) {
                          dispatch({ type: 'REMOVE_USER', id: u.id });
                        }
                      }}
                      className="rounded border border-red-500/30 p-1.5 text-red-400 hover:bg-red-500/10"
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <p className="p-8 text-center text-sm text-white/40">Sem utilizadores — importa a sessão ou adiciona manualmente.</p>
        )}
      </div>

      {editingId && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/80 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/15 bg-[#0a0a0a] p-5 shadow-2xl">
            <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-black text-white">
              <Users className="h-5 w-5 text-neon-yellow" />
              Editar utilizador
            </h3>
            <div className="grid gap-3 text-sm">
              {(
                [
                  ['displayName', 'Nome'],
                  ['email', 'Email'],
                  ['externalId', 'ID externo'],
                  ['country', 'País'],
                  ['clubName', 'Clube'],
                  ['clubShort', 'Sigla'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-[10px] font-bold uppercase text-white/40">
                  {label}
                  <input
                    value={String(draft[key] ?? '')}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                  />
                </label>
              ))}
              {(
                [
                  ['broCents', 'BRO (centavos)'],
                  ['spotBroCents', 'SPOT BRO (¢)'],
                  ['spotExpBalance', 'SPOT EXP'],
                  ['ole', 'EXP ranking (ole)'],
                  ['olexpPrincipalLockedCents', 'OLEXP principal (¢)'],
                  ['olexpYieldAccruedCents', 'OLEXP yield acum. (¢)'],
                  ['gatPositionsCount', 'Posições GAT'],
                  ['ledgerEntriesCount', 'Linhas extrato (ref.)'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-[10px] font-bold uppercase text-white/40">
                  {label}
                  <input
                    type="number"
                    value={Number(draft[key] ?? 0)}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 font-mono text-sm text-white"
                  />
                </label>
              ))}
              <label className="block text-[10px] font-bold uppercase text-white/40">
                Estado
                <select
                  value={(draft.status as AdminPlatformUserStatus) ?? 'active'}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, status: e.target.value as AdminPlatformUserStatus }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                >
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                </select>
              </label>
              <label className="block text-[10px] font-bold uppercase text-white/40">
                Notas internas
                <textarea
                  value={draft.notes ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveEdit}
                className="rounded-lg bg-neon-yellow px-4 py-2 text-xs font-black uppercase text-black hover:bg-white"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setDraft({});
                }}
                className="rounded-lg border border-white/20 px-4 py-2 text-xs font-bold uppercase text-white/70 hover:bg-white/10"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
