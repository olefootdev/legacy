/**
 * GlobalLeagueClubProfile - Perfil publico de um clube na Liga Global
 * Rota: /match/global/club/:teamId
 */

import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { motion } from 'motion/react';
import { BackButton } from '@/components/BackButton';
import { Hashtag } from '@/components/ui';
import { ArrowLeft, Trophy, Shield } from 'lucide-react';
import type { GlobalFixture } from '@/match/globalMatch';
import { globalDivisionName } from '@/match/globalLeagueMVP';
import { L } from '@/i18n/L';

function FormBadge({ result }: { result: 'W' | 'D' | 'L' }) {
  const map: Record<'W' | 'D' | 'L', { label: string; cls: string }> = {
    W: { label: L('V', 'W'), cls: 'bg-alta text-black' },
    D: { label: L('E', 'D'), cls: 'bg-card-hi text-white' },
    L: { label: L('D', 'L'), cls: 'bg-baixa text-white' },
  };
  const { label, cls } = map[result];
  return (
    <span className={`ole-num inline-flex items-center justify-center w-7 h-7 text-xs ${cls}`}>
      {label}
    </span>
  );
}

function StatBox({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[48px]">
      <span className={`ole-num text-xl ${accent ? 'text-neon-yellow' : 'text-white'}`}>
        {value}
      </span>
      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-cimento">{label}</span>
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
  let resultColor = 'text-cimento';
  if (myGoals > theirGoals) { resultLabel = L('V', 'W'); resultColor = 'text-alta'; }
  else if (myGoals === theirGoals) { resultLabel = L('E', 'D'); resultColor = 'text-cimento'; }
  else { resultLabel = L('D', 'L'); resultColor = 'text-baixa'; }

  return (
    <div className="flex min-w-0 items-center gap-3 px-3 py-2 bg-deep-black border border-white/[0.06] hover:border-white/16 transition-colors">
      <span className={`ole-num w-5 shrink-0 text-sm text-center ${resultColor}`}>
        {resultLabel}
      </span>
      <span className="text-[10px] text-poeira font-mono shrink-0">{isHome ? L('Casa', 'Home') : L('Fora', 'Away')}</span>
      <span className="min-w-0 flex-1 text-[13px] text-giz truncate">
        {opponentName}
      </span>
      {(myWo || theirWo) && (
        <span
          className={`shrink-0 border px-[5px] py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${myWo ? 'border-baixa text-baixa' : 'border-alta text-alta'}`}
          title={myWo ? L('Você não tinha elenco mínimo (11)', 'You lacked the minimum squad (11)') : L('Adversário não tinha elenco mínimo (11)', 'Opponent lacked the minimum squad (11)')}
        >
          {myWo ? L('WO sofrido', 'Walkover lost') : L('WO a favor', 'Walkover won')}
        </span>
      )}
      <div className="flex items-center gap-1 shrink-0">
        <span className="ole-num text-base text-white">{myGoals}</span>
        <span className="text-poeira text-xs">x</span>
        <span className="ole-num text-base text-white">{theirGoals}</span>
      </div>
      <span className="text-[9.5px] text-poeira font-mono shrink-0">Div {fixture.division}</span>
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

  const divisionLabel = (d?: number) => globalDivisionName(d);

  if (!team) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <button
          onClick={() => navigate('/match/global')}
          className="mb-6 inline-flex items-center gap-2 text-sm text-cimento hover:text-neon-yellow transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {L('Voltar', 'Back')}
        </button>
        <p className="text-lg text-cimento">{L('Clube não encontrado.', 'Club not found.')}</p>
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
      name: globalLeagueMVP?.teams.find((t) => t.id === oppId)?.clubName ?? L('Adversário', 'Opponent'),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="mx-auto min-w-0 w-full max-w-4xl space-y-6 overflow-x-hidden px-3 sm:px-4 lg:px-8 py-6 pb-12">

      {/* Back */}
      <BackButton to="/match/global" label={L('Liga Global', 'Global League')} />

      {/* Header do clube */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="sports-panel p-5 border border-white/10"
      >
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-card border border-white/10 flex items-center justify-center shrink-0">
            <Shield className="w-7 h-7 text-neon-yellow" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-impact text-2xl sm:text-3xl uppercase leading-[1.1] text-white truncate">
              {team.clubName}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="font-mono text-sm text-cimento">{team.clubShort}</span>
              <span className="w-px h-4 bg-white/16" />
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-cimento">
                {divisionLabel(team.division)}
              </span>
              {team.division && (
                <>
                  <span className="w-px h-4 bg-white/16" />
                  <span className="font-mono text-[11px] text-poeira">{L('Divisão', 'Division')} {team.division}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="ole-num text-4xl text-neon-yellow">{team.overall}</span>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-cimento mt-0.5">OVR</p>
          </div>
        </div>

        {/* Forma recente */}
        {team.recentForm && team.recentForm.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-cimento mb-2">{L('Forma recente', 'Recent form')}</p>
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
        className="sports-panel p-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-neon-yellow" />
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-giz">
            {L('Temporada atual', 'Current season')}
          </h2>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <StatBox label={L('J', 'P')} value={team.matchesPlayed} />
          <StatBox label={L('V', 'W')} value={team.wins} />
          <StatBox label={L('E', 'D')} value={team.draws} />
          <StatBox label={L('D', 'L')} value={team.losses} />
          <div className="w-px h-10 bg-white/10 self-center hidden sm:block" />
          <StatBox label={L('GP', 'GF')} value={team.goalsFor} />
          <StatBox label={L('GC', 'GA')} value={team.goalsAgainst} />
          <StatBox label={L('SG', 'GD')} value={sgSeason > 0 ? `+${sgSeason}` : sgSeason} />
          <div className="w-px h-10 bg-white/10 self-center hidden sm:block" />
          <StatBox label="PTS" value={team.points} accent />
        </div>
      </motion.div>

      {/* Stats all-time */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="sports-panel p-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-cimento" />
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-giz">
            {L('Histórico', 'History')}
          </h2>
          <span className="text-[10.5px] text-cimento font-mono">
            {team.allTimeSeasonsPlayed ?? 0} {L('temporada(s)', 'season(s)')}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <StatBox label={L('Jogos', 'Played')} value={team.allTimeMatchesPlayed} />
          <StatBox label={L('Vitórias', 'Wins')} value={team.allTimeWins} />
          <StatBox label={L('Empates', 'Draws')} value={team.allTimeDraws} />
          <StatBox label={L('Derrotas', 'Losses')} value={team.allTimeLosses} />
          <div className="w-px h-10 bg-white/10 self-center hidden sm:block" />
          <StatBox label={L('Gols pró', 'Goals for')} value={team.allTimeGoalsFor} />
          <StatBox label={L('Gols contra', 'Goals against')} value={team.allTimeGoalsAgainst} />
          <div className="w-px h-10 bg-white/10 self-center hidden sm:block" />
          <StatBox label={L('PTS total', 'Total PTS')} value={team.allTimePoints} accent />
        </div>
      </motion.div>

      {/* #12 Rivais históricos — narrativa de confrontos repetidos */}
      {rivals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="sports-panel overflow-hidden"
        >
          <div className="bg-deep-black px-4 py-3 border-b border-white/10">
            <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-giz">{L('Rivais históricos', 'Historic rivals')}</h2>
            <Hashtag className="mt-0.5">{L('#3+confrontos', '#3+meetings')}</Hashtag>
          </div>
          <div className="p-3 space-y-1.5">
            {rivals.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => navigate(`/match/global/club/${r.id}`)}
                className="w-full flex min-w-0 items-center justify-between gap-3 px-3 py-2 bg-deep-black border border-white/[0.06] hover:border-white/30 transition-colors text-left"
              >
                <span className="min-w-0 text-[13px] font-bold text-white truncate">{r.name}</span>
                <span className="ole-num text-[11px] uppercase text-neon-yellow shrink-0">{r.count} {L('duelos', 'meetings')}</span>
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
        className="sports-panel overflow-hidden"
      >
        <div className="bg-deep-black px-4 py-3 border-b border-white/10">
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-giz">
            {L('Partidas disputadas', 'Matches played')}
          </h2>
        </div>

        {clubFixtures.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-cimento">{L('Nenhuma partida finalizada ainda.', 'No finished matches yet.')}</p>
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
