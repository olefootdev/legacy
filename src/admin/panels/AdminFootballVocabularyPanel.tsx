/**
 * OLEFOOT — Admin Football Vocabulary Manager
 *
 * Painel para gerenciar a biblioteca de vocabulário de futebol PT-BR.
 * Permite adicionar, editar, remover e testar comandos em tempo real.
 */

import { useEffect, useState } from 'react';
import { BookOpen, Plus, Search, TestTube, Trash2, Edit2, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSupabase } from '@/supabase/client';
import type { VoiceIntent } from '@/voiceCommand/types';
import { intentLabelPt } from '@/voiceCommand/intentGuess';
import { parseVoiceCommand } from '@/voiceCommand/intentMatcher';

interface VocabularyEntry {
  id?: string;
  phrase: string;
  stem: string;
  intent: VoiceIntent;
  canonical_phrase: string;
  confirm_count: number;
  region?: string;
  language_type?: 'giria' | 'tecnico' | 'formal' | 'informal' | 'popular';
  context?: 'torcida' | 'treinador' | 'comentarista' | 'jogador';
  formality_level?: number; // 1=muito informal, 5=muito formal
  created_at?: string;
}

const ALL_INTENTS: VoiceIntent[] = [
  'take_shot', 'dribble_attempt', 'cross_ball', 'pass_to_player', 'hold_ball',
  'quick_pass', 'switch_play', 'invade_box', 'mark_player', 'block_advance',
  'aggressive_tackle', 'tactical_foul', 'team_press_high', 'team_retreat',
  'team_hold_possession', 'team_high_line', 'forwards_press_defenders',
  'midfielders_compact', 'laterals_cross', 'left_back_overlap', 'break_line',
  'break_zone', 'run_behind', 'pedal_to_metal', 'free_play', 'wait_support',
  'stretch_team', 'hold_small_area', 'spare_player', 'calm_team',
  'player_substitution', 'formation_change',
];

const REGIONS = ['BR', 'PT', 'AO', 'MZ', 'CV', 'GW', 'ST', 'TL', 'BR-NE', 'BR-S', 'BR-RJ', 'BR-SP'];

const LANGUAGE_TYPES = [
  { value: 'giria', label: '🔥 Gíria', color: 'rose' },
  { value: 'informal', label: '😎 Informal', color: 'orange' },
  { value: 'popular', label: '⚽ Popular', color: 'yellow' },
  { value: 'tecnico', label: '🎓 Técnico', color: 'blue' },
  { value: 'formal', label: '📺 Formal', color: 'purple' },
] as const;

const CONTEXTS = [
  { value: 'torcida', label: '📣 Torcida', desc: 'Linguagem de arquibancada' },
  { value: 'jogador', label: '⚽ Jogador', desc: 'Pelada entre amigos' },
  { value: 'treinador', label: '🎓 Treinador', desc: 'Linguagem técnica profissional' },
  { value: 'comentarista', label: '📺 Comentarista', desc: 'Linguagem formal de imprensa' },
] as const;

const REGION_LABELS: Record<string, string> = {
  'BR': '🇧🇷 Brasil',
  'PT': '🇵🇹 Portugal',
  'AO': '🇦🇴 Angola',
  'MZ': '🇲🇿 Moçambique',
  'CV': '🇨🇻 Cabo Verde',
  'GW': '🇬🇼 Guiné-Bissau',
  'ST': '🇸🇹 São Tomé',
  'TL': '🇹🇱 Timor-Leste',
  'BR-NE': '🇧🇷 Nordeste',
  'BR-S': '🇧🇷 Sul',
  'BR-RJ': '🇧🇷 Rio',
  'BR-SP': '🇧🇷 São Paulo',
};

const FORMALITY_LABELS = [
  { level: 1, label: '🔥 Muito Informal', desc: 'Torcida/Rua', color: 'rose' },
  { level: 2, label: '😎 Informal', desc: 'Pelada', color: 'orange' },
  { level: 3, label: '⚽ Neutro', desc: 'Jogador', color: 'yellow' },
  { level: 4, label: '🎓 Técnico', desc: 'Treinador', color: 'blue' },
  { level: 5, label: '📺 Formal', desc: 'Comentarista', color: 'purple' },
];

export function AdminFootballVocabularyPanel() {
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<VocabularyEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIntent, setSelectedIntent] = useState<VoiceIntent | 'all'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState<Partial<VocabularyEntry>>({
    phrase: '',
    intent: 'take_shot',
    canonical_phrase: '',
    confirm_count: 1,
    region: 'BR',
    language_type: 'popular',
    context: 'torcida',
    formality_level: 3,
  });
  const [testPhrase, setTestPhrase] = useState('');
  const [testResult, setTestResult] = useState<{ intent: VoiceIntent; confidence: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Carrega vocabulário do Supabase
  useEffect(() => {
    loadVocabulary();
  }, []);

  // Filtra entradas
  useEffect(() => {
    let filtered = entries;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.phrase.toLowerCase().includes(q) ||
        e.canonical_phrase.toLowerCase().includes(q)
      );
    }

    if (selectedIntent !== 'all') {
      filtered = filtered.filter(e => e.intent === selectedIntent);
    }

    setFilteredEntries(filtered);
  }, [entries, searchQuery, selectedIntent]);

  const loadVocabulary = async () => {
    setLoading(true);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        alert('Supabase não configurado');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('football_vocabulary')
        .select('*')
        .eq('is_active', true)
        .order('confirm_count', { ascending: false });

      if (error) throw error;

      setEntries(data || []);
    } catch (err) {
      console.error('[vocab] Load error:', err);
      alert('Erro ao carregar vocabulário do Supabase');
    } finally {
      setLoading(false);
    }
  };

  const addEntry = async () => {
    if (!newEntry.phrase || !newEntry.intent || !newEntry.canonical_phrase) {
      alert('Preencha frase, intent e canônico');
      return;
    }

    try {
      // Gera stem automaticamente
      const stem = generateStem(newEntry.phrase);

      const supabase = getSupabase();
      if (!supabase) {
        alert('Supabase não configurado');
        return;
      }

      const { error } = await supabase.from('football_vocabulary').insert({
        phrase: newEntry.phrase,
        stem,
        intent: newEntry.intent,
        canonical_phrase: newEntry.canonical_phrase,
        confirm_count: newEntry.confirm_count || 1,
        region: newEntry.region || 'BR',
        language_type: newEntry.language_type || 'popular',
        context: newEntry.context || 'torcida',
        formality_level: newEntry.formality_level || 3,
        is_active: true,
      });

      if (error) throw error;

      // Recarrega lista
      await loadVocabulary();

      setNewEntry({
        phrase: '',
        intent: 'take_shot',
        canonical_phrase: '',
        confirm_count: 1,
        region: 'BR',
        language_type: 'popular',
        context: 'torcida',
        formality_level: 3,
      });
      setShowAddForm(false);
    } catch (err) {
      console.error('[vocab] Add error:', err);
      alert('Erro ao adicionar entrada');
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Remover esta entrada?')) return;

    try {
      const supabase = getSupabase();
      if (!supabase) {
        alert('Supabase não configurado');
        return;
      }

      const { error } = await supabase
        .from('football_vocabulary')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error('[vocab] Delete error:', err);
      alert('Erro ao remover entrada');
    }
  };

  const testPhraseRecognition = () => {
    if (!testPhrase.trim()) return;

    // Testa com parser determinístico
    const parsed = parseVoiceCommand(testPhrase, {
      homePlayers: [],
      ballCarrierPlayerId: undefined,
    });

    if (parsed.length > 0) {
      setTestResult({
        intent: parsed[0]!.intent,
        confidence: 'Parser determinístico',
      });
    } else {
      // Busca na biblioteca
      const match = entries.find(e =>
        e.phrase.toLowerCase() === testPhrase.toLowerCase().trim()
      );

      if (match) {
        setTestResult({
          intent: match.intent,
          confidence: `Biblioteca (${match.confirm_count} confirms)`,
        });
      } else {
        setTestResult(null);
        alert('❌ Frase não reconhecida. Adicione à biblioteca!');
      }
    }
  };

  const generateStem = (phrase: string): string => {
    return phrase
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(' ')
      .map(w => w.slice(0, Math.min(w.length, 5)))
      .join(' ');
  };

  const stats = {
    total: entries.length,
    byIntent: ALL_INTENTS.reduce((acc, intent) => {
      acc[intent] = entries.filter(e => e.intent === intent).length;
      return acc;
    }, {} as Record<VoiceIntent, number>),
    topConfirmed: entries.sort((a, b) => b.confirm_count - a.confirm_count).slice(0, 5),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-cyan-400" />
          <div>
            <h2 className="text-xl font-black text-white">Biblioteca de Vocabulário</h2>
            <p className="text-xs text-gray-400">
              {stats.total} comandos de futebol PT-BR • Gírias, regionalismos e variações
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-black hover:bg-cyan-400"
        >
          <Plus className="h-4 w-4" />
          Adicionar Comando
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total de Comandos" value={stats.total.toString()} />
        <StatCard label="Mais Usado" value={intentLabelPt(Object.entries(stats.byIntent).sort((a, b) => b[1] - a[1])[0]?.[0] as VoiceIntent || 'take_shot')} />
        <StatCard label="Regiões" value={REGIONS.length.toString()} />
        <StatCard label="Top Confirm" value={stats.topConfirmed[0]?.confirm_count.toString() || '0'} />
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-cyan-100">Novo Comando</h3>
            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Frase Coloquial</label>
              <input
                type="text"
                value={newEntry.phrase}
                onChange={e => setNewEntry(prev => ({ ...prev, phrase: e.target.value }))}
                placeholder="ex: manda bala"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Frase Canônica</label>
              <input
                type="text"
                value={newEntry.canonical_phrase}
                onChange={e => setNewEntry(prev => ({ ...prev, canonical_phrase: e.target.value }))}
                placeholder="ex: chuta"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Intent</label>
              <select
                value={newEntry.intent}
                onChange={e => setNewEntry(prev => ({ ...prev, intent: e.target.value as VoiceIntent }))}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              >
                {ALL_INTENTS.map(intent => (
                  <option key={intent} value={intent}>{intentLabelPt(intent)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Região</label>
              <select
                value={newEntry.region}
                onChange={e => setNewEntry(prev => ({ ...prev, region: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              >
                {REGIONS.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={addEntry}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-black hover:bg-cyan-400"
          >
            <Save className="h-4 w-4" />
            Salvar Comando
          </button>
        </div>
      )}

      {/* Test Panel */}
      <div className="rounded-xl border border-violet-400/30 bg-violet-500/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TestTube className="h-4 w-4 text-violet-300" />
          <h3 className="text-sm font-bold text-violet-100">Testar Reconhecimento</h3>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={testPhrase}
            onChange={e => setTestPhrase(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && testPhraseRecognition()}
            placeholder='Digite um comando: "manda bala", "bota pressão"...'
            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          />
          <button
            onClick={testPhraseRecognition}
            className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-bold text-black hover:bg-violet-400"
          >
            Testar
          </button>
        </div>

        {testResult && (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3">
            <p className="text-xs font-bold text-emerald-200">✅ Reconhecido!</p>
            <p className="mt-1 text-sm text-white">
              Intent: <span className="font-bold text-emerald-300">{intentLabelPt(testResult.intent)}</span>
            </p>
            <p className="text-xs text-emerald-200/70">{testResult.confidence}</p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar frase..."
            className="w-full rounded-lg border border-white/10 bg-black/40 pl-10 pr-3 py-2 text-sm text-white"
          />
        </div>

        <select
          value={selectedIntent}
          onChange={e => setSelectedIntent(e.target.value as VoiceIntent | 'all')}
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
        >
          <option value="all">Todos os Intents</option>
          {ALL_INTENTS.map(intent => (
            <option key={intent} value={intent}>{intentLabelPt(intent)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Carregando...</p>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] py-8 text-center">
          <p className="text-sm text-gray-500">Nenhum comando encontrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-left text-[10px] uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-3 py-2 font-bold">Frase</th>
                <th className="px-3 py-2 font-bold">Tipo</th>
                <th className="px-3 py-2 font-bold">Intent</th>
                <th className="px-3 py-2 font-bold">Canônico</th>
                <th className="px-3 py-2 font-bold">Região</th>
                <th className="px-3 py-2 text-right font-bold">Confirms</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map(entry => {
                const languageType = LANGUAGE_TYPES.find(t => t.value === entry.language_type);
                const formalityLabel = FORMALITY_LABELS.find(f => f.level === entry.formality_level);
                const contextLabel = CONTEXTS.find(c => c.value === entry.context);

                return (
                  <tr key={entry.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-3 py-2 font-mono text-white">"{entry.phrase}"</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        {languageType && (
                          <span className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold',
                            languageType.color === 'rose' && 'border-rose-400/30 bg-rose-500/10 text-rose-200',
                            languageType.color === 'orange' && 'border-orange-400/30 bg-orange-500/10 text-orange-200',
                            languageType.color === 'yellow' && 'border-yellow-400/30 bg-yellow-500/10 text-yellow-200',
                            languageType.color === 'blue' && 'border-blue-400/30 bg-blue-500/10 text-blue-200',
                            languageType.color === 'purple' && 'border-purple-400/30 bg-purple-500/10 text-purple-200',
                          )}>
                            {languageType.label}
                          </span>
                        )}
                        {contextLabel && (
                          <span className="text-[9px] text-gray-500" title={contextLabel.desc}>
                            {contextLabel.label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                        {intentLabelPt(entry.intent)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-400 italic">"{entry.canonical_phrase}"</td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] text-gray-400">
                        {REGION_LABELS[entry.region || 'BR'] || entry.region || 'BR'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-yellow-400">{entry.confirm_count}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => deleteEntry(entry.id!)}
                        className="rounded p-1 text-rose-300/60 hover:bg-rose-500/15 hover:text-rose-200"
                        title="Remover"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-3">
      <p className="text-[9px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 truncate font-mono text-lg font-black text-white">{value}</p>
    </div>
  );
}
