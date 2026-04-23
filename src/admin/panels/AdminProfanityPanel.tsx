import { useEffect, useState } from 'react';
import { ShieldAlert, Plus, Trash2, RefreshCw } from 'lucide-react';
import {
  fetchProfanityWords,
  adminAddProfanity,
  adminRemoveProfanity,
} from '@/supabase/voiceCommandLog';

export function AdminProfanityPanel() {
  const [words, setWords] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const data = await fetchProfanityWords();
    setWords(data);
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, []);

  const add = async () => {
    const w = input.trim().toLowerCase();
    if (!w) return;
    if (words.includes(w)) { setMsg('Palavra já na lista'); return; }
    setSaving(true);
    const ok = await adminAddProfanity(w);
    setSaving(false);
    if (ok) {
      setInput('');
      setMsg(`"${w}" adicionada`);
      void refresh();
    } else {
      setMsg('Falha ao salvar');
    }
    window.setTimeout(() => setMsg(null), 2500);
  };

  const remove = async (w: string) => {
    if (!window.confirm(`Remover "${w}" da lista?`)) return;
    const ok = await adminRemoveProfanity(w);
    if (ok) void refresh();
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <ShieldAlert className="h-5 w-5 text-rose-400" />
        <div className="flex-1">
          <h2 className="text-lg font-black text-white">Palavras censuradas</h2>
          <p className="text-[11px] text-gray-400">
            Lista consumida pelo filtro do árbitro em partidas ao vivo. 1ª ocorrência dá aviso; 2ª expulsa o melhor jogador.
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
      </header>

      <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.05] p-4">
        <h3 className="mb-3 text-sm font-bold text-white">Adicionar palavra</h3>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }}
            placeholder="palavra ou expressão curta"
            className="flex-1 rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-sm text-white placeholder:text-white/30"
            maxLength={40}
          />
          <button
            type="button"
            onClick={add}
            disabled={saving || !input.trim()}
            className="inline-flex items-center gap-1 rounded-lg bg-rose-500 px-3 py-1.5 text-[10px] font-black uppercase text-white hover:bg-rose-400 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </button>
        </div>
        {msg ? <p className="mt-2 text-[11px] text-rose-200">{msg}</p> : null}
      </div>

      <div>
        <p className="mb-2 text-[11px] text-gray-400">{words.length} palavras ativas</p>
        {loading ? (
          <p className="py-6 text-center text-sm text-gray-500">Carregando…</p>
        ) : words.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] py-8 text-center text-sm text-gray-500">
            Nenhuma palavra customizada. A lista base do código continua ativa.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {words.map((w) => (
              <span
                key={w}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-200"
              >
                {w}
                <button
                  type="button"
                  onClick={() => remove(w)}
                  className="ml-1 rounded-full p-0.5 text-rose-300/60 hover:text-rose-200 hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
