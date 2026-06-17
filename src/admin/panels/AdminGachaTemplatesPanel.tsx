import { useEffect, useMemo, useState } from 'react';
import { Dices, Check, Lock, Unlock, Save, RefreshCw } from 'lucide-react';
import {
  fetchAcademyTemplates,
  patchAcademyTemplate,
  fetchAcademyDrawConfigAdmin,
  patchAcademyDrawConfig,
  type AdminAttributeTemplate,
  type AdminDrawConfig,
} from '@/admin/academyAdminClient';
import type { PlayerAttributes } from '@/entities/types';
import { positionLabelPt } from '@/entities/positionLabels';

const ATTR_LABELS: Array<[keyof PlayerAttributes, string]> = [
  ['velocidade', 'VEL'], ['finalizacao', 'FIN'], ['drible', 'DRI'], ['passe', 'PAS'], ['marcacao', 'MAR'],
  ['fisico', 'FIS'], ['tatico', 'TAT'], ['mentalidade', 'MEN'], ['confianca', 'CON'], ['fairPlay', 'FP'],
];

const RARITY_CHIP: Record<string, string> = {
  normal: 'bg-white/10 text-white/70',
  premium: 'bg-sky-500/15 text-sky-300',
  gold: 'bg-amber-500/15 text-amber-300',
  rare: 'bg-fuchsia-500/15 text-fuchsia-300',
  legend: 'bg-neon-yellow/20 text-neon-yellow',
};

export function AdminGachaTemplatesPanel() {
  const [templates, setTemplates] = useState<AdminAttributeTemplate[]>([]);
  const [config, setConfig] = useState<AdminDrawConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftAttrs, setDraftAttrs] = useState<PlayerAttributes | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tpls, cfg] = await Promise.all([fetchAcademyTemplates(), fetchAcademyDrawConfigAdmin()]);
      setTemplates(tpls);
      setConfig(cfg);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const probTotal = useMemo(
    () => config.reduce((s, r) => s + Number(r.probability_pct), 0),
    [config],
  );

  const startEdit = (t: AdminAttributeTemplate) => {
    setEditingId(t.id);
    setDraftAttrs({ ...t.attributes });
  };

  const saveTemplate = async (t: AdminAttributeTemplate, seal: boolean) => {
    setSavingId(t.id);
    try {
      const updated = await patchAcademyTemplate({
        id: t.id,
        attributes: draftAttrs ?? t.attributes,
        status: seal ? 'sealed' : undefined,
      });
      if (updated) {
        setTemplates((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
      }
      setEditingId(null);
      setDraftAttrs(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSavingId(null);
    }
  };

  const toggleSeal = async (t: AdminAttributeTemplate) => {
    setSavingId(t.id);
    try {
      const updated = await patchAcademyTemplate({ id: t.id, status: t.status === 'sealed' ? 'draft' : 'sealed' });
      if (updated) setTemplates((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao selar.');
    } finally {
      setSavingId(null);
    }
  };

  const saveConfigRow = async (row: AdminDrawConfig) => {
    try {
      await patchAcademyDrawConfig({
        rarity_tier: row.rarity_tier,
        probability_pct: row.probability_pct,
        ovr_floor: row.ovr_floor,
        ovr_ceiling: row.ovr_ceiling,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar odds.');
    }
  };

  const updateConfigLocal = (tier: string, field: keyof AdminDrawConfig, value: number) => {
    setConfig((prev) => prev.map((r) => (r.rarity_tier === tier ? { ...r, [field]: value } : r)));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-black uppercase tracking-wider text-white">
            <Dices className="h-6 w-6 text-neon-yellow" /> Gacha — Templates & Odds
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Revisa/sela os craques pesquisados pelo agente e ajusta as probabilidades do sorteio.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Recarregar
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {/* ── ODDS ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-black uppercase tracking-wide text-white/80">Probabilidades & tetos</h3>
          <span className={`text-xs font-mono ${Math.round(probTotal) === 100 ? 'text-emerald-300' : 'text-amber-300'}`}>
            Soma: {probTotal}% {Math.round(probTotal) === 100 ? '✓' : '(ideal 100%)'}
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/50">
              <tr>
                <th className="px-4 py-2 text-left">Raridade</th>
                <th className="px-3 py-2 text-center">Chance %</th>
                <th className="px-3 py-2 text-center">OVR mín</th>
                <th className="px-3 py-2 text-center">OVR máx</th>
                <th className="px-3 py-2 text-center">Salvar</th>
              </tr>
            </thead>
            <tbody>
              {config.map((row) => (
                <tr key={row.rarity_tier} className="border-b border-white/5">
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${RARITY_CHIP[row.rarity_tier] ?? ''}`}>
                      {row.rarity_tier}
                    </span>
                  </td>
                  {(['probability_pct', 'ovr_floor', 'ovr_ceiling'] as const).map((field) => (
                    <td key={field} className="px-3 py-2 text-center">
                      <input
                        type="number"
                        value={row[field]}
                        onChange={(e) => updateConfigLocal(row.rarity_tier, field, Number(e.target.value))}
                        className="w-16 rounded border border-white/10 bg-white/5 px-2 py-1 text-center text-white focus:border-neon-yellow/50 focus:outline-none"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => void saveConfigRow(row)}
                      className="rounded p-1.5 text-neon-yellow hover:bg-neon-yellow/10"
                      title="Salvar"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── TEMPLATES ── */}
      <section className="space-y-3">
        <h3 className="font-display text-sm font-black uppercase tracking-wide text-white/80">
          Templates ({templates.length}) — draft no topo
        </h3>
        {loading ? (
          <p className="py-8 text-center text-sm text-white/50">Carregando…</p>
        ) : templates.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-black/20 py-8 text-center text-sm text-white/50">
            Nenhum template ainda. Eles surgem quando managers sorteiam craques inéditos.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-black text-white">{t.player_name}</span>
                      <span className="text-xs text-white/50">{t.year}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${RARITY_CHIP[t.rarity_tier] ?? ''}`}>
                        {t.rarity_tier}
                      </span>
                      <span className="text-[10px] text-white/45">{t.position} · {positionLabelPt(t.position)}</span>
                      <span className="font-mono text-xs text-white/70">OVR {t.overall}</span>
                      {t.status === 'sealed' ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-300"><Check className="h-3 w-3" /> selado</span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-300">draft</span>
                      )}
                    </div>
                    {t.bio_snippet && <p className="mt-1 text-[11px] italic text-white/40">{t.bio_snippet}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => (editingId === t.id ? setEditingId(null) : startEdit(t))}
                      className="rounded px-2 py-1 text-xs font-bold text-white/70 hover:bg-white/10"
                    >
                      {editingId === t.id ? 'Fechar' : 'Editar attrs'}
                    </button>
                    <button
                      type="button"
                      disabled={savingId === t.id}
                      onClick={() => void toggleSeal(t)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs font-bold text-neon-yellow hover:bg-neon-yellow/10 disabled:opacity-50"
                    >
                      {t.status === 'sealed' ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      {t.status === 'sealed' ? 'Reabrir' : 'Selar'}
                    </button>
                  </div>
                </div>

                {editingId === t.id && draftAttrs && (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <div className="grid grid-cols-5 gap-2">
                      {ATTR_LABELS.map(([key, label]) => (
                        <label key={key} className="block">
                          <span className="mb-0.5 block text-[9px] uppercase text-white/40">{label}</span>
                          <input
                            type="number"
                            value={draftAttrs[key]}
                            min={1}
                            max={99}
                            onChange={(e) =>
                              setDraftAttrs((prev) => (prev ? { ...prev, [key]: Number(e.target.value) } : prev))
                            }
                            className="w-full rounded border border-white/10 bg-white/5 px-1.5 py-1 text-center text-xs text-white focus:border-neon-yellow/50 focus:outline-none"
                          />
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={savingId === t.id}
                        onClick={() => void saveTemplate(t, false)}
                        className="flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-50"
                      >
                        <Save className="h-3.5 w-3.5" /> Salvar attrs
                      </button>
                      <button
                        type="button"
                        disabled={savingId === t.id}
                        onClick={() => void saveTemplate(t, true)}
                        className="flex items-center gap-1 rounded-lg bg-neon-yellow px-3 py-1.5 text-xs font-black uppercase text-black hover:brightness-110 disabled:opacity-50"
                      >
                        <Lock className="h-3.5 w-3.5" /> Salvar + selar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
