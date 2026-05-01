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
import { Play, Zap, Trophy, Activity, Target, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import type { GlobalFixture } from '@/match/globalMatch';
import { GLOBAL_MATCH_CONSTANTS } from '@/match/globalMatch';
import type { GlobalTeam, GlobalLeagueMVPState, PlayoffRound } from '@/match/globalLeagueMVP';
import { createGlobalTeam, generatePlayoffRounds, GLOBAL_LEAGUE_MVP_CONSTANTS } from '@/match/globalLeagueMVP';

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

function buildMockGlobalLeague(mode: 'live' | 'tactical'): GlobalLeagueMVPState {
  const now = Date.now();
  const teams: GlobalTeam[] = MOCK_CLUBS.map((name, i) => {
    const short = name.split(' ').map((s) => s[0]).join('').slice(0, 3).toUpperCase();
    return createGlobalTeam(`mock_mgr_${i}`, name, short, 60 + Math.floor(Math.random() * 30));
  });

  const rounds: PlayoffRound[] = generatePlayoffRounds(teams);

  // Reposicionar kickoffs relativos a "agora", baseado no modo escolhido.
  // tactical: kickoff da R1 em ~3min (fase tactical, ~3min restantes).
  // live: kickoff da R1 já há 20s (live, ~40s restantes).
  const r1KickoffOffsetMs = mode === 'live' ? -20 * 1000 : 3 * 60 * 1000;
  const interval = GLOBAL_LEAGUE_MVP_CONSTANTS.ROUND_INTERVAL_MS;

  rounds.forEach((r, idx) => {
    r.scheduledKickoffMs = now + r1KickoffOffsetMs + idx * interval;
    if (idx === 0 && mode === 'live') {
      r.status = 'live';
      r.actualKickoffMs = r.scheduledKickoffMs;
      // Hidratar primeiros fixtures com placar e minuto crescentes para visual
      r.fixtures = r.fixtures.map((fx, i) => ({
        ...fx,
        status: 'live' as const,
        kickoffMs: r.actualKickoffMs,
        scoreHome: i === 0 ? 1 : i === 1 ? 0 : 2,
        scoreAway: i === 0 ? 0 : i === 1 ? 0 : 1,
        currentMinute: Math.min(90, Math.floor(20 / GLOBAL_MATCH_CONSTANTS.GAME_MINUTE_MS * 1000)),
      }));
    }
  });

  return {
    seasonId: `season_${now}`,
    status: 'playoffs',
    teams,
    minTeamsRequired: GLOBAL_LEAGUE_MVP_CONSTANTS.MIN_TEAMS,
    playoffRounds: rounds,
    currentPlayoffRound: 1,
    leagueRounds: [],
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
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                      )}
                      {positionChange < 0 && (
                        <TrendingDown className="w-3 h-3 text-red-400" />
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

export default function MatchGlobal() {
  const navigate = useNavigate();
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const dispatch = useGameDispatch();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

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
            </>
          )}
        </div>
      </div>
    );
  }

  if (globalLeagueMVP.status === 'playoffs') {
    return (
      <div className="mx-auto min-w-0 w-full max-w-4xl px-3 sm:px-4 lg:px-6 py-12 text-center">
        <p className="text-white/60 mb-4">Playoffs em andamento</p>
        <button
          onClick={() => navigate('/liga-global/playoffs')}
          className="btn-primary"
        >
          Ver Playoffs
        </button>
      </div>
    );
  }

  // Liga ativa - mostrar divisões
  const division1Teams = globalLeagueMVP.teams.filter(t => t.division === 1);
  const division2Teams = globalLeagueMVP.teams.filter(t => t.division === 2);
  const division3Teams = globalLeagueMVP.teams.filter(t => t.division === 3);

  const currentRound = globalLeagueMVP.leagueRounds.find(
    r => r.roundNumber === globalLeagueMVP.currentLeagueRound
  );

  const filteredFixtures = useMemo(() => {
    if (!currentRound) return [];
    if (filterMode === 'all') return currentRound.fixtures;
    const divisionNumber = filterMode.split('_')[1];
    return currentRound.fixtures.filter(f => f.division === divisionNumber);
  }, [currentRound, filterMode]);

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
            Rodadas a cada 15min · Temporada 2026
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
