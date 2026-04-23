import { useEffect, useState } from 'react';
import { FileClock, RefreshCw } from 'lucide-react';
import { fetchAuditLog, type AuditLogRow } from '@/supabase/adminCore';
import { cn } from '@/lib/utils';

const TABLES = ['', 'market_purchases', 'wallet_credits', 'genesis_market_players', 'matches'] as const;

export function AdminAuditLogPanel() {
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
