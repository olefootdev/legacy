import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  ClipboardCopy,
  Download,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  exportKnowledgeJson,
  loadKnowledge,
  saveKnowledge,
  type GameSpiritKnowledgeRoot,
} from '@/gamespirit/admin/gameSpiritKnowledgeStore';
import { GAME_SPIRIT_VERSION_TAG } from '@/gamespirit/admin/gameSpiritSystemReference';
import { DiagnosticsSection } from './gameSpirit/DiagnosticsSection';
import { NarrativesSection } from './gameSpirit/NarrativesSection';
import { PatternsSection } from './gameSpirit/PatternsSection';
import { PositionsSection } from './gameSpirit/PositionsSection';
import { ReferenceSection } from './gameSpirit/ReferenceSection';
import { TeachSection } from './gameSpirit/TeachSection';

type TabId = 'diag' | 'nar' | 'pat' | 'pos' | 'teach' | 'ref';

const TABS: { id: TabId; label: string }[] = [
  { id: 'diag', label: 'Diagnóstico' },
  { id: 'nar', label: 'Narrativas' },
  { id: 'pat', label: 'Padrões táticos' },
  { id: 'pos', label: 'Posições' },
  { id: 'teach', label: 'Ensino (OpenAI)' },
  { id: 'ref', label: 'Mapa código' },
];

export function AdminGameSpiritPanel() {
  const [tab, setTab] = useState<TabId>('diag');
  const [kb, setKb] = useState<GameSpiritKnowledgeRoot>(() => loadKnowledge());
  const [exportOk, setExportOk] = useState(false);

  useEffect(() => {
    setKb(loadKnowledge());
  }, []);

  const persist = useCallback((next: GameSpiritKnowledgeRoot) => {
    saveKnowledge(next);
    setKb(next);
  }, []);

  const exportFile = () => {
    const blob = new Blob([exportKnowledgeJson(kb)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `olefoot-gamespirit-knowledge-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOk(true);
    window.setTimeout(() => setExportOk(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-violet-500/35 bg-violet-500/10 px-4 py-3 text-sm text-violet-100/95">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-black text-white">GAME SPIRIT</p>
            <p className="mt-1 text-white/75">
              Sistema <strong className="text-white">verificável</strong>: diagnóstico do que o motor usa, biblioteca
              local que podes alimentar, e ensino via OpenAI no servidor. Sem fingir que Docling ou a tua biblioteca já
              entram no simulador — até estarem ligados no código.
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-white/40">{GAME_SPIRIT_VERSION_TAG}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportFile}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-[10px] font-bold uppercase text-white/85 hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5" />
              {exportOk ? 'Descarregado' : 'Exportar JSON'}
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(exportKnowledgeJson(kb));
                setExportOk(true);
                window.setTimeout(() => setExportOk(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-[10px] font-bold uppercase text-white/85 hover:bg-white/10"
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
              Copiar JSON
            </button>
            <Link
              to="/admin#create-player"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neon-yellow/40 bg-neon-yellow/15 px-3 py-2 text-[10px] font-bold uppercase text-neon-yellow hover:bg-neon-yellow/25"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Create player
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-white/10 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-lg px-3 py-2 text-[10px] font-bold uppercase',
              tab === t.id ? 'bg-neon-yellow text-black' : 'text-white/45 hover:bg-white/10 hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 md:p-6">
        {tab === 'diag' ? <DiagnosticsSection /> : null}
        {tab === 'nar' ? <NarrativesSection kb={kb} onChange={persist} /> : null}
        {tab === 'pat' ? <PatternsSection kb={kb} onChange={persist} /> : null}
        {tab === 'pos' ? <PositionsSection kb={kb} onChange={persist} /> : null}
        {tab === 'teach' ? <TeachSection kb={kb} onChange={persist} /> : null}
        {tab === 'ref' ? (
          <div className="flex items-start gap-2 text-white/45">
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0" />
            <ReferenceSection />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[10px] text-white/35">
        <Activity className="h-3.5 w-3.5" />
        <span>
          Memória local: {kb.narrativePacks.length} pacotes · {kb.tacticalPatterns.length} padrões ·{' '}
          {kb.positionTeachings.length} posições
        </span>
      </div>
    </div>
  );
}
