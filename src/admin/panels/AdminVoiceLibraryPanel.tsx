import { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit2, Check, X, TrendingUp } from 'lucide-react';
import { getSupabase } from '@/supabase/client';
import type { VoiceIntent, IntentCategory } from '@/voiceCommand/types';
import { INTENT_CATEGORY } from '@/voiceCommand/types';

interface LearnedPhrase {
  id: string;
  phrase: string;
  intent: VoiceIntent;
  category: IntentCategory;
  confidence: number;
  language: string;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export function AdminVoiceLibraryPanel() {
  const [phrases, setPhrases] = useState<LearnedPhrase[]>([]);
  const [filteredPhrases, setFilteredPhrases] = useState<LearnedPhrase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIntent, setFilterIntent] = useState<VoiceIntent | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<IntentCategory | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<LearnedPhrase>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPhrase, setNewPhrase] = useState<Partial<LearnedPhrase>>({
    phrase: '',
    intent: 'take_shot',
    confidence: 1.0,
    language: 'pt-BR',
    is_active: true,
  });

  useEffect(() => {
    loadPhrases();
  }, []);

  useEffect(() => {
    filterPhrases();
  }, [phrases, searchQuery, filterIntent, filterCategory]);

  async function loadPhrases() {
    const sb = getSupabase();
    if (!sb) return;

    setLoading(true);
    const { data, error } = await sb
      .from('learned_phrases')
      .select('*')
      .order('usage_count', { ascending: false });

    if (error) {
      console.error('[AdminVoiceLibrary] Erro ao carregar frases:', error);
    } else {
      setPhrases(data || []);
    }
    setLoading(false);
  }

  function filterPhrases() {
    let filtered = [...phrases];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.phrase.toLowerCase().includes(query) ||
        p.intent.toLowerCase().includes(query)
      );
    }

    if (filterIntent !== 'all') {
      filtered = filtered.filter(p => p.intent === filterIntent);
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter(p => p.category === filterCategory);
    }

    setFilteredPhrases(filtered);
  }

  async function handleAdd() {
    const sb = getSupabase();
    if (!sb || !newPhrase.phrase || !newPhrase.intent) return;

    const category = INTENT_CATEGORY[newPhrase.intent as VoiceIntent];

    const { error } = await sb.from('learned_phrases').insert({
      phrase: newPhrase.phrase.trim(),
      intent: newPhrase.intent,
      category,
      confidence: newPhrase.confidence || 1.0,
      language: newPhrase.language || 'pt-BR',
      is_active: newPhrase.is_active ?? true,
    });

    if (error) {
      console.error('[AdminVoiceLibrary] Erro ao adicionar frase:', error);
      alert('Erro ao adicionar frase: ' + error.message);
    } else {
      setShowAddForm(false);
      setNewPhrase({
        phrase: '',
        intent: 'take_shot',
        confidence: 1.0,
        language: 'pt-BR',
        is_active: true,
      });
      loadPhrases();
    }
  }

  async function handleUpdate(id: string) {
    const sb = getSupabase();
    if (!sb) return;

    const { error } = await sb
      .from('learned_phrases')
      .update(editForm)
      .eq('id', id);

    if (error) {
      console.error('[AdminVoiceLibrary] Erro ao atualizar frase:', error);
      alert('Erro ao atualizar frase: ' + error.message);
    } else {
      setEditingId(null);
      setEditForm({});
      loadPhrases();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir esta frase?')) return;

    const sb = getSupabase();
    if (!sb) return;

    const { error } = await sb
      .from('learned_phrases')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[AdminVoiceLibrary] Erro ao excluir frase:', error);
      alert('Erro ao excluir frase: ' + error.message);
    } else {
      loadPhrases();
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    const sb = getSupabase();
    if (!sb) return;

    const { error } = await sb
      .from('learned_phrases')
      .update({ is_active: !currentActive })
      .eq('id', id);

    if (error) {
      console.error('[AdminVoiceLibrary] Erro ao alternar status:', error);
    } else {
      loadPhrases();
    }
  }

  const uniqueIntents = Array.from(new Set(phrases.map(p => p.intent))).sort();
  const uniqueCategories = Array.from(new Set(phrases.map(p => p.category))).sort();

  const stats = {
    total: phrases.length,
    active: phrases.filter(p => p.is_active).length,
    totalUsage: phrases.reduce((sum, p) => sum + p.usage_count, 0),
    avgConfidence: phrases.length > 0
      ? (phrases.reduce((sum, p) => sum + p.confidence, 0) / phrases.length).toFixed(2)
      : '0.00',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Biblioteca de Comandos de Voz</h2>
          <p className="text-sm text-white/50">
            Gerenciar frases reconhecidas para comandos de voz em partidas ao vivo
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary"
        >
          <span className="btn-primary-inner">
            <Plus className="h-4 w-4" />
            Nova Frase
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="sports-panel rounded-lg p-4">
          <div className="text-xs text-white/50">Total de Frases</div>
          <div className="text-2xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="sports-panel rounded-lg p-4">
          <div className="text-xs text-white/50">Frases Ativas</div>
          <div className="text-2xl font-bold text-neon-yellow">{stats.active}</div>
        </div>
        <div className="sports-panel rounded-lg p-4">
          <div className="text-xs text-white/50">Uso Total</div>
          <div className="flex items-center gap-2 text-2xl font-bold text-white">
            <TrendingUp className="h-5 w-5 text-green-400" />
            {stats.totalUsage}
          </div>
        </div>
        <div className="sports-panel rounded-lg p-4">
          <div className="text-xs text-white/50">Confiança Média</div>
          <div className="text-2xl font-bold text-white">{stats.avgConfidence}</div>
        </div>
      </div>

      {showAddForm && (
        <div className="sports-panel rounded-lg p-6">
          <h3 className="mb-4 text-lg font-bold text-white">Adicionar Nova Frase</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-white/65">Frase</label>
              <input
                type="text"
                value={newPhrase.phrase}
                onChange={(e) => setNewPhrase({ ...newPhrase, phrase: e.target.value })}
                className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                placeholder="ex: chuta, finaliza, cruza..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/65">Intent</label>
              <select
                value={newPhrase.intent}
                onChange={(e) => setNewPhrase({ ...newPhrase, intent: e.target.value as VoiceIntent })}
                className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
              >
                {Object.keys(INTENT_CATEGORY).map(intent => (
                  <option key={intent} value={intent}>{intent}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/65">Confiança (0.0 - 1.0)</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={newPhrase.confidence}
                onChange={(e) => setNewPhrase({ ...newPhrase, confidence: parseFloat(e.target.value) })}
                className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/65">Idioma</label>
              <input
                type="text"
                value={newPhrase.language}
                onChange={(e) => setNewPhrase({ ...newPhrase, language: e.target.value })}
                className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleAdd} className="btn-primary">
              <span className="btn-primary-inner">
                <Check className="h-4 w-4" />
                Adicionar
              </span>
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="sports-panel rounded-lg p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar frases..."
              className="w-full rounded-lg border border-white/15 bg-black/50 py-2 pl-10 pr-3 text-sm text-white placeholder:text-white/35"
            />
          </div>
          <select
            value={filterIntent}
            onChange={(e) => setFilterIntent(e.target.value as VoiceIntent | 'all')}
            className="rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
          >
            <option value="all">Todos os Intents</option>
            {uniqueIntents.map(intent => (
              <option key={intent} value={intent}>{intent}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as IntentCategory | 'all')}
            className="rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
          >
            <option value="all">Todas as Categorias</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="py-8 text-center text-white/50">Carregando...</div>
        ) : filteredPhrases.length === 0 ? (
          <div className="py-8 text-center text-white/50">Nenhuma frase encontrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/50">
                  <th className="pb-2">Frase</th>
                  <th className="pb-2">Intent</th>
                  <th className="pb-2">Categoria</th>
                  <th className="pb-2">Confiança</th>
                  <th className="pb-2">Uso</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPhrases.map((phrase) => (
                  <tr key={phrase.id} className="border-b border-white/5">
                    <td className="py-3">
                      {editingId === phrase.id ? (
                        <input
                          type="text"
                          value={editForm.phrase ?? phrase.phrase}
                          onChange={(e) => setEditForm({ ...editForm, phrase: e.target.value })}
                          className="w-full rounded border border-white/15 bg-black/50 px-2 py-1 text-white"
                        />
                      ) : (
                        <span className="text-white">{phrase.phrase}</span>
                      )}
                    </td>
                    <td className="py-3">
                      {editingId === phrase.id ? (
                        <select
                          value={editForm.intent ?? phrase.intent}
                          onChange={(e) => setEditForm({ ...editForm, intent: e.target.value as VoiceIntent })}
                          className="rounded border border-white/15 bg-black/50 px-2 py-1 text-white"
                        >
                          {Object.keys(INTENT_CATEGORY).map(intent => (
                            <option key={intent} value={intent}>{intent}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-mono text-xs text-neon-yellow">{phrase.intent}</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/70">
                        {phrase.category}
                      </span>
                    </td>
                    <td className="py-3">
                      {editingId === phrase.id ? (
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          value={editForm.confidence ?? phrase.confidence}
                          onChange={(e) => setEditForm({ ...editForm, confidence: parseFloat(e.target.value) })}
                          className="w-20 rounded border border-white/15 bg-black/50 px-2 py-1 text-white"
                        />
                      ) : (
                        <span className="text-white/70">{phrase.confidence.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span className="text-white/70">{phrase.usage_count}</span>
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => handleToggleActive(phrase.id, phrase.is_active)}
                        className={`rounded px-2 py-0.5 text-xs ${
                          phrase.is_active
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}
                      >
                        {phrase.is_active ? 'Ativa' : 'Inativa'}
                      </button>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        {editingId === phrase.id ? (
                          <>
                            <button
                              onClick={() => handleUpdate(phrase.id)}
                              className="text-green-400 hover:text-green-300"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditForm({});
                              }}
                              className="text-red-400 hover:text-red-300"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingId(phrase.id);
                                setEditForm(phrase);
                              }}
                              className="text-white/50 hover:text-white"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(phrase.id)}
                              className="text-white/50 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
