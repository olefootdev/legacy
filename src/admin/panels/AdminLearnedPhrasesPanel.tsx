/**
 * Admin panel — frases aprendidas pelos managers via "Você quis dizer…? Sim".
 *
 * Serve como backlog pro parser determinístico: as frases que mais pessoas
 * confirmam são as que mais valem a pena virar regex oficial em
 * `intentMatcher.ts`.
 */

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, RefreshCw, Trash2, Filter } from 'lucide-react';
import {
  adminFetchTopLearnedPhrases,
  adminDeleteLearnedPhrase,
  type TopLearnedPhraseRow,
} from '@/supabase/learnedPhrases';
import { intentLabelPt } from '@/voiceCommand/intentGuess';
import type { VoiceIntent } from '@/voiceCommand/types';

const INTENT_OPTIONS: { value: VoiceIntent | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'pass_to_player', label: 'Passa' },
  { value: 'take_shot', label: 'Chuta' },
  { value: 'dribble_attempt', label: 'Drible' },
  { value: 'cross_ball', label: 'Cruzamento' },
  { value: 'invade_box', label: 'Invade área' },
  { value: 'team_press_high', label: 'Pressiona' },
  { value: 'team_retreat', label: 'Recua' },
  { value: 'team_hold_possession', label: 'Posse' },
  { value: 'pedal_to_metal', label: 'Acelera' },
  { value: 'mark_player', label: 'Marca' },
  { value: 'hold_ball', label: 'Segura bola' },
];

export function AdminLearnedPhrasesPanel() {
  const [rows, setRows] = useState<TopLearnedPhraseRow[]>([]);
  const [intent, setIntent] = useState<VoiceIntent | ''>('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const data = await adminFetchTopLearnedPhrases(intent || null, 200);
    setRows(data);
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, [intent]);

  const aggregate = useMemo(() => {
    return {
      totalPhrases: rows.length,
      totalConfirms: rows.reduce((s, r) => s + Number(r.total_confirms), 0),
      uniqueManagers: new Set(rows.flatMap((r) => Array(r.distinct_managers).fill(r.phrase))).size,
      topIntent: (() => {
        const cnt = new Map<string, number>();
        for (const r of rows) cnt.set(r.intent, (cnt.get(r.intent) ?? 0) + Number(r.total_confirms));
        const top = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0];
        return top ? top[0] : null;
      })(),
    };
  }, [rows]);

  const removeRow = async (phrase: string) => {
    if (!window.confirm(`Apagar globalmente a frase "${phrase}"? Isso limpa de todos os managers que a confirmaram.`)) return;
    const n = await adminDeleteLearnedPhrase(phrase);
    setMsg(n > 0 ? `${n} entrada(s) removida(s)` : 'Nada removido');
    window.setTimeout(() => setMsg(null), 2500);
    void refresh();
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <BookOpen className="h-5 w-5 text-cyan-400" />
        <div className="flex-1">
          <h2 className="text-lg font-black text-white">Frases aprendidas</h2>
          <p className="text-[11px] text-gray-400">
            Frases que os managers confirmaram via "Você quis dizer…? Sim". Use pra priorizar quais
            viram regex oficial em <code className="font-mono text-cyan-200">intentMatcher.ts</code>.
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Frases distintas" value={aggregate.totalPhrases.toString()} />
        <Stat label="Confirmações totais" value={aggregate.totalConfirms.toString()} />
        <Stat label="Intent líder" value={aggregate.topIntent ? intentLabelPt(aggregate.topIntent as VoiceIntent) : '—'} />
        <Stat label="Filtro" value={intent ? intentLabelPt(intent) : 'Todos'} />
      </div>

      <div className="flex items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-gray-500" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Por intent</p>
        <div className="flex flex-wrap gap-1">
          {INTENT_OPTIONS.map((o) => (
            <button
              key={o.value || 'all'}
              type="button"
              onClick={() => setIntent(o.value)}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                intent === o.value
                  ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100'
                  : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/25 hover:text-white'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {msg ? <p className="text-[11px] text-cyan-200">{msg}</p> : null}

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-500">Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] py-8 text-center text-sm text-gray-500">
          Nenhuma frase aprendida ainda{intent ? ' para este intent' : ''}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-[11px]">
            <thead className="bg-white/5 text-left text-[9px] uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-3 py-2 font-bold">Frase</th>
                <th className="px-3 py-2 font-bold">Intent</th>
                <th className="px-3 py-2 font-bold">Canônico</th>
                <th className="px-3 py-2 text-right font-bold">Managers</th>
                <th className="px-3 py-2 text-right font-bold">Confirms</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.phrase + r.intent} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-3 py-2 font-mono text-white/90">"{r.phrase}"</td>
                  <td className="px-3 py-2 text-cyan-200">{intentLabelPt(r.intent)}</td>
                  <td className="px-3 py-2 text-gray-400 italic">"{r.canonical_phrase}"</td>
                  <td className="px-3 py-2 text-right font-mono text-white/80">{r.distinct_managers}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-neon-yellow">{r.total_confirms}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(r.phrase)}
                      className="rounded p-1 text-rose-300/60 hover:bg-rose-500/15 hover:text-rose-200"
                      title="Apagar frase aprendida globalmente"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-3">
      <p className="text-[9px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 truncate font-mono text-lg font-black text-white">{value}</p>
    </div>
  );
}
