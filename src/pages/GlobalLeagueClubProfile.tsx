/**
 * GlobalLeagueClubProfile - Perfil publico de um clube na Liga Global
 * Rota: /match/global/club/:teamId
 */

import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Shield } from 'lucide-react';
import type { GlobalFixture } from '@/match/globalMatch';

function FormBadge({ result }: { result: 'W' | 'D' | 'L' }) {
  const map: Record<'W' | 'D' | 'L', { label: string; cls: string }> = {
    W: { label: 'V', cls: 'bg-emerald-500 text-white' },
    D: { label: 'E', cls: 'bg-amber-400 text-black' },
    L: { label: 'D', cls: 'bg-red-500 text-white' },
  };
  const { label, cls } = map[result];
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded font-display font-black text-xs ${cls}`}>
      {label}
    </span>
  );
}

function StatBox({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[48px]">
      <span className={`font-serif-hero text-xl font-bold ${accent ? 'text-neon-yellow' : 'text-white'}`}>
        {value}
      </span>
      <span className="text-[9px] font-display uppercase tracking-wider text-white/40">{label}</span>
    </div>
  );
}

function FixtureRow({ fixture, teamId }: { fixture: GlobalFixture; teamId: string }) {
  const isHome = fixture.homeTeamId === teamId;
  const myGoals = isHome ? fixture.scoreHome : fixture.scoreAway;
  const theirGoals = isHome ? fixture.scoreAway : fixture.scoreHome;
  const opponentName = isHome ? fixture.awayTeamName : fixture.homeTeamName;

  // #4: WO por elenco incompleto — o lado true perdeu por ausência (0×3).
  const myWo = isHome ? fixture.woHome : fixture.woAway;
  const theirWo = isHome ? fixture.woAway : fixture.woHome;

  let resultLabel = '';
  let resultColor = 'text-white/40';
  if (myGoals > theirGoals) { resultLabel = 'V'; resultColor = 'text-emerald-400'; }
  else if (myGoals === theirGoals) { resultLabel = 'E'; resultColor = 'text-amber-400'; }
  else { resultLabel = 'D'; resultColor = 'text-red-400'; }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
      <span className={`w-5 shrink-0 font-display font-black text-sm text-center ${resultColor}`}>
        {resultLabel}
      </span>
      <span className="text-[10px] text-white/30 font-mono shrink-0">{isHome ? 'Casa' : 'Fora'}</span>
      <span className="flex-1 font-display text-xs font-bold text-white/70 truncate uppercase">
        {opponentName}
      </span>
      {(myWo || theirWo) && (
        <span
          className="text-[8px] font-display font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
          style={{
            color: myWo ? 'var(--color-danger)' : 'var(--color-success)',
            border: `1px solid ${myWo ? 'var(--color-danger)' : 'var(--color-success)'}`,
          }}
          title={myWo ? 'Você não tinha elenco mínimo (11)' : 'Adversário não tinha elenco mínimo (11)'}
        >
          {myWo ? 'WO sofrido' : 'WO a favor'}
        </span>
      )}
      <div className="flex items-center gap-1 shrink-0">
        <span className="font-serif-hero text-base font-bold text-neon-yellow">{myGoals}</span>
        <span className="text-white/30 text-xs">x</span>
        <span className="font-serif-hero text-base font-bold text-neon-yellow">{theirGoals}</span>
      </div>
      <span className="text-[9px] text-white/30 font-mono shrink-0">Div {fixture.division}</span>
    </div>
  );
}

export default function GlobalLeagueClubProfile() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);

  const team = useMemo(
    () => globalLeagueMVP?.teams.find((t) => t.id === teamId) ?? null,
    [globalLeagueMVP, teamId],
  );

  const clubFixtures = useMemo(() => {
    if (!globalLeagueMVP || !teamId) return [];
    const allRounds = [
      ...globalLeagueMVP.leagueRounds.filter((r) => r.status === 'finished'),
      ...globalLeagueMVP.playoffRounds.filter((r) => r.status === 'finished'),
    ].sort((a, b) => b.scheduledKickoffMs - a.scheduledKickoffMs);

    const result: GlobalFixture[] = [];
    for (const round of allRounds) {
      for (const fx of round.fixtures) {
        if (fx.homeTeamId === teamId || fx.awayTeamId === teamId) {
          result.push(fx);
        }
      }
    }
    return result;
  }, [globalLeagueMVP, teamId]);

  const divisionLabel = (d?: number) => {
    if (d === 1) return 'Elite';
    if (d === 2) return 'Intermediaria';
    if (d === 3) return 'Acesso';
    return '-';
  };

  if (!team) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <button
          onClick={() => navigate('/match/global')}
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/50 hover:text-neon-yellow transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <p className="font-serif-hero text-xl text-white/40 italic">Clube não encontrado.</p>
      </div>
    );
  }

  const sgSeason = team.goalsFor - team.goalsAgainst;
  // #12 Rivalidade histórica: adversários com 3+ confrontos viram "clássicos".
  const rivals = Object.entries(team.rivalryEncounters ?? {})
    .filter(([, n]) => (n as number) >= 3)
    .map(([oppId, n]) => ({
      id: oppId,
      count: n as number,
      name: globalLeagueMVP?.teams.find((t) => t.id === oppId)?.clubName ?? 'Adversário',
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="mx-auto min-w-0 w-full max-w-4xl space-y-6 overflow-x-hidden px-3 sm:px-4 lg:px-8 py-6 pb-12">

      {/* Back */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/match/global')}
          className="p-2 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5 text-white/70" />
        </button>
        <p className="text-xs text-white/40 font-display uppercase tracking-wider">Liga Global</p>
      </div>

      {/* Header do clube */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="sports-panel rounded-lg p-5 border border-neon-yellow/20"
      >
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-lg bg-neon-yellow/10 border border-neon-yellow/30 flex items-center justify-center shrink-0">
            <Shield className="w-7 h-7 text-neon-yellow" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-bold uppercase text-white truncate">
              {team.clubName}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="font-mono text-sm text-white/50">{team.clubShort}</span>
              <span className="w-px h-4 bg-white/20" />
              <span className="text-xs font-display uppercase tracking-wider text-white/50">
                {divisionLabel(team.division)}
              </span>
              {team.division && (
                <>
                  <span className="w-px h-4 bg-white/20" />
                  <span className="text-xs text-white/40">Divisão {team.division}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="font-serif-hero text-4xl font-bold text-neon-yellow">{team.overall}</span>
            <p className="text-[9px] font-display uppercase tracking-wider text-white/40 mt-0.5">OVR</p>
          </div>
        </div>

        {/* Forma recente */}
        {team.recentForm && team.recentForm.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-[10px] font-display uppercase tracking-wider text-white/40 mb-2">Forma recente</p>
            <div className="flex items-center gap-1.5">
              {team.recentForm.slice(-5).map((r, i) => (
                <FormBadge key={i} result={r} />
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Stats da temporada */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="sports-panel rounded-lg p-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-neon-yellow" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">
            Temporada Atual
          </h2>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <StatBox label="J" value={team.matchesPlayed} />
          <StatBox label="V" value={team.wins} />
          <StatBox label="E" value={team.draws} />
          <StatBox label="D" value={team.losses} />
          <div className="w-px h-10 bg-white/10 self-center hidden sm:block" />
          <StatBox label="GP" value={team.goalsFor} />
          <StatBox label="GC" value={team.goalsAgainst} />
          <StatBox label="SG" value={sgSeason > 0 ? `+${sgSeason}` : sgSeason} />
          <div className="w-px h-10 bg-white/10 self-center hidden sm:block" />
          <StatBox label="PTS" value={team.points} accent />
        </div>
      </motion.div>

      {/* Stats all-time */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="sports-panel rounded-lg p-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-white/50" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">
            All-Time
          </h2>
          <span className="text-[10px] text-white/30 font-mono">
            {team.allTimeSeasonsPlayed ?? 0} temporada(s)
          </span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <StatBox label="Jogos" value={team.allTimeMatchesPlayed} />
          <StatBox label="Vitorias" value={team.allTimeWins} />
          <StatBox label="Empates" value={team.allTimeDraws} />
          <StatBox label="Derrotas" value={team.allTimeLosses} />
          <div className="w-px h-10 bg-white/10 self-center hidden sm:block" />
          <StatBox label="Gols Pro" value={team.allTimeGoalsFor} />
          <StatBox label="Gols Contra" value={team.allTimeGoalsAgainst} />
          <div className="w-px h-10 bg-white/10 self-center hidden sm:block" />
          <StatBox label="PTS Total" value={team.allTimePoints} accent />
        </div>
      </motion.div>

      {/* #12 Rivais históricos — narrativa de confrontos repetidos */}
      {rivals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="sports-panel rounded-lg overflow-hidden"
        >
          <div className="bg-deep-black px-4 py-3 border-b border-white/10">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">Rivais Históricos</h2>
            <p className="text-[10px] text-white/30 mt-0.5">3+ confrontos nesta jornada</p>
          </div>
          <div className="p-3 space-y-1.5">
            {rivals.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => navigate(`/match/global/club/${r.id}`)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 transition-colors text-left"
              >
                <span className="text-[13px] font-bold text-white truncate">{r.name}</span>
                <span className="font-display tabular-nums text-[11px] font-black text-neon-yellow shrink-0">{r.count} duelos</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Histórico de partidas */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="sports-panel rounded-lg overflow-hidden"
      >
        <div className="bg-deep-black px-4 py-3 border-b border-white/10">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">
            Partidas Disputadas
          </h2>
          <p className="text-[10px] text-white/30 mt-0.5">Rodadas finalizadas</p>
        </div>

        {clubFixtures.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-white/40 font-serif-hero italic">Nenhuma partida finalizada ainda.</p>
          </div>
        ) : (
          <div className="p-3 space-y-1.5">
            {clubFixtures.map((fx) => (
              <FixtureRow key={fx.id} fixture={fx} teamId={teamId!} />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
