import { useEffect, useState } from 'react';
import { FileClock, RefreshCw, ShieldCheck } from 'lucide-react';
import { fetchAuditLog, type AuditLogRow } from '@/supabase/adminCore';
import {
  adminListVerifications,
  adminSetVerification,
  type AdminVerificationRow,
  type VerificationStatus,
} from '@/supabase/verification';
import { cn } from '@/lib/utils';

const TABLES = ['', 'market_purchases', 'wallet_credits', 'genesis_market_players', 'matches'] as const;

type AuditTab = 'log' | 'verifications';

export function AdminAuditLogPanel() {
  const [tab, setTab] = useState<AuditTab>('log');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5 border-b border-white/10 pb-3">
        {([
          { id: 'log', label: 'Log', icon: FileClock },
          { id: 'verifications', label: 'Verificações', icon: ShieldCheck },
        ] as const).map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setTab(s.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider transition-colors',
                tab === s.id
                  ? 'bg-cyan-500/15 text-cyan-300'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>
      {tab === 'log' ? <AuditLogSection /> : null}
      {tab === 'verifications' ? <VerificationsSection /> : null}
    </div>
  );
}

function AuditLogSection() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState<string>('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await fetchAuditLog({ limit: 200, table: table || undefined });
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <FileClock className="h-5 w-5 text-cyan-400" />
        <div className="flex-1">
          <h2 className="text-lg font-black text-white">Auditoria</h2>
          <p className="text-[11px] text-gray-400">
            Últimas 200 operações sensíveis (compras, saldos, catálogo, partidas). Lido via RPC <code className="text-cyan-300">admin_read_audit_log</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase text-white hover:bg-white/10"
        >
          <RefreshCw className="h-3 w-3" />
          Atualizar
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABLES.map((t) => (
          <button
            key={t || 'all'}
            type="button"
            onClick={() => setTable(t)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors',
              table === t ? 'bg-cyan-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10',
            )}
          >
            {t || 'Todas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500">Carregando auditoria…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] py-12 text-center text-sm text-gray-500">
          Nenhum registo.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-500">
                <th className="py-2 pl-3 pr-2">Quando</th>
                <th className="px-2 py-2">Tabela</th>
                <th className="px-2 py-2">Op</th>
                <th className="px-2 py-2">Row</th>
                <th className="px-2 py-2">User</th>
                <th className="px-2 py-2">Diff</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const when = new Date(r.occurred_at).toLocaleString('pt-BR');
                const op = r.operation;
                return (
                  <>
                    <tr
                      key={r.id}
                      className="cursor-pointer border-b border-white/5 hover:bg-white/[0.02]"
                      onClick={() => setExpanded((cur) => (cur === r.id ? null : r.id))}
                    >
                      <td className="py-2 pl-3 pr-2 font-mono text-[10px] text-gray-400">{when}</td>
                      <td className="px-2 py-2 text-[11px] text-white">{r.table_name}</td>
                      <td className="px-2 py-2">
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
                            op === 'INSERT' && 'bg-green-500/15 text-green-400',
                            op === 'UPDATE' && 'bg-yellow-500/15 text-yellow-300',
                            op === 'DELETE' && 'bg-red-500/15 text-red-400',
                          )}
                        >
                          {op}
                        </span>
                      </td>
                      <td className="px-2 py-2 font-mono text-[10px] text-gray-400">{r.row_id}</td>
                      <td className="px-2 py-2 font-mono text-[10px] text-gray-500">
                        {r.user_id ? r.user_id.slice(0, 8) + '…' : '—'}
                      </td>
                      <td className="px-2 py-2 text-[10px] text-cyan-300">
                        {expanded === r.id ? '▾ expandido' : '▸ ver'}
                      </td>
                    </tr>
                    {expanded === r.id ? (
                      <tr key={`${r.id}-d`} className="border-b border-white/5 bg-black/40">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="mb-1 text-[9px] font-bold uppercase text-red-300/70">Antes</p>
                              <pre className="max-h-64 overflow-auto rounded bg-black/60 p-2 text-[10px] text-red-200">
                                {r.old_data ? JSON.stringify(r.old_data, null, 2) : '—'}
                              </pre>
                            </div>
                            <div>
                              <p className="mb-1 text-[9px] font-bold uppercase text-green-300/70">Depois</p>
                              <pre className="max-h-64 overflow-auto rounded bg-black/60 p-2 text-[10px] text-green-200">
                                {r.new_data ? JSON.stringify(r.new_data, null, 2) : '—'}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VerificationsSection() {
  const [status, setStatus] = useState<VerificationStatus>('pending');
  const [rows, setRows] = useState<AdminVerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const r = await adminListVerifications(status);
    setRows(r);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const decide = async (userId: string, approved: boolean) => {
    let reason: string | undefined;
    if (!approved) {
      const r = window.prompt('Motivo da rejeição:');
      if (r == null) return;
      reason = r.trim() || undefined;
    }
    setBusyId(userId);
    const res = await adminSetVerification(userId, approved, reason);
    setBusyId(null);
    if (!res.ok) {
      window.alert(res.error ?? 'Falha ao atualizar.');
      return;
    }
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">Verificações</h2>
          <p className="text-[11px] text-gray-400">
            Solicitações de verificação enviadas pelos managers. Aprovar libera o PRO (saque de vendas).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase text-white hover:bg-white/10"
        >
          <RefreshCw className="h-3 w-3" />
          Atualizar
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {([
          { id: 'pending' as const, label: 'Pendentes' },
          { id: 'approved' as const, label: 'Aprovadas' },
          { id: 'rejected' as const, label: 'Rejeitadas' },
        ]).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStatus(s.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors',
              status === s.id ? 'bg-cyan-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500">Carregando verificações…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] py-12 text-center text-sm text-gray-500">
          Nenhuma solicitação.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const addr = r.verification_data?.address;
            const bd = r.verification_data?.birthDate ?? '—';
            return (
              <li key={r.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-bold text-white">
                      {r.display_name ?? '(sem nome)'}{' '}
                      <span className="text-[10px] text-gray-500">· {r.club_name ?? '—'}</span>
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-gray-500">{r.id.slice(0, 12)}…</p>
                    {r.verification_submitted_at ? (
                      <p className="text-[10px] text-gray-500">
                        Enviado: {new Date(r.verification_submitted_at).toLocaleString('pt-BR')}
                      </p>
                    ) : null}
                    {r.verification_reviewed_at ? (
                      <p className="text-[10px] text-gray-500">
                        Revisado: {new Date(r.verification_reviewed_at).toLocaleString('pt-BR')}
                      </p>
                    ) : null}
                  </div>
                  {status === 'pending' ? (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void decide(r.id, true)}
                        className="rounded bg-neon-green px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-wider text-black hover:bg-white disabled:opacity-40"
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void decide(r.id, false)}
                        className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider text-rose-200 hover:bg-rose-500/20 disabled:opacity-40"
                      >
                        Rejeitar
                      </button>
                    </div>
                  ) : status === 'rejected' && r.verification_rejection_reason ? (
                    <span className="shrink-0 rounded bg-rose-500/15 px-2 py-1 text-[10px] text-rose-200">
                      {r.verification_rejection_reason}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded border border-white/10 bg-black/40 p-2 text-[11px]">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Nascimento</p>
                    <p className="text-white">{bd}</p>
                  </div>
                  <div className="rounded border border-white/10 bg-black/40 p-2 text-[11px]">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
                      Endereço {addr?.international ? '(internacional)' : ''}
                    </p>
                    {addr ? (
                      <p className="text-white/90 leading-snug">
                        {addr.street}, {addr.number}
                        {addr.complement ? ` · ${addr.complement}` : ''}
                        <br />
                        {addr.city}
                        {addr.state ? ` — ${addr.state}` : ''} · {addr.country}
                        <br />
                        <span className="text-gray-500">{addr.zip || '—'}</span>
                      </p>
                    ) : (
                      <p className="text-gray-500">—</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
