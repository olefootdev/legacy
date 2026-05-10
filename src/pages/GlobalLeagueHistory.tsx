/**
 * GlobalLeagueHistory — Rodadas Passadas
 *
 * Lista todas as rodadas finalizadas da Global League com resultados reais.
 * Destaca as partidas do time do manager.
 */

import { useMemo } from 'react';
import { useGameStore } from '@/game/store';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  let resultColor = 'text-white/50';
  if (isMyMatch) {
    const myGoals = isMyHome ? fixture.scoreHome : fixture.scoreAway;
    const theirGoals = isMyHome ? fixture.scoreAway : fixture.scoreHome;
    if (myGoals > theirGoals) { resultLabel = 'V'; resultColor = 'text-emerald-400'; }
    else if (myGoals === theirGoals) { resultLabel = 'E'; resultColor = 'text-yellow-400'; }
    else { resultLabel = 'D'; resultColor = 'text-red-400'; }
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
      isMyMatch ? 'bg-neon-yellow/[0.06] border border-neon-yellow/20' : 'bg-white/[0.02] border border-white/5'
    }`}>
      {/* Resultado do manager */}
      <div className="w-6 shrink-0 text-center">
        {isMyMatch && (
          <span className={`font-display font-black text-sm ${resultColor}`}>{resultLabel}</span>
        )}
      </div>

      {/* Time casa */}
      <div className="flex-1 text-right min-w-0">
        <span className={`font-display text-xs font-bold uppercase truncate ${isMyHome ? 'text-neon-yellow' : 'text-white/80'}`}>
          {fixture.homeTeamName}
        </span>
      </div>

      {/* Placar */}
      <div className="flex items-center gap-1 px-2 shrink-0">
        <span className="font-serif-hero text-lg font-bold text-neon-yellow">{fixture.scoreHome}</span>
        <span className="text-white/30 text-xs">×</span>
        <span className="font-serif-hero text-lg font-bold text-neon-yellow">{fixture.scoreAway}</span>
      </div>

      {/* Time fora */}
      <div className="flex-1 text-left min-w-0">
        <span className={`font-display text-xs font-bold uppercase truncate ${isMyAway ? 'text-neon-yellow' : 'text-white/80'}`}>
          {fixture.awayTeamName}
        </span>
      </div>

      {/* Divisão */}
      <span className="text-[9px] text-white/30 font-mono shrink-0">Div {fixture.division}</span>
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
      className="sports-panel rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="bg-deep-black px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-neon-yellow" />
          <span className="font-display text-xs font-bold uppercase tracking-wider text-white">
            Rodada {round.roundNumber}
          </span>
          {myFixture && <Star className="w-3 h-3 text-neon-yellow fill-neon-yellow" />}
        </div>
        <span className="text-[10px] text-white/40 font-mono">
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/match/global')}
          className="p-2 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5 text-white/70" />
        </button>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold uppercase text-white">
            Rodadas Passadas
          </h1>
          <p className="text-xs text-white/50 mt-0.5">
            Resultados oficiais da Liga Global
          </p>
        </div>
      </div>

      {/* Stats do manager */}
      {myStats && myStats.matches > 0 && (
        <div className="sports-panel rounded-lg p-4 border border-neon-yellow/20">
          <p className="text-[10px] font-display font-bold uppercase tracking-wider text-white/40 mb-2">
            Meu desempenho · {myTeam?.clubName}
          </p>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="text-center">
              <span className="font-serif-hero text-2xl font-bold text-neon-yellow">{myStats.matches}</span>
              <p className="text-[9px] text-white/40 uppercase">Jogos</p>
            </div>
            <div className="text-center">
              <span className="font-serif-hero text-2xl font-bold text-emerald-400">{myStats.wins}</span>
              <p className="text-[9px] text-white/40 uppercase">Vitórias</p>
            </div>
            <div className="text-center">
              <span className="font-serif-hero text-2xl font-bold text-yellow-400">{myStats.draws}</span>
              <p className="text-[9px] text-white/40 uppercase">Empates</p>
            </div>
            <div className="text-center">
              <span className="font-serif-hero text-2xl font-bold text-red-400">{myStats.losses}</span>
              <p className="text-[9px] text-white/40 uppercase">Derrotas</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <span className="font-serif-hero text-2xl font-bold text-white">{myStats.goalsFor}</span>
              <p className="text-[9px] text-white/40 uppercase">Gols Pró</p>
            </div>
            <div className="text-center">
              <span className="font-serif-hero text-2xl font-bold text-white/60">{myStats.goalsAgainst}</span>
              <p className="text-[9px] text-white/40 uppercase">Gols Contra</p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de rodadas */}
      {finishedRounds.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/50 font-serif-hero text-lg italic">
            Nenhuma rodada finalizada ainda.
          </p>
          <p className="text-white/30 text-sm mt-2">
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
