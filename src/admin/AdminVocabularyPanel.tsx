/**
 * ADMIN — Painel de Vocabulário de Futebol
 * Gerencia a biblioteca global de comandos de voz PT-BR
 */

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import {
  getAllVocabularyForAdmin,
  addVocabularyEntry,
  updateVocabularyEntry,
  deleteVocabularyEntry,
  getVocabularyStats,
  type FootballVocabularyEntry,
} from '@/supabase/footballVocabulary';
import { cn } from '@/lib/utils';

type TabId = 'list' | 'add' | 'stats';

export function AdminVocabularyPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('list');
  const [vocabulary, setVocabulary] = useState<FootballVocabularyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadVocabulary();
  }, []);

  const loadVocabulary = async () => {
    setLoading(true);
    const data = await getAllVocabularyForAdmin();
    setVocabulary(data);
    setLoading(false);
  };

  const filteredVocabulary = vocabulary.filter(
    (v) =>
      v.phrase.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.intent.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.canonical_phrase.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-black uppercase tracking-wide text-white">
            📚 Vocabulário de Futebol
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Biblioteca global de comandos de voz PT-BR para o Olefoot
          </p>
        </div>
        <button
          onClick={loadVocabulary}
          disabled={loading}
          className={cn(
            'inline-flex items-center gap-2 rounded border px-3 py-2 text-sm font-bold uppercase tracking-wider transition-all',
            loading
              ? 'border-neon-yellow/40 bg-neon-yellow/10 text-neon-yellow cursor-wait'
              : 'border-white/20 bg-black/40 text-white hover:border-neon-yellow/40 hover:text-neon-yellow'
          )}
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          {loading ? 'Carregando...' : 'Recarregar'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          className={cn(
            'px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all',
            activeTab === 'list'
              ? 'border-b-2 border-neon-yellow text-neon-yellow'
              : 'text-gray-400 hover:text-white'
          )}
          onClick={() => setActiveTab('list')}
        >
          📋 Lista ({vocabulary.length})
        </button>
        <button
          className={cn(
            'px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all',
            activeTab === 'add'
              ? 'border-b-2 border-neon-yellow text-neon-yellow'
              : 'text-gray-400 hover:text-white'
          )}
          onClick={() => setActiveTab('add')}
        >
          ➕ Adicionar
        </button>
        <button
          className={cn(
            'px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all',
            activeTab === 'stats'
              ? 'border-b-2 border-neon-yellow text-neon-yellow'
              : 'text-gray-400 hover:text-white'
          )}
          onClick={() => setActiveTab('stats')}
        >
          📊 Estatísticas
        </button>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'list' && (
          <VocabularyListTab
            vocabulary={filteredVocabulary}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onUpdate={loadVocabulary}
          />
        )}
        {activeTab === 'add' && <AddVocabularyTab onAdd={loadVocabulary} />}
        {activeTab === 'stats' && <StatsTab />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: LISTA
// ─────────────────────────────────────────────────────────────
function VocabularyListTab({
  vocabulary,
  searchTerm,
  setSearchTerm,
  onUpdate,
}: {
  vocabulary: FootballVocabularyEntry[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onUpdate: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleToggleActive = async (entry: FootballVocabularyEntry) => {
    await updateVocabularyEntry(entry.id, { is_active: !entry.is_active });
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta entrada?')) return;
    await deleteVocabularyEntry(id);
    onUpdate();
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por frase, intent ou canonical..."
          className="w-full rounded border border-white/10 bg-black/40 py-2 pl-10 pr-4 text-sm text-white placeholder:text-gray-600 focus:border-neon-yellow/60 outline-none"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/40">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                Frase
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                Intent
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                Canônica
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                Região
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400">
                Confirmações
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {vocabulary.map((entry) => (
              <tr key={entry.id} className="hover:bg-white/5">
                <td className="px-4 py-3 text-white">{entry.phrase}</td>
                <td className="px-4 py-3">
                  <span className="rounded border border-neon-yellow/30 bg-neon-yellow/10 px-2 py-0.5 text-xs font-bold text-neon-yellow">
                    {entry.intent}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">{entry.canonical_phrase}</td>
                <td className="px-4 py-3 text-gray-400">{entry.region}</td>
                <td className="px-4 py-3 text-center text-white">{entry.confirm_count}</td>
                <td className="px-4 py-3 text-center">
                  {entry.is_active ? (
                    <CheckCircle className="inline h-4 w-4 text-emerald-400" />
                  ) : (
                    <XCircle className="inline h-4 w-4 text-red-400" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleToggleActive(entry)}
                      className="rounded border border-white/10 bg-black/40 p-1.5 text-gray-400 transition-colors hover:border-neon-yellow/40 hover:text-neon-yellow"
                      title={entry.is_active ? 'Desativar' : 'Ativar'}
                    >
                      {entry.is_active ? (
                        <XCircle className="h-3.5 w-3.5" />
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="rounded border border-white/10 bg-black/40 p-1.5 text-gray-400 transition-colors hover:border-red-500/40 hover:text-red-400"
                      title="Deletar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {vocabulary.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-black/40 p-8 text-center">
          <p className="text-sm text-gray-400">Nenhuma entrada encontrada</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: ADICIONAR
// ─────────────────────────────────────────────────────────────
function AddVocabularyTab({ onAdd }: { onAdd: () => void }) {
  const [phrase, setPhrase] = useState('');
  const [stem, setStem] = useState('');
  const [intent, setIntent] = useState('');
  const [canonicalPhrase, setCanonicalPhrase] = useState('');
  const [region, setRegion] = useState('BR');
  const [languageType, setLanguageType] = useState('popular');
  const [context, setContext] = useState('torcida');
  const [formalityLevel, setFormalityLevel] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phrase || !stem || !intent || !canonicalPhrase) return;

    setSubmitting(true);
    const result = await addVocabularyEntry({
      phrase: phrase.toLowerCase(),
      stem,
      intent,
      canonical_phrase: canonicalPhrase,
      region,
      language_type: languageType,
      context,
      formality_level: formalityLevel,
      is_active: true,
    });

    if (result) {
      setPhrase('');
      setStem('');
      setIntent('');
      setCanonicalPhrase('');
      onAdd();
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">
            Frase *
          </label>
          <input
            type="text"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="ex: chuta logo"
            className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-neon-yellow/60 outline-none"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">
            Stem *
          </label>
          <input
            type="text"
            value={stem}
            onChange={(e) => setStem(e.target.value)}
            placeholder="ex: chut"
            className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-neon-yellow/60 outline-none"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">
            Intent *
          </label>
          <input
            type="text"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="ex: shoot"
            className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-neon-yellow/60 outline-none"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">
            Frase Canônica *
          </label>
          <input
            type="text"
            value={canonicalPhrase}
            onChange={(e) => setCanonicalPhrase(e.target.value)}
            placeholder="ex: chutar"
            className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-neon-yellow/60 outline-none"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">
            Região
          </label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-neon-yellow/60 outline-none"
          >
            <option value="BR">Brasil</option>
            <option value="PT">Portugal</option>
            <option value="ALL">Todas</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">
            Tipo de Linguagem
          </label>
          <select
            value={languageType}
            onChange={(e) => setLanguageType(e.target.value)}
            className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-neon-yellow/60 outline-none"
          >
            <option value="popular">Popular</option>
            <option value="formal">Formal</option>
            <option value="gíria">Gíria</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">
            Contexto
          </label>
          <select
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-neon-yellow/60 outline-none"
          >
            <option value="torcida">Torcida</option>
            <option value="técnico">Técnico</option>
            <option value="narração">Narração</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">
            Nível de Formalidade (1-5)
          </label>
          <input
            type="number"
            min="1"
            max="5"
            value={formalityLevel}
            onChange={(e) => setFormalityLevel(Number(e.target.value))}
            className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-neon-yellow/60 outline-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || !phrase || !stem || !intent || !canonicalPhrase}
        className="w-full rounded bg-neon-yellow py-3 text-sm font-bold uppercase tracking-wider text-black transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {submitting ? 'Adicionando...' : '➕ Adicionar Entrada'}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: ESTATÍSTICAS
// ─────────────────────────────────────────────────────────────
function StatsTab() {
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    byIntent: Record<string, number>;
    byRegion: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    const data = await getVocabularyStats();
    setStats(data);
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center text-gray-400">Carregando estatísticas...</div>;
  }

  if (!stats) {
    return <div className="text-center text-gray-400">Erro ao carregar estatísticas</div>;
  }

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/40 p-6">
          <div className="text-4xl font-black text-neon-yellow">{stats.total}</div>
          <div className="mt-1 text-sm text-gray-400">Total de Entradas</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/40 p-6">
          <div className="text-4xl font-black text-emerald-400">{stats.active}</div>
          <div className="mt-1 text-sm text-gray-400">Entradas Ativas</div>
        </div>
      </div>

      {/* Por Intent */}
      <div className="rounded-lg border border-white/10 bg-black/40 p-6">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">
          Por Intent
        </h3>
        <div className="space-y-2">
          {Object.entries(stats.byIntent).map(([intent, count]) => (
            <div key={intent} className="flex items-center justify-between">
              <span className="text-sm text-gray-400">{intent}</span>
              <span className="rounded border border-neon-yellow/30 bg-neon-yellow/10 px-2 py-0.5 text-xs font-bold text-neon-yellow">
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Por Região */}
      <div className="rounded-lg border border-white/10 bg-black/40 p-6">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">
          Por Região
        </h3>
        <div className="space-y-2">
          {Object.entries(stats.byRegion).map(([region, count]) => (
            <div key={region} className="flex items-center justify-between">
              <span className="text-sm text-gray-400">{region}</span>
              <span className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-bold text-blue-400">
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
