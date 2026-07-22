/**
 * GlobalLeagueAllTime - Hall da Fama · Ranking historico entre temporadas
 * Rota: /match/global/all-time
 */

import { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, ArrowUp, ArrowDown } from 'lucide-react';

export default function GlobalLeagueAllTime() {
  const navigate = useNavigate();
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const club = useGameStore((s) => s.club);

  const managerId = managerProfile?.email ?? club?.id;
  const myTeam = globalLeagueMVP?.teams.find((t) => t.managerId === managerId);

  const ranked = useMemo(() => {
    if (!globalLeagueMVP) return [];
    return [...globalLeagueMVP.teams].sort((a, b) => {
      if (b.allTimePoints !== a.allTimePoints) return b.allTimePoints - a.allTimePoints;
      if (b.allTimeWins !== a.allTimeWins) return b.allTimeWins - a.allTimeWins;
      const sgA = a.allTimeGoalsFor - a.allTimeGoalsAgainst;
      const sgB = b.allTimeGoalsFor - b.allTimeGoalsAgainst;
      if (sgB !== sgA) return sgB - sgA;
      return a.clubName.localeCompare(b.clubName);
    });
  }, [globalLeagueMVP]);

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
            Hall da Fama
          </h1>
          <p className="text-xs text-white/50 mt-0.5 flex items-center gap-1.5">
            <Trophy className="w-3 h-3 text-neon-yellow" />
            Ranking All-Time · todas as temporadas
          </p>
        </div>
      </div>

      {/* Tabela */}
      {ranked.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/50 font-serif-hero text-lg italic">
            Nenhum time registrado ainda.
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="sports-panel rounded-lg overflow-hidden"
        >
          <div className="bg-deep-black px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-neon-yellow" />
              <span className="font-display text-xs font-bold uppercase tracking-wider text-white">
                Classificação Histórica
              </span>
            </div>
            <span className="font-mono text-xs text-white/40">{ranked.length} clubes</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead className="bg-black/20">
                <tr className="text-left">
                  <th className="px-2 sm:px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 w-10">Pos</th>
                  <th className="px-2 sm:px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60">Clube</th>
                  <th className="px-1 sm:px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">T</th>
                  <th className="px-1 sm:px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">J</th>
                  <th className="px-1 sm:px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">V</th>
                  <th className="px-1 sm:px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">E</th>
                  <th className="px-1 sm:px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">D</th>
                  <th className="px-1 sm:px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">GP</th>
                  <th className="px-1 sm:px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">GC</th>
                  <th className="px-1 sm:px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">SG</th>
                  <th className="px-2 sm:px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-center">PTS</th>
                  <th className="px-2 sm:px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/60 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((team, index) => {
                  const isMe = team.id === myTeam?.id;
                  const sg = team.allTimeGoalsFor - team.allTimeGoalsAgainst;
                  const posChange = team.previousPosition ? team.previousPosition - (team.position ?? 0) : 0;

                  return (
                    <tr
                      key={team.id}
                      className={`border-t border-white/5 transition-colors ${
                        isMe
                          ? 'bg-neon-yellow/[0.06] border-l-4 border-l-neon-yellow hover:bg-neon-yellow/10'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      {/* Pos */}
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs sm:text-sm text-white/60">{index + 1}</span>
                          {posChange > 0 && <ArrowUp className="w-3 h-3 text-emerald-400" strokeWidth={3} />}
                          {posChange < 0 && <ArrowDown className="w-3 h-3 text-red-400" strokeWidth={3} />}
                        </div>
                      </td>

                      {/* Clube */}
                      <td className="px-2 sm:px-4 py-2 sm:py-3 max-w-[120px] sm:max-w-none">
                        <div>
                          <p className={`font-display text-xs sm:text-sm font-bold truncate ${isMe ? 'text-neon-yellow' : 'text-white'}`}>
                            {team.clubName}
                          </p>
                          <p className="text-[10px] text-white/40">{team.clubShort}</p>
                        </div>
                      </td>

                      {/* Temporadas */}
                      <td className="px-1 sm:px-3 py-2 sm:py-3 text-center">
                        <span className="font-mono text-xs text-white/60">{team.allTimeSeasonsPlayed ?? 0}</span>
                      </td>

                      {/* J */}
                      <td className="px-1 sm:px-3 py-2 sm:py-3 text-center">
                        <span className="font-mono text-xs text-white/80">{team.allTimeMatchesPlayed}</span>
                      </td>

                      {/* V */}
                      <td className="px-1 sm:px-3 py-2 sm:py-3 text-center">
                        <span className="font-mono text-xs text-emerald-400">{team.allTimeWins}</span>
                      </td>

                      {/* E */}
                      <td className="px-1 sm:px-3 py-2 sm:py-3 text-center">
                        <span className="font-mono text-xs text-amber-400">{team.allTimeDraws}</span>
                      </td>

                      {/* D */}
                      <td className="px-1 sm:px-3 py-2 sm:py-3 text-center">
                        <span className="font-mono text-xs text-red-400">{team.allTimeLosses}</span>
                      </td>

                      {/* GP */}
                      <td className="px-1 sm:px-3 py-2 sm:py-3 text-center">
                        <span className="font-mono text-xs text-white/70">{team.allTimeGoalsFor}</span>
                      </td>

                      {/* GC */}
                      <td className="px-1 sm:px-3 py-2 sm:py-3 text-center">
                        <span className="font-mono text-xs text-white/50">{team.allTimeGoalsAgainst}</span>
                      </td>

                      {/* SG */}
                      <td className="px-1 sm:px-3 py-2 sm:py-3 text-center">
                        <span className={`font-mono text-xs ${sg > 0 ? 'text-emerald-400' : sg < 0 ? 'text-red-400' : 'text-white/50'}`}>
                          {sg > 0 ? `+${sg}` : sg}
                        </span>
                      </td>

                      {/* PTS */}
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                        <span className="font-serif-hero text-base sm:text-lg font-bold text-neon-yellow">
                          {team.allTimePoints}
                        </span>
                      </td>

                      {/* Link perfil */}
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
                        <Link
                          to={`/match/global/club/${team.id}`}
                          className="text-[10px] font-display uppercase tracking-wider text-white/40 hover:text-neon-yellow transition-colors whitespace-nowrap"
                        >
                          Ver perfil
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legenda */}
          <div className="bg-black/20 px-4 py-3 border-t border-white/10">
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-neon-yellow rounded-sm" />
                <span className="text-white/60">Seu clube</span>
              </div>
              <span className="text-white/30">T = Temporadas · PTS = Pontos acumulados all-time</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
