import { useState } from 'react';
import { LayoutGrid, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GameSpiritKnowledgeRoot, TacticalPattern } from '@/gamespirit/admin/gameSpiritKnowledgeStore';
import { newId, nowIso } from '@/gamespirit/admin/gameSpiritKnowledgeStore';

export function PatternsSection({
  kb,
  onChange,
}: {
  kb: GameSpiritKnowledgeRoot;
  onChange: (next: GameSpiritKnowledgeRoot) => void;
}) {
  const [name, setName] = useState('');
  const [intentTag, setIntentTag] = useState('');
  const [notes, setNotes] = useState('');

  const add = () => {
    if (!name.trim()) return;
    const p: TacticalPattern = {
      id: newId('pat'),
      name: name.trim(),
      intentTag: intentTag.trim() || 'livre',
      notes: notes.trim(),
      updatedAt: nowIso(),
    };
    onChange({ ...kb, tacticalPatterns: [...kb.tacticalPatterns, p] });
    setName('');
    setIntentTag('');
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-white/60">
        Notas e padrões que queres que o GameSpirit &quot;aprenda&quot; conceptualmente. Ficam guardados localmente; o
        motor ainda não lê isto — mas deixa de ser conversa no vácuo: tens registo persistido e JSON exportável.
      </p>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-neon-yellow/90">
          <Plus className="h-4 w-4" />
          Novo padrão
        </h3>
        <label className="mt-3 block text-[10px] font-bold uppercase text-white/40">
          Nome
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
          />
        </label>
        <label className="mt-3 block text-[10px] font-bold uppercase text-white/40">
          Etiqueta tática (ex.: press_high, build_up, counter)
          <input
            value={intentTag}
            onChange={(e) => setIntentTag(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
          />
        </label>
        <label className="mt-3 block text-[10px] font-bold uppercase text-white/40">
          Notas / quando usar / triggers
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
          />
        </label>
        <button
          type="button"
          onClick={add}
          className={cn(
            'mt-3 rounded-lg px-4 py-2 text-xs font-black uppercase',
            name.trim() ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'cursor-not-allowed bg-white/10 text-white/35',
          )}
        >
          Guardar padrão
        </button>
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase text-white/40">
          <LayoutGrid className="h-3.5 w-3.5" />
          Guardados ({kb.tacticalPatterns.length})
        </h3>
        <ul className="space-y-2">
          {kb.tacticalPatterns.map((p) => (
            <li key={p.id} className="rounded-lg border border-white/10 bg-black/25 p-3">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-bold text-white">{p.name}</p>
                  <p className="text-[10px] text-cyan-300/80">{p.intentTag}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...kb, tacticalPatterns: kb.tacticalPatterns.filter((x) => x.id !== p.id) })
                  }
                  className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/15"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {p.notes ? <p className="mt-2 whitespace-pre-wrap text-xs text-white/55">{p.notes}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
