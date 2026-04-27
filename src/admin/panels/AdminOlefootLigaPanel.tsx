/**
 * Admin — Olefoot LIGA MVP
 * Visualiza times cadastrados e permite iniciar playoffs manualmente
 * quando o mínimo de 32 times for atingido.
 */

import { useMemo, useState } from 'react';
import { Trophy, Users, Play, RotateCcw, Activity, Clock } from 'lucide-react';
import { useGameStore, useGameDispatch } from '@/game/store';

const STATUS_LABEL: Record<string, { text: string; tone: string }> = {
  waiting_teams: { text: 'Aguardando times', tone: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  playoffs:      { text: 'Playoffs em andamento', tone: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  active:        { text: 'Liga oficial ativa', tone: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  season_ended:  { text: 'Temporada encerrada', tone: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' },
};

export function AdminOlefootLigaPanel() {
  const dispatch = useGameDispatch();
  const league = useGameStore((s) => s.globalLeagueMVP);
  const [busy, setBusy] = useState(false);

  const sortedTeams = useMemo(() => {
    if (!league) return [];
    return [...league.teams].sort((a, b) => b.overall - a.overall || a.clubName.localeCompare(b.clubName));
  }, [league]);

  if (!league) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <Trophy className="mx-auto mb-3 h-10 w-10 text-white/30" />
        <p className="font-bold text-white/80">Liga MVP ainda não inicializada</p>
        <p className="mt-1 text-xs text-white/50">Dispatch INIT_GLOBAL_LEAGUE_MVP para começar.</p>
        <button
          onClick={() => dispatch({ type: 'INIT_GLOBAL_LEAGUE_MVP' })}
          className="mt-4 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-300 hover:bg-emerald-500/30"
        >
          Inicializar Liga
        </button>
      </div>
    );
  }

  const teamsCount = league.teams.length;
  const minTeams = league.minTeamsRequired;
  const ready = league.status === 'waiting_teams' && teamsCount >= minTeams;
  const status = STATUS_LABEL[league.status] ?? { text: league.status, tone: 'bg-white/10 text-white border-white/20' };

  const handleStartPlayoffs = () => {
    if (!ready || busy) return;
    if (!window.confirm(`Iniciar playoffs com ${teamsCount} times? Serão criadas 6 rodadas (ida e volta).`)) return;
    setBusy(true);
    try {
      dispatch({ type: 'ADMIN_START_GLOBAL_PLAYOFFS' });
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    if (busy) return;
    if (!window.confirm('Resetar a Liga? Todos os times, rodadas e estatísticas serão apagados.')) return;
    setBusy(true);
    try {
      dispatch({ type: 'RESET_GLOBAL_LEAGUE_MVP' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header / status */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Olefoot Liga · MVP</p>
            <h2 className="mt-1 font-display text-xl font-black text-white">{league.seasonId}</h2>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${status.tone}`}>
            <Activity className="mr-1 inline h-3 w-3" /> {status.text}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat icon={Users} label="Times cadastrados" value={`${teamsCount} / ${minTeams}`} highlight={ready} />
          <Stat icon={Trophy} label="Rodada playoff atual" value={String(league.currentPlayoffRound ?? '—')} />
          <Stat icon={Clock} label="Rodada liga atual" value={String(league.currentLeagueRound ?? '—')} />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={handleStartPlayoffs}
            disabled={!ready || busy}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-300 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="h-4 w-4" />
            Iniciar Playoffs
          </button>
          <button
            onClick={handleReset}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-red-500/15 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/25 disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" />
            Resetar Liga
          </button>
        </div>

        {!ready && league.status === 'waiting_teams' && (
          <p className="mt-3 text-xs text-white/50">
            Faltam {Math.max(0, minTeams - teamsCount)} times para liberar os playoffs.
          </p>
        )}
      </div>

      {/* Lista de times */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-black text-white">
            Times participantes
          </h3>
          <span className="text-xs text-white/50">{teamsCount} clube{teamsCount === 1 ? '' : 's'}</span>
        </div>

        {sortedTeams.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/40">
            Nenhum time cadastrado ainda.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.04] text-[10px] uppercase tracking-wider text-white/50">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Clube</th>
                  <th className="px-3 py-2 text-left">Manager</th>
                  <th className="px-3 py-2 text-right">OVR</th>
                  <th className="px-3 py-2 text-right">Cadastrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedTeams.map((team, idx) => (
                  <tr key={team.id} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono text-xs text-white/40">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <span className="font-bold text-white">{team.clubName}</span>
                      <span className="ml-2 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-white/60">
                        {team.clubShort}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-white/60">{team.managerId}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-neon-yellow">{team.overall}</td>
                    <td className="px-3 py-2 text-right text-xs text-white/40">
                      {new Date(team.registeredAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
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

function Stat({ icon: Icon, label, value, highlight }: { icon: typeof Users; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-black/20'}`}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/50">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="mt-1 font-mono text-2xl font-black text-white">{value}</p>
    </div>
  );
}
