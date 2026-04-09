import { useState } from 'react';
import { ChevronDown, ChevronUp, Database, FileJson, Trash2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  clearAllSportsData,
  importSportsDataJson,
  removeSportsLeague,
  useSportsDataStore,
  type SportsLeague,
} from '@/admin/sportsDataStore';

const SAMPLE_JSON = `{
  "leagues": [
    {
      "id": "brasileirao",
      "name": "Brasileirão Série A",
      "country": "Brazil",
      "season": "2026",
      "clubs": [
        {
          "id": "flamengo",
          "name": "Flamengo",
          "short_name": "FLA",
          "city": "Rio de Janeiro",
          "country": "Brazil"
        }
      ]
    }
  ]
}`;

export function AdminSportsDataPanel() {
  const leagues = useSportsDataStore((s) => s.leagues);
  const [jsonText, setJsonText] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleImport = () => {
    setFeedback(null);
    const trimmed = jsonText.trim();
    if (!trimmed) {
      setFeedback({ kind: 'err', text: 'Cole o JSON antes de importar.' });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      setFeedback({ kind: 'err', text: 'JSON inválido. Verifica a formatação.' });
      return;
    }
    const result = importSportsDataJson(parsed);
    if (result.errors.length > 0) {
      setFeedback({
        kind: result.added + result.updated > 0 ? 'ok' : 'err',
        text: `${result.added} adicionada(s), ${result.updated} atualizada(s). ${result.errors.length} aviso(s): ${result.errors.slice(0, 3).join(' · ')}${result.errors.length > 3 ? '…' : ''}`,
      });
    } else {
      setFeedback({
        kind: 'ok',
        text: `Importação concluída: ${result.added} nova(s), ${result.updated} atualizada(s).`,
      });
      setJsonText('');
    }
  };

  const handleClear = () => {
    if (!window.confirm('Eliminar todas as ligas e clubes do Sports Data?')) return;
    clearAllSportsData();
    setFeedback({ kind: 'ok', text: 'Todos os dados foram removidos.' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-black uppercase tracking-wide">
            <Database className="h-5 w-5 text-neon-yellow" />
            Sports Data
          </h2>
          <p className="mt-1 max-w-xl text-sm text-white/50">
            Base curada de ligas e clubes reais. Os dados são guardados localmente e usados no onboarding
            («time do coração»). Importa um JSON com o formato esperado.
          </p>
        </div>
        {leagues.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold uppercase text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar tudo
          </button>
        )}
      </div>

      {/* Import JSON */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
          <FileJson className="h-4 w-4" />
          Importar JSON
        </div>
        <textarea
          className="w-full min-h-[160px] rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-xs text-white placeholder:text-white/25 focus:border-neon-yellow/50 focus:outline-none focus:ring-1 focus:ring-neon-yellow/30"
          placeholder={SAMPLE_JSON}
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setFeedback(null);
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleImport}
            className="flex items-center gap-2 rounded-lg bg-neon-yellow px-4 py-2.5 font-display text-xs font-black uppercase tracking-wide text-black hover:bg-white"
          >
            <Upload className="h-4 w-4" />
            Import Data
          </button>
          {feedback && (
            <p
              className={cn(
                'text-xs font-medium',
                feedback.kind === 'ok' ? 'text-emerald-400' : 'text-red-300',
              )}
            >
              {feedback.text}
            </p>
          )}
        </div>
      </div>

      {/* Listing */}
      {leagues.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
          <p className="text-sm text-white/40">Nenhuma liga importada. Cole o JSON acima para começar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40">
            {leagues.length} liga(s) · {leagues.reduce((n, l) => n + l.clubs.length, 0)} clube(s)
          </h3>
          {leagues.map((league) => (
            <LeagueCard
              key={league.id}
              league={league}
              expanded={expandedId === league.id}
              onToggle={() => setExpandedId(expandedId === league.id ? null : league.id)}
              onRemove={() => {
                removeSportsLeague(league.id);
                if (expandedId === league.id) setExpandedId(null);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LeagueCard({
  league,
  expanded,
  onToggle,
  onRemove,
}: {
  key?: string;
  league: SportsLeague;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.04]"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-bold text-white">{league.name}</span>
            <span className="rounded border border-white/15 px-2 py-0.5 text-[9px] font-bold uppercase text-white/50">
              {league.country}
            </span>
            {league.season && (
              <span className="text-[9px] font-bold text-white/30">{league.season}</span>
            )}
          </div>
          <p className="text-xs text-white/40">
            {league.clubs.length} clube(s) · id: <code className="text-neon-yellow/60">{league.id}</code>
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-white/40" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-white/40" />
        )}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-white/10 p-4">
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[400px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase text-white/40">
                  <th className="px-3 py-2">Clube</th>
                  <th className="px-3 py-2">Sigla</th>
                  <th className="px-3 py-2">Cidade</th>
                  <th className="px-3 py-2">ID</th>
                </tr>
              </thead>
              <tbody>
                {league.clubs.map((club) => (
                  <tr key={club.id} className="border-b border-white/5">
                    <td className="px-3 py-2 font-medium text-white">{club.name}</td>
                    <td className="px-3 py-2 text-white/60">{club.short_name}</td>
                    <td className="px-3 py-2 text-white/50">{club.city}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-white/30">{club.id}</td>
                  </tr>
                ))}
                {league.clubs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-white/30">
                      Nenhum clube nesta liga.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Remover "${league.name}" e todos os seus clubes?`)) onRemove();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold uppercase text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remover liga
          </button>
        </div>
      )}
    </div>
  );
}
