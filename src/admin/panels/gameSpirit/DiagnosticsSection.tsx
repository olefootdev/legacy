import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Server, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  clientGeminiConfigured,
  GAME_SPIRIT_WIRING_TABLE,
  olefootApiBase,
  statusLabelPt,
  type WiringStatus,
} from '@/gamespirit/admin/runtimeTruth';
import { fetchGameSpiritServerStatus } from '@/gamespirit/admin/gameSpiritTeachClient';

function statusColor(s: WiringStatus): string {
  switch (s) {
    case 'motor':
    case 'motor_roteiro':
      return 'border-emerald-500/45 bg-emerald-500/10 text-emerald-100';
    case 'codigo_sem_ui':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-100';
    case 'local_admin':
      return 'border-sky-500/40 bg-sky-500/10 text-sky-100';
    case 'nao_integrado':
    default:
      return 'border-white/15 bg-white/5 text-white/50';
  }
}

export function DiagnosticsSection() {
  const [server, setServer] = useState<Awaited<ReturnType<typeof fetchGameSpiritServerStatus>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchGameSpiritServerStatus().then((r) => {
      if (!cancelled) setServer(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const gemini = clientGeminiConfigured();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/95">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
          <div>
            <p className="font-bold text-white">Transparência</p>
            <p className="mt-1 text-white/80">
              A tabela abaixo diz o que o <strong className="text-white">código que está no Git</strong> faz. A
              biblioteca que gravas neste browser <strong className="text-white">não entra no motor</strong> até
              alguém implementar ingestão (ler localStorage ou JSON no build). Isto evita falarmos de um GameSpirit
              &quot;inteligente&quot; que na realidade só existe como texto estático.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
          <p className="text-[10px] font-bold uppercase text-white/40">Gemini (Create player)</p>
          <div className="mt-2 flex items-center gap-2">
            {gemini ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-400" />
            )}
            <span>{gemini ? 'GEMINI_API_KEY definida (Vite)' : 'Sem chave no .env do Vite'}</span>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
          <p className="text-[10px] font-bold uppercase text-white/40">Servidor OLEFOOT</p>
          <div className="mt-2 flex items-center gap-2">
            <Server className="h-5 w-5 text-white/35" />
            <code className="text-xs text-cyan-300/90">{olefootApiBase()}</code>
          </div>
          {server?.reachable ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-300/90">
              <CheckCircle2 className="h-3.5 w-3.5" /> A responder
              {server.openaiConfigured ? ' · OpenAI configurada' : ' · OpenAI não configurada no server'}
            </p>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-200/90">
              <XCircle className="h-3.5 w-3.5" /> Não alcançável
              {server?.error ? ` — ${server.error}` : ''}. Corre{' '}
              <code className="rounded bg-white/10 px-1">npm run dev:server</code> na raiz.
            </p>
          )}
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
          <p className="text-[10px] font-bold uppercase text-white/40">Docling</p>
          <div className="mt-2 flex items-center gap-2">
            <Activity className="h-5 w-5 text-white/25" />
            <span className="text-white/55">Não integrado no projeto</span>
          </div>
          <p className="mt-1 text-[11px] text-white/40">Importa .txt/.md ou cola texto processado externamente.</p>
        </div>
      </div>

      <div className="ole-scroll-x rounded-xl border border-white/10">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="border-b border-white/10 bg-white/[0.04] text-[10px] font-bold uppercase tracking-wider text-white/45">
            <tr>
              <th className="px-3 py-2">Componente</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Facto</th>
            </tr>
          </thead>
          <tbody>
            {GAME_SPIRIT_WIRING_TABLE.map((row) => (
              <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-3 py-2.5 font-bold text-white/90">{row.nome}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      'inline-block rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase',
                      statusColor(row.status),
                    )}
                  >
                    {statusLabelPt(row.status)}
                  </span>
                </td>
                <td className="max-w-xl px-3 py-2.5 text-white/55">{row.fact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
