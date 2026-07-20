/**
 * CONTRIBUIÇÕES DAS LENDAS — a caixa de entrada do que o atleta mandou.
 *
 * Correção, história em áudio e pedido de card caem todas aqui. Sem isto, o
 * botão no PLAYERVIP era uma caixa que ninguém abria — pior que não existir.
 *
 * Lê via /api/admin/legend-contributions (service role no servidor). O áudio
 * vem como signed URL de 1h: o bucket é privado e continua privado.
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Check, X, RotateCcw } from 'lucide-react';
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import { getSupabase } from '@/supabase/client';

type Status = 'pendente' | 'aceita' | 'recusada';
type Kind = 'correcao' | 'historia' | 'novo_card';

interface Row {
  id: number;
  kind: Kind;
  legacy_player_id: string | null;
  cardName: string | null;
  authorEmail: string | null;
  message: string | null;
  audioUrl: string | null;
  payload: Record<string, unknown>;
  status: Status;
  admin_note: string | null;
  created_at: string;
}

const KIND_LABEL: Record<Kind, string> = {
  correcao: 'Correção',
  historia: 'História',
  novo_card: 'Novo card',
};
const KIND_COLOR: Record<Kind, string> = {
  correcao: 'border-amber-400/50 text-amber-300',
  historia: 'border-sky-400/50 text-sky-300',
  novo_card: 'border-emerald-400/50 text-emerald-300',
};

async function authHeaders(json = false): Promise<Record<string, string>> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  try {
    const tok = localStorage.getItem('olefoot_global_league_admin_token')?.trim();
    if (tok) h['X-Admin-Token'] = tok;
  } catch { /* sem token manual */ }
  try {
    const sb = getSupabase();
    const access = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    if (access) h['Authorization'] = `Bearer ${access}`;
  } catch { /* sem sessão */ }
  return h;
}

export function AdminContributionsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Status | 'todas'>('pendente');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await fetch(`${olefootApiBase()}/api/admin/legend-contributions?status=${filter}`, {
        headers: await authHeaders(),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setRows(Array.isArray(body) ? body : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  async function review(id: number, status: Status) {
    setBusyId(id);
    try {
      const res = await fetch(`${olefootApiBase()}/api/admin/legend-contribution-review`, {
        method: 'POST',
        headers: await authHeaders(true),
        body: JSON.stringify({ id, status, adminNote: notes[id] }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? 'falhou');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['pendente', 'aceita', 'recusada', 'todas'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              filter === f ? 'border-neon-yellow/60 text-neon-yellow' : 'border-white/12 text-white/45 hover:border-white/30'
            }`}
          >
            {f}
          </button>
        ))}
        <button onClick={() => void load()} className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white/45 hover:border-white/30">
          <RotateCcw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>

      {err && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</p>}

      {loading ? (
        <div className="grid place-items-center py-16 text-white/40"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-white/40">
          Nada por aqui{filter !== 'todas' ? ` em "${filter}"` : ''}.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${KIND_COLOR[r.kind]}`}>
                  {KIND_LABEL[r.kind] ?? r.kind}
                </span>
                {r.cardName && <span className="text-xs font-bold text-white/70">{r.cardName}</span>}
                <span className="text-[11px] text-white/35">{r.authorEmail ?? r.legacy_player_id ?? '—'}</span>
                <span className="ml-auto text-[11px] text-white/30">
                  {new Date(r.created_at).toLocaleString('pt-BR')}
                </span>
                {r.status !== 'pendente' && (
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${r.status === 'aceita' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/40'}`}>
                    {r.status}
                  </span>
                )}
              </div>

              {r.message && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80">{r.message}</p>}

              {r.audioUrl && (
                <audio controls src={r.audioUrl} className="mt-3 h-9 w-full max-w-md" />
              )}

              {r.kind === 'novo_card' && (
                <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-white/55">
                  {(['ano', 'clube', 'pontoForte', 'precoSugerido'] as const).map((k) =>
                    r.payload?.[k] ? (
                      <span key={k}>
                        <dt className="inline text-white/35">{k === 'pontoForte' ? 'ponto forte' : k === 'precoSugerido' ? 'preço sugerido' : k}: </dt>
                        <dd className="inline font-semibold text-white/80">{String(r.payload[k])}</dd>
                      </span>
                    ) : null,
                  )}
                </dl>
              )}

              {r.admin_note && <p className="mt-2 text-[12px] italic text-white/40">Nota: {r.admin_note}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={notes[r.id] ?? ''}
                  onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                  placeholder="Nota interna (opcional)"
                  className="min-w-0 flex-1 rounded-lg border border-white/12 bg-black/40 px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/30"
                />
                <button
                  disabled={busyId === r.id}
                  onClick={() => void review(r.id, 'aceita')}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-400/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> Aceitar
                </button>
                <button
                  disabled={busyId === r.id}
                  onClick={() => void review(r.id, 'recusada')}
                  className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/50 hover:bg-white/5 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" /> Recusar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
