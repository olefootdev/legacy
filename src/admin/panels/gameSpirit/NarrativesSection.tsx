import { useState } from 'react';
import { BookMarked, Plus, Trash2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  newId,
  nowIso,
  type GameSpiritKnowledgeRoot,
  type NarrativePack,
} from '@/gamespirit/admin/gameSpiritKnowledgeStore';

function linesFromTextarea(s: string): string[] {
  return s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function NarrativesSection({
  kb,
  onChange,
}: {
  kb: GameSpiritKnowledgeRoot;
  onChange: (next: GameSpiritKnowledgeRoot) => void;
}) {
  const [title, setTitle] = useState('');
  const [bucket, setBucket] = useState('custom');
  const [linesText, setLinesText] = useState('');
  const [notes, setNotes] = useState('');

  const addPack = () => {
    const lines = linesFromTextarea(linesText);
    if (!title.trim() || lines.length === 0) return;
    const pack: NarrativePack = {
      id: newId('nar'),
      title: title.trim(),
      bucket: bucket.trim() || 'custom',
      lines,
      notes: notes.trim(),
      updatedAt: nowIso(),
    };
    onChange({ ...kb, narrativePacks: [...kb.narrativePacks, pack] });
    setTitle('');
    setLinesText('');
    setNotes('');
  };

  const remove = (id: string) => {
    onChange({ ...kb, narrativePacks: kb.narrativePacks.filter((p) => p.id !== id) });
  };

  const onImportFile = (f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLinesText(reader.result);
        if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''));
      }
    };
    reader.readAsText(f);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-white/60">
        Cada pacote é uma lista de frases (uma por linha). Isto fica em <code className="text-cyan-300/80">localStorage</code>.
        O motor continua a usar só os ficheiros TypeScript do catálogo até existir código que importe estes dados.
      </p>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-neon-yellow/90">
          <Plus className="h-4 w-4" />
          Novo pacote
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-[10px] font-bold uppercase text-white/40">
            Título
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
            />
          </label>
          <label className="text-[10px] font-bold uppercase text-white/40">
            Bucket (etiqueta)
            <input
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              placeholder="dribble, press, custom…"
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
            />
          </label>
        </div>
        <label className="mt-3 block text-[10px] font-bold uppercase text-white/40">
          Linhas (uma por linha). Usa {'{name}'} e {'{away}'} se quiseres placeholders.
          <textarea
            value={linesText}
            onChange={(e) => setLinesText(e.target.value)}
            rows={6}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 font-mono text-xs text-white"
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase text-white/60 hover:bg-white/10">
            <Upload className="h-3.5 w-3.5" />
            .txt / .md
            <input type="file" accept=".txt,.md,text/plain" className="hidden" onChange={(e) => onImportFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <label className="mt-3 block text-[10px] font-bold uppercase text-white/40">
          Notas de ensino
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
          />
        </label>
        <button
          type="button"
          onClick={addPack}
          className={cn(
            'mt-3 rounded-lg px-4 py-2 text-xs font-black uppercase',
            title.trim() && linesFromTextarea(linesText).length
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'cursor-not-allowed bg-white/10 text-white/35',
          )}
        >
          Guardar pacote
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase text-white/40">
          <BookMarked className="h-3.5 w-3.5" />
          Guardados ({kb.narrativePacks.length})
        </h3>
        {kb.narrativePacks.length === 0 ? (
          <p className="text-sm text-white/35">Ainda vazio.</p>
        ) : (
          <ul className="space-y-2">
            {kb.narrativePacks.map((p) => (
              <li key={p.id} className="rounded-lg border border-white/10 bg-black/25 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-white">{p.title}</p>
                    <p className="text-[10px] text-white/40">
                      {p.bucket} · {p.lines.length} linhas · {new Date(p.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/15"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {p.notes ? <p className="mt-2 text-xs text-white/50">{p.notes}</p> : null}
                <ul className="mt-2 max-h-32 list-inside list-disc overflow-y-auto font-mono text-[11px] text-white/60">
                  {p.lines.slice(0, 8).map((l, i) => (
                    <li key={i}>{l.slice(0, 120)}{l.length > 120 ? '…' : ''}</li>
                  ))}
                  {p.lines.length > 8 ? <li>… +{p.lines.length - 8}</li> : null}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
