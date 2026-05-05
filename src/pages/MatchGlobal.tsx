/**
 * Match Global — Painel Mundial de Rodadas Simultâneas
 *
 * Design inspirado no BVB (Borussia Dortmund) com identidade Olefoot
 * Adaptado para Global League MVP com 3 divisões
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Zap, Trophy, Activity, Target, Clock, ArrowUp, ArrowDown, ChevronRight } from 'lucide-react';
import type { GlobalFixture } from '@/match/globalMatch';
import { GLOBAL_MATCH_CONSTANTS } from '@/match/globalMatch';
import type { GlobalTeam, GlobalLeagueMVPState, PlayoffRound } from '@/match/globalLeagueMVP';
import { createGlobalTeam, generatePlayoffRounds, GLOBAL_LEAGUE_MVP_CONSTANTS } from '@/match/globalLeagueMVP';
import { SCHEDULER_CONFIG } from '@/match/globalRoundScheduler';

type FilterMode = 'all' | 'division_1' | 'division_2' | 'division_3';

function seedGlobalLeagueMock(dispatch: (a: any) => void) {
  dispatch({ type: 'INIT_GLOBAL_LEAGUE_MVP' });
  const clubs = [
    'Arena FC', 'Neon United', 'Pixel Atlético', 'Olefoot Stars',
    'Legacy Boys', 'Meta Sports', 'Guarda Velha', 'Vermelhão',
    'Lobos Azuis', 'Tigres FC', 'Águias do Sul', 'Rivais Eternos',
    'Real Brasil', 'Cidade Alta', 'Santos do Norte', 'Verdão Clube',
    'Furacão SP', 'Galo Negro', 'Estrela do Mar', 'Trovão Azul',
    'Lanterna FC', 'Comandante', 'Costa Brava', 'Vila Nova',
    'Capital Sul', 'Sertão FC', 'Voador Branco', 'Cometa SC',
    'Trama Azul', 'Olho do Tigre', 'Voo do Falcão', 'Rei do Rio',
  ];
  clubs.forEach((name, i) => {
    const short = name.split(' ').map((s) => s[0]).join('').slice(0, 3).toUpperCase();
    dispatch({
      type: 'REGISTER_GLOBAL_TEAM',
      managerId: `mock_mgr_${i}`,
      clubName: name,
      clubShort: short,
      overall: 60 + Math.floor(Math.random() * 30),
    });
  });
  dispatch({ type: 'ADMIN_START_GLOBAL_PLAYOFFS' });
  dispatch({ type: 'START_GLOBAL_PLAYOFF_ROUND', roundNumber: 1 });
}

const MOCK_CLUBS = [
  'Arena FC', 'Neon United', 'Pixel Atlético', 'Olefoot Stars',
  'Legacy Boys', 'Meta Sports', 'Guarda Velha', 'Vermelhão',
  'Lobos Azuis', 'Tigres FC', 'Águias do Sul', 'Rivais Eternos',
  'Real Brasil', 'Cidade Alta', 'Santos do Norte', 'Verdão Clube',
  'Furacão SP', 'Galo Negro', 'Estrela do Mar', 'Trovão Azul',
  'Lanterna FC', 'Comandante', 'Costa Brava', 'Vila Nova',
  'Capital Sul', 'Sertão FC', 'Voador Branco', 'Cometa SC',
  'Trama Azul', 'Olho do Tigre', 'Voo do Falcão', 'Rei do Rio',
];

function buildMockGlobalLeague(mode: 'live' | 'tactical' | 'finished'): GlobalLeagueMVPState {
  const now = Date.now();
  const teams: GlobalTeam[] = MOCK_CLUBS.map((name, i) => {
    const short = name.split(' ').map((s) => s[0]).join('').slice(0, 3).toUpperCase();
    const t = createGlobalTeam(`mock_mgr_${i}`, name, short, 60 + Math.floor(Math.random() * 30));
    if (mode === 'finished') {
      const r = i % 3;
      t.playoffMatchesPlayed = 1;
      if (r === 0) { t.playoffPoints = 3; t.playoffWins = 1; t.playoffGoalsFor = 2; t.playoffGoalsAgainst = 1; }
      else if (r === 1) { t.playoffPoints = 1; t.playoffDraws = 1; t.playoffGoalsFor = 1; t.playoffGoalsAgainst = 1; }
      else { t.playoffPoints = 0; t.playoffLosses = 1; t.playoffGoalsFor = 0; t.playoffGoalsAgainst = 2; }
    }
    return t;
  });

  const rounds: PlayoffRound[] = generatePlayoffRounds(teams);

  // Reposicionar kickoffs relativos a "agora", baseado no modo escolhido.
  // tactical: kickoff da R1 em ~3min (fase tactical, ~3min restantes).
  // live: kickoff da R1 já há 20s (live, ~40s restantes).
  // finished: R1 acabou há 30s, R2 agendada no próximo top de 5min.
  const r1KickoffOffsetMs =
    mode === 'live' ? -20 * 1000
    : mode === 'finished' ? -90 * 1000
    : 3 * 60 * 1000;
  const interval = GLOBAL_LEAGUE_MVP_CONSTANTS.ROUND_INTERVAL_MS;

  rounds.forEach((r, idx) => {
    r.scheduledKickoffMs = now + r1KickoffOffsetMs + idx * interval;
    if (idx === 0 && mode === 'live') {
      r.status = 'live';
      r.actualKickoffMs = r.scheduledKickoffMs;
      r.fixtures = r.fixtures.map((fx, i) => ({
        ...fx,
        status: 'live' as const,
        kickoffMs: r.actualKickoffMs,
        scoreHome: i === 0 ? 1 : i === 1 ? 0 : 2,
        scoreAway: i === 0 ? 0 : i === 1 ? 0 : 1,
        currentMinute: Math.min(90, Math.floor(20 / GLOBAL_MATCH_CONSTANTS.GAME_MINUTE_MS * 1000)),
      }));
    }
    if (idx === 0 && mode === 'finished') {
      r.status = 'finished';
      r.actualKickoffMs = now - 90 * 1000;
      r.finishedAtMs = now - 30 * 1000;
      r.fixtures = r.fixtures.map((fx, i) => ({
        ...fx,
        status: 'finished' as const,
        kickoffMs: r.actualKickoffMs,
        finishedAtMs: r.finishedAtMs,
        scoreHome: i % 3 === 0 ? 2 : i % 3 === 1 ? 1 : 0,
        scoreAway: i % 3 === 0 ? 1 : i % 3 === 1 ? 1 : 2,
        currentMinute: 90,
      }));
    }
    if (idx === 1 && mode === 'finished') {
      // R2 agendada no próximo top de 5min do relógio
      const intervalMs = 5 * 60 * 1000;
      r.scheduledKickoffMs = Math.ceil((now + 1000) / intervalMs) * intervalMs;
      r.status = 'scheduled';
    }
  });

  return {
    seasonId: `season_${now}`,
    status: 'playoffs',
    teams,
    minTeamsRequired: GLOBAL_LEAGUE_MVP_CONSTANTS.MIN_TEAMS,
    playoffRounds: rounds,
    currentPlayoffRound: mode === 'finished' ? 2 : 1,
    leagueRounds: [],
    teamsPerDivision: Math.ceil(GLOBAL_LEAGUE_MVP_CONSTANTS.MIN_TEAMS / GLOBAL_LEAGUE_MVP_CONSTANTS.DIVISIONS),
    promotionPercentage: GLOBAL_LEAGUE_MVP_CONSTANTS.PROMOTION_PERCENTAGE,
    relegationPercentage: GLOBAL_LEAGUE_MVP_CONSTANTS.RELEGATION_PERCENTAGE,
    createdAt: now,
    lastUpdated: now,
  };
}

function buildMockActiveLeague(): GlobalLeagueMVPState {
  const now = Date.now();
  const teams: GlobalTeam[] = MOCK_CLUBS.map((name, i) => {
    const short = name.split(' ').map((s) => s[0]).join('').slice(0, 3).toUpperCase();
    const t = createGlobalTeam(`mock_mgr_${i}`, name, short, 60 + Math.floor(Math.random() * 30));
    // Distribuir em 3 divisões (~11 cada) — top 11 → div 1, próximos 11 → div 2, resto → div 3
    const division = Math.min(3, Math.floor(i / 11) + 1);
    const positionInDiv = (i % 11) + 1;
    const matches = 4 + Math.floor(Math.random() * 3);
    const wins = Math.floor(Math.random() * (matches + 1));
    const draws = Math.floor(Math.random() * (matches - wins + 1));
    const losses = matches - wins - draws;
    const goalsFor = wins * 2 + draws + Math.floor(Math.random() * 3);
    const goalsAgainst = losses * 2 + draws + Math.floor(Math.random() * 3);
    return {
      ...t,
      division,
      position: positionInDiv,
      previousPosition: positionInDiv + (Math.random() > 0.5 ? -1 : 1),
      matchesPlayed: matches,
      wins,
      draws,
      losses,
      points: wins * 3 + draws,
      goalsFor,
      goalsAgainst,
      goalDifference: goalsFor - goalsAgainst,
      recentForm: Array.from({ length: Math.min(5, matches) }, () => {
        const r = Math.random();
        return r < 0.5 ? 'W' as const : r < 0.75 ? 'D' as const : 'L' as const;
      }),
    };
  });

  return {
    seasonId: `season_${now}`,
    status: 'active',
    teams,
    minTeamsRequired: GLOBAL_LEAGUE_MVP_CONSTANTS.MIN_TEAMS,
    playoffRounds: [],
    leagueRounds: [],
    currentLeagueRound: 5,
    teamsPerDivision: Math.ceil(GLOBAL_LEAGUE_MVP_CONSTANTS.MIN_TEAMS / GLOBAL_LEAGUE_MVP_CONSTANTS.DIVISIONS),
    promotionPercentage: GLOBAL_LEAGUE_MVP_CONSTANTS.PROMOTION_PERCENTAGE,
    relegationPercentage: GLOBAL_LEAGUE_MVP_CONSTANTS.RELEGATION_PERCENTAGE,
    createdAt: now,
    lastUpdated: now,
  };
}

function seedMockBannerLive(dispatch: (a: any) => void) {
  dispatch({ type: 'HYDRATE_GLOBAL_LEAGUE_MVP', payload: buildMockGlobalLeague('live') });
}

function seedMockBannerTactical(dispatch: (a: any) => void) {
  dispatch({ type: 'HYDRATE_GLOBAL_LEAGUE_MVP', payload: buildMockGlobalLeague('tactical') });
}

function seedMockBannerFinished(dispatch: (a: any) => void) {
  dispatch({ type: 'HYDRATE_GLOBAL_LEAGUE_MVP', payload: buildMockGlobalLeague('finished') });
}

function seedMockActive(dispatch: (a: any) => void) {
  dispatch({ type: 'HYDRATE_GLOBAL_LEAGUE_MVP', payload: buildMockActiveLeague() });
}

function FixtureCard({ fixture, index }: { key?: import("react").Key; fixture: GlobalFixture; index: number }) {
  const lastEvent = fixture.events[fixture.events.length - 1];
  const hasGoal = fixture.scoreHome > 0 || fixture.scoreAway > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="sports-panel rounded-lg p-4 hover:border-neon-yellow/30 transition-all group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-soft uppercase tracking-wider font-display">
          Divisão {fixture.division}
        </span>
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-neon-green" />
          <span className="font-serif-hero font-bold text-white text-lg">
            {fixture.currentMinute}'
          </span>
        </div>
      </div>

      {/* Placar */}
      <div className="flex items-center justify-between gap-4 mb-3">
        {/* Time Casa */}
        <div className="flex-1 text-left">
          <p className="font-serif-hero text-xl font-bold text-white truncate group-hover:text-neon-yellow transition-colors uppercase">
            {fixture.homeTeamName}
          </p>
          <p className="text-sm text-text-soft mt-1">
            OVR <span className="text-neon-yellow font-serif-hero font-bold text-xl">{fixture.homeOverall}</span>
          </p>
        </div>

        {/* Placar Central */}
        <div className="flex items-center gap-3 px-4 py-2 bg-deep-black rounded-md border border-white/5">
          <motion.span
            key={`home-${fixture.scoreHome}`}
            initial={{ scale: hasGoal ? 1.5 : 1 }}
            animate={{ scale: 1 }}
            className="font-serif-hero text-5xl font-bold text-neon-yellow"
          >
            {fixture.scoreHome}
          </motion.span>
          <span className="text-text-muted text-2xl">×</span>
          <motion.span
            key={`away-${fixture.scoreAway}`}
            initial={{ scale: hasGoal ? 1.5 : 1 }}
            animate={{ scale: 1 }}
            className="font-serif-hero text-5xl font-bold text-neon-yellow"
          >
            {fixture.scoreAway}
          </motion.span>
        </div>

        {/* Time Visitante */}
        <div className="flex-1 text-right">
          <p className="font-serif-hero text-xl font-bold text-white truncate group-hover:text-neon-yellow transition-colors uppercase">
            {fixture.awayTeamName}
          </p>
          <p className="text-sm text-text-soft mt-1">
            OVR <span className="text-neon-yellow font-serif-hero font-bold text-xl">{fixture.awayOverall}</span>
          </p>
        </div>
      </div>

      {/* Último Evento */}
      <AnimatePresence mode="wait">
        {lastEvent && (
          <motion.div
            key={lastEvent.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="bg-deep-black rounded px-3 py-2 border-l-2 border-l-neon-green"
          >
            <p className="text-xs text-gray-300">
              <span className="font-serif-hero font-bold text-neon-yellow text-sm">
                {lastEvent.minute}'
              </span>{' '}
              {lastEvent.text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DivisionStandings({ division, teams }: { division: number; teams: GlobalTeam[] }) {
  const promotionCount = Math.ceil(teams.length * 0.1);
  const relegationCount = Math.ceil(teams.length * 0.1);

  const divisionColor = division === 1 ? 'neon-yellow' : division === 2 ? 'blue-400' : 'white/60';
  const divisionName = division === 1 ? 'Elite' : division === 2 ? 'Intermediária' : 'Acesso';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sports-panel rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="bg-deep-black px-6 py-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className={`w-5 h-5 text-${divisionColor}`} />
            <div>
              <h3 className="font-display text-base font-bold uppercase tracking-wider text-white">
                Divisão {division}
              </h3>
              <p className="text-xs text-white/60 mt-0.5">{divisionName}</p>
            </div>
          </div>
          <span className={`font-serif-hero text-2xl font-bold text-${divisionColor}`}>
            {teams.length}
          </span>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-black/20">
            <tr className="text-left">
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60">#</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60">Time</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">J</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">V</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">E</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">D</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">SG</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">PTS</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, index) => {
              const isPromotion = division > 1 && index < promotionCount;
              const isRelegation = division < 3 && index >= teams.length - relegationCount;
              const isLeader = index === 0;

              let bgClass = '';
              let borderClass = '';
              if (isLeader) {
                bgClass = 'bg-neon-yellow/10';
                borderClass = 'border-l-4 border-l-neon-yellow';
              } else if (isPromotion) {
                bgClass = 'bg-emerald-500/10';
                borderClass = 'border-l-4 border-l-emerald-500';
              } else if (isRelegation) {
                bgClass = 'bg-red-500/10';
                borderClass = 'border-l-4 border-l-red-500';
              }

              const positionChange = team.previousPosition
                ? team.previousPosition - (team.position || 0)
                : 0;

              return (
                <tr
                  key={team.id}
                  className={`border-t border-white/5 hover:bg-white/5 transition-colors ${bgClass} ${borderClass}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-white/60">{team.position}</span>
                      {positionChange > 0 && (
                        <ArrowUp className="w-3 h-3 text-emerald-400" strokeWidth={3} />
                      )}
                      {positionChange < 0 && (
                        <ArrowDown className="w-3 h-3 text-red-400" strokeWidth={3} />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-display text-sm font-bold text-white">{team.clubName}</p>
                      <p className="text-xs text-white/40">{team.clubShort}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono text-sm text-white/80">{team.matchesPlayed}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono text-sm text-emerald-400">{team.wins}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono text-sm text-amber-400">{team.draws}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono text-sm text-red-400">{team.losses}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-mono text-sm ${
                      team.goalDifference > 0 ? 'text-emerald-400' :
                      team.goalDifference < 0 ? 'text-red-400' : 'text-white/60'
                    }`}>
                      {team.goalDifference > 0 ? '+' : ''}{team.goalDifference}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-serif-hero text-base font-bold text-neon-yellow">{team.points}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div className="bg-black/20 px-6 py-4 border-t border-white/10">
        <div className="flex flex-wrap gap-4 text-xs">
          {division === 1 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-neon-yellow rounded-sm" />
              <span className="text-white/60">Líder</span>
            </div>
          )}
          {division > 1 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
              <span className="text-white/60">Zona de Promoção (Top 10%)</span>
            </div>
          )}
          {division < 3 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-sm" />
              <span className="text-white/60">Zona de Rebaixamento (Bottom 10%)</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function PlayoffRoundStatusBar({ round, totalRounds }: { round: PlayoffRound | undefined; totalRounds: number }) {
  const [countdown, setCountdown] = useState('--:--');

  useEffect(() => {
    const tick = () => {
      const nowMs = Date.now();
      if (!round) { setCountdown('--:--'); return; }

      if (round.status === 'scheduled') {
        const diff = Math.max(0, round.scheduledKickoffMs - nowMs);
        setCountdown(formatMs(diff));
        return;
      }
      if (round.status === 'live' && round.actualKickoffMs) {
        const elapsed = nowMs - round.actualKickoffMs;
        const remaining = Math.max(0, GLOBAL_MATCH_CONSTANTS.ROUND_DURATION_MS - elapsed);
        setCountdown(formatMs(remaining));
        return;
      }
      if (round.status === 'finished' && round.finishedAtMs) {
        const nextIn = Math.max(0, round.finishedAtMs + SCHEDULER_CONFIG.ROUND_INTERVAL_MS - nowMs);
        setCountdown(formatMs(nextIn));
        return;
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [round]);

  if (!round) return null;

  const isLive = round.status === 'live';
  const isFinished = round.status === 'finished';
  const isScheduled = round.status === 'scheduled';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="sports-panel rounded-lg p-4 border border-white/10 flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3">
        {isLive && <Activity className="w-5 h-5 text-neon-green animate-pulse" />}
        {isFinished && <Trophy className="w-5 h-5 text-neon-yellow" />}
        {isScheduled && <Clock className="w-5 h-5 text-white/40" />}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-display">
            {isLive ? 'Ao Vivo' : isFinished ? 'Próxima rodada em' : 'Kickoff em'}
          </p>
          <p className={`font-serif-hero text-2xl font-bold ${isLive ? 'text-neon-green' : isFinished ? 'text-neon-yellow' : 'text-white'}`}>
            {isLive ? `${round.fixtures[0]?.currentMinute ?? 0}'` : countdown}
          </p>
        </div>
      </div>

      {/* Progresso das rodadas */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalRounds }, (_, i) => {
          const r = i + 1;
          const isCurrent = r === round.roundNumber;
          const isDone = r < round.roundNumber;
          return (
            <div
              key={r}
              className={`h-1.5 rounded-full transition-all ${
                isDone ? 'w-4 bg-neon-yellow' :
                isCurrent ? 'w-6 bg-neon-green' :
                'w-4 bg-white/20'
              }`}
            />
          );
        })}
      </div>

      <div className="text-right">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-display">Rodada</p>
        <p className="font-serif-hero text-2xl font-bold text-white">{round.roundNumber}<span className="text-white/30 text-sm">/{totalRounds}</span></p>
      </div>
    </motion.div>
  );
}

/** Mini-tabela compacta de uma divisão projetada (estilo Elifoot). */
function ProjectedDivisionMini({
  division,
  teams,
  totalDivisions,
}: {
  division: number;
  teams: GlobalTeam[];
  totalDivisions: number;
}) {
  const accent = division === 1 ? 'text-neon-yellow' : division === 2 ? 'text-blue-400' : 'text-white/70';
  const accentBg = division === 1 ? 'bg-neon-yellow' : division === 2 ? 'bg-blue-400' : 'bg-white/40';
  const label = division === 1 ? 'Elite' : division === 2 ? 'Intermediária' : 'Acesso';
  const promoCount = Math.max(1, Math.ceil(teams.length * 0.1));
  const releCount = Math.max(1, Math.ceil(teams.length * 0.1));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="sports-panel rounded-lg overflow-hidden"
    >
      <div className="bg-deep-black px-3 py-2 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-1.5 h-4 ${accentBg}`} />
          <h3 className="font-display text-[11px] font-bold uppercase tracking-wider text-white">
            {division}ª Divisão
          </h3>
          <span className="text-[10px] text-white/40">· {label}</span>
        </div>
        <span className={`font-serif-hero text-base font-bold ${accent}`}>{teams.length}</span>
      </div>

      <table className="w-full text-[11px]">
        <thead className="bg-black/30">
          <tr className="text-left text-white/40">
            <th className="px-2 py-1.5 font-display font-bold uppercase tracking-wider w-6">#</th>
            <th className="px-2 py-1.5 font-display font-bold uppercase tracking-wider">Time</th>
            <th className="px-1 py-1.5 font-display font-bold uppercase tracking-wider text-center">J</th>
            <th className="px-1 py-1.5 font-display font-bold uppercase tracking-wider text-center">V</th>
            <th className="px-1 py-1.5 font-display font-bold uppercase tracking-wider text-center">E</th>
            <th className="px-1 py-1.5 font-display font-bold uppercase tracking-wider text-center">D</th>
            <th className="px-1 py-1.5 font-display font-bold uppercase tracking-wider text-center">SG</th>
            <th className="px-2 py-1.5 font-display font-bold uppercase tracking-wider text-center">PTS</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, index) => {
            const sg = team.playoffGoalsFor - team.playoffGoalsAgainst;
            const isLeader = index === 0;
            const isPromotion = division > 1 && index < promoCount;
            const isRelegation = division < totalDivisions && index >= teams.length - releCount;
            let rowBg = '';
            let rowBorder = '';
            if (isLeader) { rowBg = 'bg-neon-yellow/10'; rowBorder = 'border-l-2 border-l-neon-yellow'; }
            else if (isPromotion) { rowBg = 'bg-emerald-500/10'; rowBorder = 'border-l-2 border-l-emerald-500'; }
            else if (isRelegation) { rowBg = 'bg-red-500/10'; rowBorder = 'border-l-2 border-l-red-500'; }
            return (
              <tr key={team.id} className={`border-t border-white/5 ${rowBg} ${rowBorder}`}>
                <td className="px-2 py-1.5"><span className="font-mono text-white/60">{index + 1}</span></td>
                <td className="px-2 py-1.5 truncate">
                  <span className="font-display font-bold text-white truncate">{team.clubName}</span>
                  <span className="text-[10px] text-white/40 ml-1.5">{team.clubShort}</span>
                </td>
                <td className="px-1 py-1.5 text-center font-mono text-white/80">{team.playoffMatchesPlayed}</td>
                <td className="px-1 py-1.5 text-center font-mono text-emerald-400">{team.playoffWins}</td>
                <td className="px-1 py-1.5 text-center font-mono text-amber-400">{team.playoffDraws}</td>
                <td className="px-1 py-1.5 text-center font-mono text-red-400">{team.playoffLosses}</td>
                <td className="px-1 py-1.5 text-center">
                  <span className={`font-mono ${sg > 0 ? 'text-emerald-400' : sg < 0 ? 'text-red-400' : 'text-white/60'}`}>
                    {sg > 0 ? '+' : ''}{sg}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-center font-serif-hero font-bold text-neon-yellow">{team.playoffPoints}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </motion.div>
  );
}

/**
 * Grid de divisões projetadas durante os playoffs (estilo Elifoot).
 * Distribui os times em N divisões (default 3) baseado na pontuação atual,
 * dando um "preview" de onde cada um terminaria se os playoffs acabassem agora.
 */
function ProjectedDivisionsGrid({
  teams,
  roundNumber,
  totalDivisions = 3,
}: {
  teams: GlobalTeam[];
  roundNumber: number;
  totalDivisions?: number;
}) {
  const sorted = [...teams].sort((a, b) => {
    if (b.playoffPoints !== a.playoffPoints) return b.playoffPoints - a.playoffPoints;
    const sgA = a.playoffGoalsFor - a.playoffGoalsAgainst;
    const sgB = b.playoffGoalsFor - b.playoffGoalsAgainst;
    if (sgB !== sgA) return sgB - sgA;
    return b.playoffGoalsFor - a.playoffGoalsFor;
  });

  const teamsPerDivision = Math.ceil(teams.length / totalDivisions);
  const divisions: GlobalTeam[][] = Array.from({ length: totalDivisions }, (_, divIdx) =>
    sorted.slice(divIdx * teamsPerDivision, Math.min((divIdx + 1) * teamsPerDivision, teams.length))
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Trophy className="w-5 h-5 text-neon-yellow" />
        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">
            Classificação · Após rodada {roundNumber}
          </h2>
          <p className="text-[11px] text-white/40 mt-0.5">
            Projeção de divisões caso os playoffs terminassem agora · Top 10% sobe · Bottom 10% desce
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {divisions.map((divTeams, idx) => (
          <ProjectedDivisionMini
            key={idx}
            division={idx + 1}
            teams={divTeams}
            totalDivisions={totalDivisions}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-[10px] text-white/50 px-1">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-neon-yellow rounded-sm" />Líder</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />Promoção projetada</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-500 rounded-sm" />Rebaixamento projetado</span>
      </div>
    </div>
  );
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default function MatchGlobal() {
  const navigate = useNavigate();
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const dispatch = useGameDispatch();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  // Hooks devem ser chamados na mesma ordem em todo render — sem returns antes deles.
  const currentLeagueRound = globalLeagueMVP?.status === 'active'
    ? globalLeagueMVP.leagueRounds.find(r => r.roundNumber === globalLeagueMVP.currentLeagueRound)
    : undefined;
  const filteredFixtures = useMemo(() => {
    if (!currentLeagueRound) return [];
    if (filterMode === 'all') return currentLeagueRound.fixtures;
    const divisionNumber = filterMode.split('_')[1];
    return currentLeagueRound.fixtures.filter(f => f.division === divisionNumber);
  }, [currentLeagueRound, filterMode]);

  // Verificar status da liga
  if (!globalLeagueMVP) {
    return (
      <div className="mx-auto min-w-0 w-full max-w-4xl px-3 sm:px-4 lg:px-6 py-12 text-center">
        <p className="text-white/60 mb-4">Liga LEGACY não inicializada</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={() => navigate('/liga-global/registro')} className="btn-primary">
            Ir para Registro
          </button>
          {import.meta.env.DEV && (
            <>
              <button
                onClick={() => seedGlobalLeagueMock(dispatch)}
                className="inline-flex items-center gap-2 border border-white/20 px-4 py-2 font-display text-[11px] font-black uppercase tracking-[0.2em] text-white/80 hover:bg-white/10 transition-colors"
              >
                Seed mock (dev)
              </button>
              <button
                onClick={() => seedMockBannerLive(dispatch)}
                className="inline-flex items-center gap-2 bg-neon-green text-black px-4 py-2 font-display text-[11px] font-black uppercase tracking-[0.2em] -skew-x-6 hover:bg-white transition-colors"
              >
                Mock AO VIVO (dev)
              </button>
              <button
                onClick={() => seedMockBannerTactical(dispatch)}
                className="inline-flex items-center gap-2 bg-neon-yellow text-black px-4 py-2 font-display text-[11px] font-black uppercase tracking-[0.2em] -skew-x-6 hover:bg-white transition-colors"
              >
                Mock Countdown (dev)
              </button>
              <button
                onClick={() => seedMockBannerFinished(dispatch)}
                className="inline-flex items-center gap-2 bg-white text-black px-4 py-2 font-display text-[11px] font-black uppercase tracking-[0.2em] -skew-x-6 hover:bg-neon-yellow transition-colors"
              >
                Mock Pós-Rodada (dev)
              </button>
              <button
                onClick={() => seedMockActive(dispatch)}
                className="inline-flex items-center gap-2 bg-blue-400 text-black px-4 py-2 font-display text-[11px] font-black uppercase tracking-[0.2em] -skew-x-6 hover:bg-white transition-colors"
              >
                Mock Liga Ativa (dev)
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (globalLeagueMVP.status === 'waiting_teams') {
    return (
      <div className="mx-auto min-w-0 w-full max-w-4xl px-3 sm:px-4 lg:px-6 py-12 text-center">
        <p className="text-white/60 mb-4">
          Aguardando times se cadastrarem ({globalLeagueMVP.teams.length}/{globalLeagueMVP.minTeamsRequired})
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={() => navigate('/liga-global/registro')} className="btn-primary">
            Ver Registro
          </button>
          {import.meta.env.DEV && (
            <>
              <button
                onClick={() => seedGlobalLeagueMock(dispatch)}
                className="inline-flex items-center gap-2 border border-white/20 px-4 py-2 font-display text-[11px] font-black uppercase tracking-[0.2em] text-white/80 hover:bg-white/10 transition-colors"
              >
                Preencher times (dev)
              </button>
              <button
                onClick={() => seedMockBannerLive(dispatch)}
                className="inline-flex items-center gap-2 bg-neon-green text-black px-4 py-2 font-display text-[11px] font-black uppercase tracking-[0.2em] -skew-x-6 hover:bg-white transition-colors"
              >
                Mock AO VIVO (dev)
              </button>
              <button
                onClick={() => seedMockBannerTactical(dispatch)}
                className="inline-flex items-center gap-2 bg-neon-yellow text-black px-4 py-2 font-display text-[11px] font-black uppercase tracking-[0.2em] -skew-x-6 hover:bg-white transition-colors"
              >
                Mock Countdown (dev)
              </button>
              <button
                onClick={() => seedMockBannerFinished(dispatch)}
                className="inline-flex items-center gap-2 bg-white text-black px-4 py-2 font-display text-[11px] font-black uppercase tracking-[0.2em] -skew-x-6 hover:bg-neon-yellow transition-colors"
              >
                Mock Pós-Rodada (dev)
              </button>
              <button
                onClick={() => seedMockActive(dispatch)}
                className="inline-flex items-center gap-2 bg-blue-400 text-black px-4 py-2 font-display text-[11px] font-black uppercase tracking-[0.2em] -skew-x-6 hover:bg-white transition-colors"
              >
                Mock Liga Ativa (dev)
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (globalLeagueMVP.status === 'playoffs') {
    const roundNumber = globalLeagueMVP.currentPlayoffRound ?? 1;
    const round = globalLeagueMVP.playoffRounds.find(r => r.roundNumber === roundNumber);
    const totalRounds = globalLeagueMVP.playoffRounds.length;

    return (
      <div className="mx-auto min-w-0 w-full max-w-7xl space-y-6 overflow-x-hidden px-3 sm:px-4 lg:px-6 pb-6 md:pb-8">
        {/* Hero */}
        <section className="relative w-full overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 text-center"
          >
            <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-black/60 mb-2">
              Playoffs · Rodada {roundNumber} de {totalRounds}
            </p>
            <h1 className="font-display text-4xl sm:text-6xl font-bold uppercase text-black">
              Liga Global
            </h1>
            <p className="font-serif-hero text-xl sm:text-2xl italic text-black/80 mt-2">
              {round?.status === 'live' ? 'Ao Vivo Agora' :
               round?.status === 'finished' ? 'Rodada Encerrada' :
               'Aguardando Kickoff'}
            </p>
          </motion.div>
        </section>

        {/* Status bar da rodada */}
        <PlayoffRoundStatusBar round={round} totalRounds={totalRounds} />

        {/* Jogos ao vivo ou finalizados */}
        {round && (round.status === 'live' || round.status === 'finished') && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              {round.status === 'live' && (
                <span className="flex items-center gap-1.5 bg-neon-green/20 text-neon-green border border-neon-green/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  <Activity className="w-3 h-3 animate-pulse" /> Ao Vivo
                </span>
              )}
              {round.status === 'finished' && (
                <span className="flex items-center gap-1.5 bg-white/10 text-white/60 border border-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  <Trophy className="w-3 h-3" /> Encerrado
                </span>
              )}
              <span className="text-white/40 text-xs font-display uppercase tracking-wider">
                {round.fixtures.length} partidas
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {round.fixtures.map((fixture, index) => (
                <FixtureCard key={fixture.id} fixture={fixture} index={index} />
              ))}
            </div>
          </div>
        )}

        {/* Classificação dos playoffs (pontos acumulados) */}
        {globalLeagueMVP.teams.length > 0 && (
          <ProjectedDivisionsGrid teams={globalLeagueMVP.teams} roundNumber={roundNumber} />
        )}
      </div>
    );
  }

  // Liga ativa - mostrar divisões
  const division1Teams = globalLeagueMVP.teams.filter(t => t.division === 1);
  const division2Teams = globalLeagueMVP.teams.filter(t => t.division === 2);
  const division3Teams = globalLeagueMVP.teams.filter(t => t.division === 3);
  const currentRound = currentLeagueRound;

  return (
    <div className="mx-auto min-w-0 w-full max-w-7xl space-y-6 overflow-x-hidden px-3 sm:px-4 lg:px-6 pb-6 md:pb-8">
      {/* Hero */}
      <section className="relative w-full overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 text-center"
        >
          <h1 className="font-display text-4xl sm:text-6xl font-bold uppercase text-black">
            Liga LEGACY
          </h1>
          <p className="font-serif-hero text-xl sm:text-2xl italic text-black/80 mt-2">
            Rodadas a cada 5min · Temporada 2026
          </p>
        </motion.div>
      </section>

      {/* Filtros */}
      {currentRound && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-4 py-2 rounded-sm font-display text-xs font-bold uppercase tracking-wider transition-all ${
              filterMode === 'all'
                ? 'bg-neon-yellow text-black'
                : 'bg-panel text-white/60 hover:text-white'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilterMode('division_1')}
            className={`px-4 py-2 rounded-sm font-display text-xs font-bold uppercase tracking-wider transition-all ${
              filterMode === 'division_1'
                ? 'bg-neon-yellow text-black'
                : 'bg-panel text-white/60 hover:text-white'
            }`}
          >
            Divisão 1
          </button>
          <button
            onClick={() => setFilterMode('division_2')}
            className={`px-4 py-2 rounded-sm font-display text-xs font-bold uppercase tracking-wider transition-all ${
              filterMode === 'division_2'
                ? 'bg-blue-400 text-black'
                : 'bg-panel text-white/60 hover:text-white'
            }`}
          >
            Divisão 2
          </button>
          <button
            onClick={() => setFilterMode('division_3')}
            className={`px-4 py-2 rounded-sm font-display text-xs font-bold uppercase tracking-wider transition-all ${
              filterMode === 'division_3'
                ? 'bg-white/20 text-white'
                : 'bg-panel text-white/60 hover:text-white'
            }`}
          >
            Divisão 3
          </button>
        </div>
      )}

      {/* Partidas da Rodada Atual */}
      {currentRound && filteredFixtures.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredFixtures.map((fixture, index) => (
            <FixtureCard key={fixture.id} fixture={fixture} index={index} />
          ))}
        </div>
      )}

      {/* Tabelas de Classificação */}
      <div className="space-y-6">
        <DivisionStandings division={1} teams={division1Teams} />
        <DivisionStandings division={2} teams={division2Teams} />
        <DivisionStandings division={3} teams={division3Teams} />
      </div>
    </div>
  );
}
