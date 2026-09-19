/**
 * GlobalLeagueHistory — Rodadas Passadas
 *
 * Lista todas as rodadas finalizadas da Global League com resultados reais.
 * Destaca as partidas do time do manager.
 */

import { useMemo } from 'react';
import { useGameStore } from '@/game/store';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { BackButton } from '@/components/BackButton';
import { Hashtag } from '@/components/ui';
import { ArrowLeft, Trophy, Star } from 'lucide-react';
import type { GlobalFixture } from '@/match/globalMatch';
import type { LeagueRound } from '@/match/globalLeagueMVP';

function formatKickoff(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function HistoryFixtureRow({ fixture, myTeamId }: { fixture: GlobalFixture; myTeamId: string | null }) {
  const isMyMatch = myTeamId && (fixture.homeTeamId === myTeamId || fixture.awayTeamId === myTeamId);
  const isMyHome = myTeamId && fixture.homeTeamId === myTeamId;
  const isMyAway = myTeamId && fixture.awayTeamId === myTeamId;

  let resultLabel = '';
  let resultColor = 'text-cimento';
  if (isMyMatch) {
    const myGoals = isMyHome ? fixture.scoreHome : fixture.scoreAway;
    const theirGoals = isMyHome ? fixture.scoreAway : fixture.scoreHome;
    if (myGoals > theirGoals) { resultLabel = 'V'; resultColor = 'text-alta'; }
    else if (myGoals === theirGoals) { resultLabel = 'E'; resultColor = 'text-giz'; }
    else { resultLabel = 'D'; resultColor = 'text-baixa'; }
  }

  return (
    <div className={`flex h-11 items-center gap-2 px-3 transition-colors ${
      isMyMatch ? 'bg-neon-yellow text-black' : 'bg-deep-black border border-white/[0.06]'
    }`}>
      {/* Resultado do manager */}
      <div className="w-6 shrink-0 text-center">
        {isMyMatch && (
          <span className={`ole-num inline-block bg-black px-1 text-[12px] ${resultColor}`}>{resultLabel}</span>
        )}
      </div>

      {/* Time casa */}
      <div className="flex-1 text-right min-w-0">
        <span className={`block truncate text-[13px] ${isMyMatch ? (isMyHome ? 'font-bold text-black' : 'text-black/70') : 'text-giz'}`}>
          {fixture.homeTeamName}
        </span>
      </div>

      {/* Placar */}
      <div className="flex items-center gap-1 px-2 shrink-0">
        <span className={`ole-num text-[16px] ${isMyMatch ? 'text-black' : 'text-white'}`}>{fixture.scoreHome}</span>
        <span className={`text-xs ${isMyMatch ? 'text-black/60' : 'text-poeira'}`}>×</span>
        <span className={`ole-num text-[16px] ${isMyMatch ? 'text-black' : 'text-white'}`}>{fixture.scoreAway}</span>
      </div>

      {/* Time fora */}
      <div className="flex-1 text-left min-w-0">
        <span className={`block truncate text-[13px] ${isMyMatch ? (isMyAway ? 'font-bold text-black' : 'text-black/70') : 'text-giz'}`}>
          {fixture.awayTeamName}
        </span>
      </div>

      {/* Divisão */}
      <span className={`text-[9.5px] font-mono shrink-0 ${isMyMatch ? 'text-black/70' : 'text-poeira'}`}>Div {fixture.division}</span>
    </div>
  );
}

function RoundSection({ round, myTeamId, index }: { round: LeagueRound; myTeamId: string | null; index: number }) {
  // Fixtures do manager primeiro, depois o resto
  const sorted = useMemo(() => {
    const mine = round.fixtures.filter(f => myTeamId && (f.homeTeamId === myTeamId || f.awayTeamId === myTeamId));
    const others = round.fixtures.filter(f => !myTeamId || (f.homeTeamId !== myTeamId && f.awayTeamId !== myTeamId));
    return [...mine, ...others];
  }, [round.fixtures, myTeamId]);

  const myFixture = sorted.find(f => myTeamId && (f.homeTeamId === myTeamId || f.awayTeamId === myTeamId));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="sports-panel overflow-hidden"
    >
      {/* Header */}
      <div className="bg-deep-black px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-neon-yellow" />
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-giz">
            Rodada {round.roundNumber}
          </span>
          {myFixture && <Star className="w-3 h-3 text-neon-yellow fill-neon-yellow" />}
        </div>
        <span className="text-[10.5px] text-cimento font-mono">
          {formatKickoff(round.scheduledKickoffMs)}
        </span>
      </div>

      {/* Fixtures */}
      <div className="p-3 space-y-1.5">
        {sorted.map((fx) => (
          <HistoryFixtureRow key={fx.id} fixture={fx} myTeamId={myTeamId} />
        ))}
      </div>
    </motion.div>
  );
}

export default function GlobalLeagueHistory() {
  const navigate = useNavigate();
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const club = useGameStore((s) => s.club);

  const managerId = managerProfile?.email ?? club?.id;
  const myTeam = globalLeagueMVP?.teams.find((t) => t.managerId === managerId);
  const myTeamId = myTeam?.id ?? null;

  // Rodadas finalizadas em ordem decrescente (mais recente primeiro)
  const finishedRounds = useMemo(() => {
    if (!globalLeagueMVP) return [];
    const allRounds = [
      ...globalLeagueMVP.playoffRounds.filter(r => r.status === 'finished'),
      ...globalLeagueMVP.leagueRounds.filter(r => r.status === 'finished'),
    ];
    return allRounds.sort((a, b) => b.scheduledKickoffMs - a.scheduledKickoffMs);
  }, [globalLeagueMVP]);

  // Stats do manager nas rodadas passadas
  const myStats = useMemo(() => {
    if (!myTeamId) return null;
    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
    for (const round of finishedRounds) {
      for (const fx of round.fixtures) {
        const isHome = fx.homeTeamId === myTeamId;
        const isAway = fx.awayTeamId === myTeamId;
        if (!isHome && !isAway) continue;
        const gf = isHome ? fx.scoreHome : fx.scoreAway;
        const ga = isHome ? fx.scoreAway : fx.scoreHome;
        goalsFor += gf;
        goalsAgainst += ga;
        if (gf > ga) wins++;
        else if (gf === ga) draws++;
        else losses++;
      }
    }
    return { wins, draws, losses, goalsFor, goalsAgainst, matches: wins + draws + losses };
  }, [finishedRounds, myTeamId]);

  return (
    <div className="mx-auto min-w-0 w-full max-w-4xl space-y-6 overflow-x-hidden px-3 sm:px-4 lg:px-8 py-6 pb-12">
      {/* Header editorial */}
      <div>
        <BackButton to="/match/global" label="Liga Global" />
        <Hashtag className="mt-4 text-neon-yellow">#ligaglobal · arquivo</Hashtag>
        <h1
          className="mt-1 font-impact uppercase text-white leading-[1.1]"
          style={{ fontSize: 'clamp(2rem, 5.5vw, 3rem)', letterSpacing: '0.005em' }}
        >
          Rodadas Passadas
        </h1>
      </div>

      {/* Stats do manager */}
      {myStats && myStats.matches > 0 && (
        <div className="sports-panel p-4 border border-white/10">
          <p className="truncate font-mono text-[10.5px] uppercase tracking-[0.14em] text-cimento mb-2">
            Meu desempenho · {myTeam?.clubName}
          </p>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="text-center">
              <span className="ole-num text-2xl text-neon-yellow">{myStats.matches}</span>
              <p className="font-mono text-[9.5px] text-cimento uppercase">Jogos</p>
            </div>
            <div className="text-center">
              <span className="ole-num text-2xl text-alta">{myStats.wins}</span>
              <p className="font-mono text-[9.5px] text-cimento uppercase">Vitórias</p>
            </div>
            <div className="text-center">
              <span className="ole-num text-2xl text-giz">{myStats.draws}</span>
              <p className="font-mono text-[9.5px] text-cimento uppercase">Empates</p>
            </div>
            <div className="text-center">
              <span className="ole-num text-2xl text-baixa">{myStats.losses}</span>
              <p className="font-mono text-[9.5px] text-cimento uppercase">Derrotas</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <span className="ole-num text-2xl text-white">{myStats.goalsFor}</span>
              <p className="font-mono text-[9.5px] text-cimento uppercase">Gols pró</p>
            </div>
            <div className="text-center">
              <span className="ole-num text-2xl text-cimento">{myStats.goalsAgainst}</span>
              <p className="font-mono text-[9.5px] text-cimento uppercase">Gols contra</p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de rodadas */}
      {finishedRounds.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-cimento text-base">
            Nenhuma rodada finalizada ainda.
          </p>
          <p className="font-mono text-poeira text-[11.5px] mt-2">
            As rodadas são processadas nos slots: 05:30, 11:00, 15:00, 19:00, 21:30 UTC
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {finishedRounds.map((round, index) => (
            <RoundSection key={round.roundNumber + '-' + round.scheduledKickoffMs} round={round} myTeamId={myTeamId} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
