import { useEffect, useState } from 'react';
import { Flag, Sliders, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  usePlatformConfig,
  saveFeatureFlags,
  savePlatformLimits,
  savePlatformPrices,
  type FeatureFlags,
  type PlatformLimits,
  type PlatformPrices,
} from '@/admin/platformConfigStore';

export function AdminPlatformConfigPanel() {
  const { flags, limits, prices, loaded } = usePlatformConfig();
  const [fDraft, setFDraft] = useState<FeatureFlags>(flags);
  const [lDraft, setLDraft] = useState<PlatformLimits>(limits);
  const [pDraft, setPDraft] = useState<PlatformPrices>(prices);
  const [saving, setSaving] = useState<'flags' | 'limits' | 'prices' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { if (loaded) setFDraft(flags); }, [loaded, flags]);
  useEffect(() => { if (loaded) setLDraft(limits); }, [loaded, limits]);
  useEffect(() => { if (loaded) setPDraft(prices); }, [loaded, prices]);

  const doSave = async (kind: 'flags' | 'limits' | 'prices') => {
    setSaving(kind);
    setMsg(null);
    const ok =
      kind === 'flags' ? await saveFeatureFlags(fDraft) :
      kind === 'limits' ? await savePlatformLimits(lDraft) :
      await savePlatformPrices(pDraft);
    setSaving(null);
    setMsg(ok ? 'Guardado.' : 'Falha ao salvar (ver console).');
    window.setTimeout(() => setMsg(null), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Flag className="h-5 w-5 text-fuchsia-400" />
        <div className="flex-1">
          <h2 className="text-lg font-black text-white">Configuração global</h2>
          <p className="text-[11px] text-gray-400">
            Feature flags, limites e preços. Persistidos em <code className="text-fuchsia-300">platform_config</code>. Lidos no boot e cacheados em memória.
          </p>
        </div>
        {msg ? <span className="text-[10px] text-fuchsia-300">{msg}</span> : null}
      </div>

      {/* Flags */}
      <section className="rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/[0.04] p-4">
        <header className="mb-3 flex items-center gap-2">
          <Flag className="h-4 w-4 text-fuchsia-400" />
          <h3 className="text-sm font-bold text-white">Feature flags</h3>
        </header>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(fDraft) as (keyof FeatureFlags)[]).map((k) => (
            <label key={k} className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs">
              <span className="font-mono text-white">{k}</span>
              <button
                type="button"
                onClick={() => setFDraft({ ...fDraft, [k]: !fDraft[k] })}
                className={cn(
                  'rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  fDraft[k] ? 'bg-green-500/20 text-green-300' : 'bg-white/5 text-gray-500',
                )}
              >
                {fDraft[k] ? 'ligado' : 'desligado'}
              </button>
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => doSave('flags')}
          disabled={saving === 'flags'}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-fuchsia-500 px-3 py-1.5 text-[10px] font-bold uppercase text-black hover:bg-fuchsia-400 disabled:opacity-50"
        >
          <Save className="h-3 w-3" />
          {saving === 'flags' ? 'Guardando…' : 'Guardar flags'}
        </button>
      </section>

      {/* Limits */}
      <section className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
        <header className="mb-3 flex items-center gap-2">
          <Sliders className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Limites</h3>
        </header>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(lDraft) as (keyof PlatformLimits)[]).map((k) => (
            <label key={k} className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase text-white/50">{k}</span>
              <input
                type="number"
                value={lDraft[k]}
                onChange={(e) => setLDraft({ ...lDraft, [k]: Number(e.target.value) || 0 })}
                className="w-full rounded-lg border border-white/15 bg-black/50 px-2.5 py-1.5 text-sm font-mono text-white"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => doSave('limits')}
          disabled={saving === 'limits'}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-[10px] font-bold uppercase text-black hover:bg-amber-400 disabled:opacity-50"
        >
          <Save className="h-3 w-3" />
          {saving === 'limits' ? 'Guardando…' : 'Guardar limites'}
        </button>
      </section>

      {/* Prices */}
      <section className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-4">
        <header className="mb-3 flex items-center gap-2">
          <Sliders className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Preços base</h3>
        </header>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(pDraft) as (keyof PlatformPrices)[]).map((k) => (
            <label key={k} className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase text-white/50">{k}</span>
              <input
                type="number"
                value={pDraft[k]}
                onChange={(e) => setPDraft({ ...pDraft, [k]: Number(e.target.value) || 0 })}
                className="w-full rounded-lg border border-white/15 bg-black/50 px-2.5 py-1.5 text-sm font-mono text-white"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => doSave('prices')}
          disabled={saving === 'prices'}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-[10px] font-bold uppercase text-black hover:bg-emerald-400 disabled:opacity-50"
        >
          <Save className="h-3 w-3" />
          {saving === 'prices' ? 'Guardando…' : 'Guardar preços'}
        </button>
      </section>
    </div>
  );
}
