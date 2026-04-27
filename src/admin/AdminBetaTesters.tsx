/**
 * AdminBetaTesters — painel admin para gerir a waitlist de beta testers.
 * Lista pendentes/aprovados/ativos, convida por email, aprova/revoga.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Mail, Plus, ShieldX } from 'lucide-react';
import {
  adminApproveBetaTester,
  adminInviteBetaTester,
  adminListBetaTesters,
  adminRevokeBetaAccess,
  type BetaStatus,
  type BetaTesterRow,
} from '@/supabase/betaTesters';
import { cn } from '@/lib/utils';

const STATUS_TABS: { value: BetaStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'approved', label: 'Aprovados' },
  { value: 'active', label: 'Ativos' },
  { value: 'revoked', label: 'Revogados' },
];

export function AdminBetaTesters() {
  const [rows, setRows] = useState<BetaTesterRow[]>([]);
  const [filter, setFilter] = useState<BetaStatus | 'all'>('pending');
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await adminListBetaTesters(filter === 'all' ? undefined : filter);
    setRows(data);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    reload();
  }, [reload]);

  const onApprove = async (id: string) => {
    await adminApproveBetaTester(id);
    reload();
  };

  const onRevoke = async (id: string) => {
    if (!confirm('Revogar acesso deste tester?')) return;
    await adminRevokeBetaAccess(id);
    reload();
  };

  const onInvite = async () => {
    const email = inviteEmail.trim();
    if (!email || inviting) return;
    setInviting(true);
    const result = await adminInviteBetaTester(email);
    setInviting(false);
    if (result) {
      setInviteEmail('');
      reload();
    }
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 bg-black/80 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Link to="/admin" className="text-gray-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-lg font-black uppercase tracking-wider">
            Beta Testers
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        {/* Convite direto */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 font-display text-xs font-black uppercase tracking-wider text-neon-yellow">
            Convidar por email
          </h2>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@dominio.com"
              className="flex-1 rounded border border-white/10 bg-black/50 px-3 py-2 text-sm placeholder:text-gray-600 focus:border-neon-yellow/60 outline-none"
            />
            <button
              type="button"
              onClick={onInvite}
              disabled={!inviteEmail.trim() || inviting}
              className="flex items-center gap-2 rounded bg-neon-yellow px-4 py-2 text-sm font-bold text-black hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Convidar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setFilter(t.value)}
              className={cn(
                'border-b-2 px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors',
                filter === t.value
                  ? 'border-neon-yellow text-neon-yellow'
                  : 'border-transparent text-gray-400 hover:text-white',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="rounded-lg border border-white/10 bg-white/5">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Nenhum tester.</div>
          ) : (
            <ul className="divide-y divide-white/5">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <Mail className="h-4 w-4 shrink-0 text-gray-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{r.email}</p>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">
                      {r.status} · {new Date(r.created_at).toLocaleDateString('pt-PT')}
                      {r.source ? ` · ${r.source}` : ''}
                    </p>
                  </div>
                  {r.invite_code && (
                    <button
                      type="button"
                      onClick={() => copyCode(r.invite_code!)}
                      className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-xs font-mono hover:border-neon-yellow/40"
                      title="Copiar invite code"
                    >
                      <Copy className="h-3 w-3" />
                      {copiedCode === r.invite_code ? 'Copiado' : r.invite_code}
                    </button>
                  )}
                  {r.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => onApprove(r.id)}
                      className="flex items-center gap-1 rounded bg-neon-green/20 px-2 py-1 text-xs font-bold text-neon-green hover:bg-neon-green/30"
                    >
                      <Check className="h-3 w-3" />
                      Aprovar
                    </button>
                  )}
                  {r.status !== 'revoked' && (
                    <button
                      type="button"
                      onClick={() => onRevoke(r.id)}
                      className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-xs font-bold text-red-400 hover:bg-red-500/30"
                    >
                      <ShieldX className="h-3 w-3" />
                      Revogar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
