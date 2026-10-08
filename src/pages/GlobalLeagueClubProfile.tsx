/**
 * GlobalLeagueClubProfile - Perfil publico de um clube na Liga Global
 * Rota: /match/global/club/:teamId
 */

import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { motion } from 'motion/react';
import { BackButton } from '@/components/BackButton';
import { DEGRAU_CLASSES, degrauDe, SecaoRua, SeloRua } from '@/components/ui/Rua';
import { FormaRua, VazioRua } from '@/components/leagues/RuaTabela';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GlobalFixture } from '@/match/globalMatch';
import { globalDivisionName } from '@/match/globalLeagueMVP';
import { L } from '@/i18n/L';

function StatBox({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 px-3 py-3', accent ? 'border-[3px] border-ouro-27 bg-asfalto-27' : 'bg-concreto')}>
      <span className={cn('truncate font-spray text-[30px] font-black leading-none', accent ? 'text-ouro-27' : 'text-papel')}>{value}</span>
      <span className="truncate font-prova text-[10px] font-bold uppercase tracking-[0.12em] text-mudo">{label}</span>
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

  const res: 'W' | 'D' | 'L' = myGoals > theirGoals ? 'W' : myGoals === theirGoals ? 'D' : 'L';

  return (
    <div className="flex min-h-[48px] min-w-0 items-center gap-3 bg-concreto px-3 py-2">
      <FormaRua form={[res]} />
      <span className="shrink-0 font-prova text-[10px] font-bold uppercase text-mudo">{isHome ? L('Casa', 'Home') : L('Fora', 'Away')}</span>
      <span className="min-w-0 flex-1 truncate font-impact text-[16px] uppercase leading-none text-papel">{opponentName}</span>
      {(myWo || theirWo) && (
        <SeloRua
          tom={myWo ? 'mudo' : 'corre-contorno'}
          className="py-0 text-[9.5px]"
        >
          <span title={myWo ? L('Sem elenco mínimo (11)', 'Lacked the minimum squad (11)') : L('Adversário sem elenco mínimo (11)', 'Opponent lacked the minimum squad (11)')}>
            {myWo ? L('WO sofrido', 'Walkover lost') : L('WO a favor', 'Walkover won')}
          </span>
        </SeloRua>
      )}
      <span className={cn('shrink-0 font-spray text-[22px] font-black leading-none tabular-nums', res === 'W' ? 'text-rua' : res === 'L' ? 'text-mudo' : 'text-papel')}>
        {myGoals}×{theirGoals}
      </span>
      <span className="shrink-0 font-prova text-[10px] font-bold text-mudo">D{fixture.division}</span>
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
      <div className="mx-auto w-full max-w-4xl space-y-6 px-3 py-12 sm:px-4">
        <button
          onClick={() => navigate('/match/global')}
          className="inline-flex items-center gap-2 font-prova text-[12px] font-bold uppercase tracking-[0.16em] text-mudo transition-colors hover:text-rua"
        >
          <ArrowLeft className="h-4 w-4" /> {L('Voltar', 'Back')}
        </button>
        <VazioRua titulo={L('Clube não encontrado', 'Club not found')} frase={L('Esse muro tá vazio.', 'This wall is empty.')} />
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

  const degrau = degrauDe(team.overall);

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-8 overflow-x-hidden px-3 py-6 pb-12 sm:px-4 lg:px-8">
      <BackButton to="/match/global" label={L('Liga Global', 'Global League')} />

      {/* Cabeçalho do clube — o OVR é uma carta na escada (chão/corre/respeito/lenda). */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <SecaoRua label={`${team.clubShort} · ${divisionLabel(team.division)}${team.division ? ` · ${L('Divisão', 'Division')} ${team.division}` : ''}`} />
            <h1 className="font-impact uppercase leading-[0.86] text-papel [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(42px, 12vw, 84px)' }}>
              {team.clubName}
            </h1>
          </div>
          <div className={cn('flex shrink-0 rotate-[2deg] flex-col items-center px-4 py-3 shadow-[4px_4px_0_var(--color-papel)]', DEGRAU_CLASSES[degrau])}>
            <span className="font-impact text-[44px] leading-none">{team.overall}</span>
            <span className="font-prova text-[10px] font-bold uppercase tracking-[0.16em]">OVR</span>
          </div>
        </div>

        {team.recentForm && team.recentForm.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">{L('Forma recente', 'Recent form')}</span>
            <FormaRua form={team.recentForm.slice(-5)} />
          </div>
        )}
      </motion.div>

      {/* Temporada atual */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex min-w-0 flex-col gap-3">
        <SecaoRua label={L('Temporada atual', 'Current season')} />
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          <StatBox label={L('J', 'P')} value={team.matchesPlayed} />
          <StatBox label={L('V', 'W')} value={team.wins} />
          <StatBox label={L('E', 'D')} value={team.draws} />
          <StatBox label={L('D', 'L')} value={team.losses} />
          <StatBox label={L('GP', 'GF')} value={team.goalsFor} />
          <StatBox label={L('GC', 'GA')} value={team.goalsAgainst} />
          <StatBox label={L('SG', 'GD')} value={sgSeason > 0 ? `+${sgSeason}` : sgSeason} />
          <StatBox label="PTS" value={team.points} accent />
        </div>
      </motion.div>

      {/* Histórico */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex min-w-0 flex-col gap-3">
        <SecaoRua label={L('Histórico', 'History')} aside={`${team.allTimeSeasonsPlayed ?? 0} ${L('temporada(s)', 'season(s)')}`} />
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-7">
          <StatBox label={L('Jogos', 'Played')} value={team.allTimeMatchesPlayed} />
          <StatBox label={L('Vitórias', 'Wins')} value={team.allTimeWins} />
          <StatBox label={L('Empates', 'Draws')} value={team.allTimeDraws} />
          <StatBox label={L('Derrotas', 'Losses')} value={team.allTimeLosses} />
          <StatBox label={L('Gols pró', 'Goals for')} value={team.allTimeGoalsFor} />
          <StatBox label={L('Gols contra', 'Goals against')} value={team.allTimeGoalsAgainst} />
          <StatBox label={L('PTS total', 'Total PTS')} value={team.allTimePoints} accent />
        </div>
      </motion.div>

      {/* #12 Rivais históricos — lambe de cal colado torto: o clássico da rua. */}
      {rivals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mx-1 flex -rotate-1 flex-col gap-3 bg-cal p-4 text-asfalto-27 shadow-[4px_4px_0_var(--color-rua)]"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-voz text-[30px] leading-none">{L('Rivais históricos', 'Historic rivals')}</h2>
            <span className="font-prova text-[11px] font-bold">{L('#3+confrontos', '#3+meetings')}</span>
          </div>
          <div className="flex flex-col gap-1">
            {rivals.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => navigate(`/match/global/club/${r.id}`)}
                className="flex w-full min-w-0 items-center justify-between gap-3 border-b-2 border-dashed border-asfalto-27/30 py-2 text-left transition-colors hover:text-asfalto-27/70"
              >
                <span className="min-w-0 truncate font-impact text-[19px] uppercase leading-none">{r.name}</span>
                <span className="shrink-0 font-prova text-[11px] font-bold uppercase">{r.count} {L('duelos', 'meetings')} →</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Partidas disputadas */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex min-w-0 flex-col gap-3">
        <SecaoRua label={L('Partidas disputadas', 'Matches played')} aside={clubFixtures.length > 0 ? clubFixtures.length : undefined} />
        {clubFixtures.length === 0 ? (
          <VazioRua titulo={L('Nenhuma partida finalizada ainda', 'No finished matches yet')} />
        ) : (
          <div className="flex flex-col gap-1.5">
            {clubFixtures.map((fx) => (
              <FixtureRow key={fx.id} fixture={fx} teamId={teamId!} />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
