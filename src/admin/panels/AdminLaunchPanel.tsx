import { useEffect, useState } from 'react';
import { Rocket, Users, Gift, RefreshCw } from 'lucide-react';
import { fetchLaunchCounters, type LaunchCountersRow } from '@/supabase/adminCore';
import { usePlatformConfig, savePlatformLimits } from '@/admin/platformConfigStore';

export function AdminLaunchPanel() {
  const { limits, loaded } = usePlatformConfig();
  const [counters, setCounters] = useState<LaunchCountersRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftLimit, setDraftLimit] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const row = await fetchLaunchCounters();
    setCounters(row);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    const t = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (loaded) setDraftLimit(String(limits.WELCOME_PACK_LIMIT));
  }, [loaded, limits.WELCOME_PACK_LIMIT]);

  const saveLimit = async () => {
    const n = Math.max(1, Math.floor(Number(draftLimit) || 0));
    if (!Number.isFinite(n)) return;
    setSaving(true);
    setErr(null);
    const ok = await savePlatformLimits({ ...limits, WELCOME_PACK_LIMIT: n });
    setSaving(false);
    if (!ok) setErr('Falha ao salvar limite.');
  };

  const totalManagers = counters?.total_managers ?? 0;
  const claimed = counters?.welcome_packs_claimed ?? 0;
  const dbLimit = counters?.welcome_packs_limit ?? limits.WELCOME_PACK_LIMIT;
  const remaining = Math.max(0, dbLimit - claimed);
  const pct = dbLimit > 0 ? Math.min(100, (claimed / dbLimit) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Rocket className="h-5 w-5 text-neon-green" />
        <div className="flex-1">
          <h2 className="text-lg font-black text-white">Lançamento</h2>
          <p className="text-[11px] text-gray-400">
            Contadores globais: managers registados e welcome packs reivindicados. Atualiza a cada 30s.
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-4">
          <div className="flex items-center gap-2 text-blue-300">
            <Users className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Managers</span>
          </div>
          <p className="mt-2 text-2xl font-black text-white">{loading ? '—' : totalManagers.toLocaleString('pt-BR')}</p>
        </div>
        <div className="rounded-xl border border-neon-yellow/30 bg-neon-yellow/[0.05] p-4">
          <div className="flex items-center gap-2 text-neon-yellow">
            <Gift className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Welcome Packs</span>
          </div>
          <p className="mt-2 text-2xl font-black text-white">
            {loading ? '—' : `${claimed.toLocaleString('pt-BR')} / ${dbLimit.toLocaleString('pt-BR')}`}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-neon-yellow transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="rounded-xl border border-green-500/20 bg-green-500/[0.05] p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-green-300">Restantes</span>
          <p className="mt-2 text-2xl font-black text-white">{loading ? '—' : remaining.toLocaleString('pt-BR')}</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-xs font-bold text-white">Limite de welcome packs</p>
        <p className="mt-1 text-[11px] text-gray-400">
          Este valor é usado pela RPC <code className="text-neon-yellow">claim_welcome_pack</code> como teto. Alterar aqui só altera <code>platform_config.limits.WELCOME_PACK_LIMIT</code>;
          para trocar o teto real do contador, também precisa atualizar <code>launch_counters.welcome_packs_limit</code>.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            value={draftLimit}
            onChange={(e) => setDraftLimit(e.target.value)}
            className="w-32 rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-sm font-mono text-white"
          />
          <button
            type="button"
            onClick={saveLimit}
            disabled={saving}
            className="rounded-lg bg-neon-yellow px-3 py-1.5 text-[10px] font-bold uppercase text-black hover:bg-white disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          {err ? <span className="text-[10px] text-red-400">{err}</span> : null}
        </div>
      </div>
    </div>
  );
}
