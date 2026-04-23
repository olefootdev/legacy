import { useEffect, useState } from 'react';
import { Megaphone, Send, Trash2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  sendAdminBroadcast,
  fetchBroadcastStats,
  deactivateBroadcast,
  type AdminBroadcastStatsRow,
} from '@/supabase/adminBroadcasts';

const CATEGORIES = [
  'CONTA',
  'PLANTEL',
  'FINANCEIRO',
  'COMPETIÇÃO',
  'MISSÃO',
  'CLUBE',
  'TORCIDA',
  'EMPRESA',
] as const;

export function AdminBroadcastPanel() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('CONTA');
  const [deepLink, setDeepLink] = useState('');
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<AdminBroadcastStatsRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const data = await fetchBroadcastStats(50);
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      setSentMsg('Título e corpo são obrigatórios.');
      return;
    }
    if (!window.confirm(`Enviar mensagem a TODOS os managers?\n\n"${title.trim()}"`)) return;
    setSending(true);
    setSentMsg(null);
    const out = await sendAdminBroadcast({
      title: title.trim(),
      body: body.trim(),
      category,
      deepLink: deepLink.trim() || null,
    });
    setSending(false);
    if (out) {
      setTitle('');
      setBody('');
      setDeepLink('');
      setSentMsg('Enviado. Managers recebem na próxima entrada no jogo.');
      void refresh();
      window.setTimeout(() => setSentMsg(null), 3500);
    } else {
      setSentMsg('Falha ao enviar (ver console).');
    }
  };

  const deactivate = async (id: string, title: string) => {
    if (!window.confirm(`Desativar broadcast "${title}"? Managers que ainda não receberam não vão receber mais.`)) return;
    const ok = await deactivateBroadcast(id);
    if (ok) void refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Megaphone className="h-5 w-5 text-orange-400" />
        <div className="flex-1">
          <h2 className="text-lg font-black text-white">Broadcast</h2>
          <p className="text-[11px] text-gray-400">
            Envia uma mensagem a todos os managers. Aparece no inbox deles na próxima entrada (entrega única por manager).
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase text-white hover:bg-white/10"
        >
          <RefreshCw className="h-3 w-3" />
          Atualizar
        </button>
      </div>

      {/* Compositor */}
      <section className="rounded-2xl border border-orange-500/30 bg-orange-500/[0.04] p-4">
        <h3 className="mb-3 text-sm font-bold text-white">Nova mensagem</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/40">Título</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Manutenção programada"
              maxLength={120}
              className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/30"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/40">Categoria</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
              className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/40">Corpo</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Texto completo da mensagem…"
            maxLength={2000}
            className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/30"
          />
          <span className="mt-0.5 block text-[9px] text-white/40">{body.length}/2000</span>
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/40">Deep link (opcional)</span>
          <input
            value={deepLink}
            onChange={(e) => setDeepLink(e.target.value)}
            placeholder="/transfer"
            className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm font-mono text-white placeholder:text-white/30"
          />
          <span className="mt-0.5 block text-[9px] text-white/40">Ex.: /how-to-play, /transfer, /team</span>
        </label>

        <div className="mt-4 flex items-center justify-between gap-3">
          {sentMsg ? (
            <span className={cn('text-[11px]', sentMsg.startsWith('Enviado') ? 'text-green-300' : 'text-red-300')}>
              {sentMsg}
            </span>
          ) : <span />}
          <button
            type="button"
            onClick={send}
            disabled={sending || !title.trim() || !body.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-xs font-black uppercase text-black hover:bg-orange-400 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? 'Enviando…' : 'Enviar a todos'}
          </button>
        </div>
      </section>

      {/* Histórico */}
      <section>
        <h3 className="mb-3 text-sm font-bold text-white">Enviadas</h3>
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Carregando…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] py-10 text-center text-sm text-gray-500">
            Nenhum broadcast enviado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="py-2 pl-3 pr-2">Quando</th>
                  <th className="px-2 py-2">Título</th>
                  <th className="px-2 py-2">Categoria</th>
                  <th className="px-2 py-2 text-center">Entregues</th>
                  <th className="px-2 py-2 text-center">Ativo</th>
                  <th className="py-2 pr-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2 pl-3 pr-2 font-mono text-[10px] text-gray-400">
                      {new Date(r.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-2 py-2 text-white">{r.title}</td>
                    <td className="px-2 py-2">
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/70">
                        {r.category}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center font-mono text-[11px] text-orange-300">
                      {r.deliveries.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase',
                          r.active ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-gray-500',
                        )}
                      >
                        {r.active ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {r.active ? (
                        <button
                          type="button"
                          onClick={() => deactivate(r.id, r.title)}
                          title="Desativar — managers que ainda não receberam não receberão."
                          className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1 text-[10px] font-bold uppercase text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-3 w-3" />
                          Desativar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
