import { useCallback, useState } from 'react';
import { Bot, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdminPlatformState } from '@/admin/platformTypes';
import { buildGrowthAnalystSnapshot } from '@/admin/growthSnapshot';
import { requestGrowthAnalyst, type GrowthAnalystBriefing } from '@/admin/growthAnalystClient';
import { fetchGameSpiritServerStatus } from '@/gamespirit/admin/gameSpiritTeachClient';
import type { GrowthRangePreset } from '@/admin/growthMetrics';

export function GrowthAnalystSection({
  platform,
  preset,
}: {
  platform: AdminPlatformState;
  preset: GrowthRangePreset;
}) {
  const [founderNote, setFounderNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<GrowthAnalystBriefing | null>(null);
  const [serverAi, setServerAi] = useState<boolean | null>(null);

  const checkServer = useCallback(async () => {
    const s = await fetchGameSpiritServerStatus();
    setServerAi(s.reachable && s.openaiConfigured === true);
  }, []);

  const run = async () => {
    setLoading(true);
    setError(null);
    await checkServer();
    const snapshot = buildGrowthAnalystSnapshot(platform, preset);
    const res = await requestGrowthAnalyst({ snapshot, founderNote });
    setLoading(false);
    if (res.ok === false) {
      setError(res.error);
      setBriefing(null);
      return;
    }
    setBriefing(res.briefing);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-sm text-violet-100/90">
        <div className="flex flex-wrap items-center gap-2">
          <Bot className="h-5 w-5 shrink-0 text-violet-300" />
          <strong className="text-white">Analista de Growth (IA)</strong>
          <span className="text-white/50">— briefing a partir dos mesmos dados do separador Métricas + cashflow.</span>
        </div>
        <p className="mt-2 text-xs text-white/45">
          Usa o olefoot-server com <code className="text-neon-yellow/80">ANTHROPIC_API_KEY</code> e{' '}
          <code className="text-neon-yellow/80">VITE_OLEFOOT_API_URL</code> no cliente. Não substitui contabilidade
          certificada — é apoio à decisão.
        </p>
        {serverAi === false ? (
          <p className="mt-2 text-xs text-amber-200/90">
            Servidor ou Anthropic não detetados na última verificação — mesmo assim podes tentar gerar (erro mostrará o
            motivo).
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void checkServer()}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10"
        >
          <RefreshCw className="h-4 w-4" />
          Verificar servidor
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void run()}
          className="inline-flex items-center gap-2 rounded-lg bg-neon-yellow px-4 py-2 text-xs font-black uppercase text-black hover:bg-white disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Gerar briefing
        </button>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
          Nota para o analista (opcional)
        </span>
        <textarea
          value={founderNote}
          onChange={(e) => setFounderNote(e.target.value)}
          rows={3}
          placeholder="Ex.: Lançámos campanha X, preocupa-me o CAC, quero focar em retenção…"
          className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-neon-yellow/50 focus:outline-none"
        />
      </label>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {briefing ? (
        <div className="space-y-4">
          <BriefBlock title="Revisão diária" body={briefing.daily_review} accent="border-cyan-500/30 bg-cyan-500/5" />
          <BriefBlock
            title="Receita × crescimento"
            body={briefing.revenue_and_growth}
            accent="border-emerald-500/30 bg-emerald-500/5"
          />
          <BriefBlock
            title="Saúde de cashflow"
            body={briefing.cashflow_health}
            accent="border-amber-500/30 bg-amber-500/5"
          />
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/45">Previsão / tendência</h4>
            <p className="mt-2 text-sm text-white/75">{briefing.forecast_note}</p>
          </div>
          {briefing.tips.length > 0 ? (
            <div className="rounded-xl border border-neon-yellow/25 bg-neon-yellow/5 p-4">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-neon-yellow/80">Dicas</h4>
              <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm text-white/80">
                {briefing.tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {briefing.cautions.length > 0 ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-rose-200/80">Atenção</h4>
              <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm text-rose-100/90">
                {briefing.cautions.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BriefBlock({ title, body, accent }: { title: string; body: string; accent: string }) {
  return (
    <div className={cn('rounded-xl border p-4', accent)}>
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/45">{title}</h4>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/85">{body}</p>
    </div>
  );
}
