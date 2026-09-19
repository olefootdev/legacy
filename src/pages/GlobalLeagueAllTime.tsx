/**
 * GlobalLeagueAllTime - Hall da Fama · Ranking historico entre temporadas
 * Rota: /match/global/all-time
 */

import { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { motion } from 'motion/react';
import { BackButton } from '@/components/BackButton';
import { Hashtag } from '@/components/ui';
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

      {/* Header editorial */}
      <div>
        <BackButton to="/match/global" label="Liga Global" />
        <Hashtag className="mt-4 text-neon-yellow">#ligaglobal · todas as temporadas</Hashtag>
        <h1
          className="mt-1 font-impact uppercase leading-[1.1] text-white"
          style={{ fontSize: 'clamp(2rem, 6vw, 3.25rem)', letterSpacing: '0.005em' }}
        >
          Hall da <span className="text-neon-yellow">Fama</span>
        </h1>
      </div>

      {/* Tabela */}
      {ranked.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-cimento text-base">
            Nenhum time registrado ainda.
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="sports-panel overflow-hidden"
        >
          <div className="bg-deep-black px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Trophy className="w-4 h-4 shrink-0 text-neon-yellow" />
              <span className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-giz">
                Classificação histórica
              </span>
            </div>
            <span className="shrink-0 font-mono text-xs text-cimento">{ranked.length} clubes</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead className="bg-deep-black">
                <tr className="text-left">
                  <th className="px-2 sm:px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento w-10">Pos</th>
                  <th className="px-2 sm:px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento">Clube</th>
                  <th className="px-1 sm:px-3 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento text-center">T</th>
                  <th className="px-1 sm:px-3 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento text-center">J</th>
                  <th className="px-1 sm:px-3 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento text-center">V</th>
                  <th className="px-1 sm:px-3 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento text-center">E</th>
                  <th className="px-1 sm:px-3 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento text-center">D</th>
                  <th className="px-1 sm:px-3 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento text-center">GP</th>
                  <th className="px-1 sm:px-3 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento text-center">GC</th>
                  <th className="px-1 sm:px-3 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento text-center">SG</th>
                  <th className="px-2 sm:px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento text-center">PTS</th>
                  <th className="px-2 sm:px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento text-right"></th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((team, index) => {
                  const isMe = team.id === myTeam?.id;
                  const sg = team.allTimeGoalsFor - team.allTimeGoalsAgainst;
                  const posChange = team.previousPosition ? team.previousPosition - (team.position ?? 0) : 0;
                  const tone = (normal: string) => (isMe ? 'text-black' : normal);

                  return (
                    <tr
                      key={team.id}
                      className={`border-t border-white/[0.06] transition-colors ${
                        isMe ? 'bg-neon-yellow text-black' : 'hover:bg-card'
                      }`}
                    >
                      {/* Pos */}
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <div className="flex items-center gap-1">
                          <span className={`ole-num text-xs sm:text-sm ${tone('text-cimento')}`}>{index + 1}</span>
                          {posChange > 0 && <ArrowUp className={`w-3 h-3 ${tone('text-alta')}`} strokeWidth={3} />}
                          {posChange < 0 && <ArrowDown className={`w-3 h-3 ${tone('text-baixa')}`} strokeWidth={3} />}
                        </div>
                      </td>

                      {/* Clube */}
                      <td className="px-2 sm:px-4 py-2 sm:py-3 max-w-[120px] sm:max-w-none">
                        <div>
                          <p className={`text-xs sm:text-sm truncate ${isMe ? 'font-bold text-black' : 'text-giz'}`}>
                            {team.clubName}
                          </p>
                          <p className={`font-mono text-[10px] ${tone('text-cimento')}`}>{team.clubShort}</p>
                        </div>
                      </td>

                      {/* Temporadas */}
                      <td className="px-1 sm:px-3 py-2 sm:py-3 text-center">
                        <span className={`ole-num text-xs ${tone('text-cimento')}`}>{team.allTimeSeasonsPlayed ?? 0}</span>
                      </td>

                      {/* J */}
                      <td className="px-1 sm:px-3 py-2 sm:py-3 text-center">
                        <span className={`ole-num text-xs ${tone('text-giz')}`}>{team.allTimeMatchesPlayed}</span>
                      </td>

                      {/* V */}
                      <td className="px-1 sm:px-3 py-2 sm:py-3 text-center">
                        <span className={`ole-num text-xs ${tone('text-alta')}`}>{team.allTimeWins}</span>
                      </td>

                      {/* E */}
                      <td className="px-1 sm:px-3 py-2 sm:py-3 text-center">
                        <span className={`ole-num text-xs ${tone('text-cimento')}`}>{team.allTimeDraws}</span>
                      </td>

                      {/* D */}
                      <td className="px-1 sm:px-3 py-2 sm:py-3 text-center">
                        <span className={`ole-num text-xs ${tone('text-baixa')}`}>{team.allTimeLosses}</span>
                      </td>

                      {/* GP */}
                      <td className="px-1 sm:px-3 py-2 sm:py-3 text-center">
                        <span className={`ole-num text-xs ${tone('text-giz')}`}>{team.allTimeGoalsFor}</span>
                      </td>

                      {/* GC */}
                      <td className="px-1 sm:px-3 py-2 sm:py-3 text-center">
                        <span className={`ole-num text-xs ${tone('text-cimento')}`}>{team.allTimeGoalsAgainst}</span>
                      </td>

                      {/* SG */}
                      <td className="px-1 sm:px-3 py-2 sm:py-3 text-center">
                        <span className={`ole-num text-xs ${tone(sg > 0 ? 'text-alta' : sg < 0 ? 'text-baixa' : 'text-cimento')}`}>
                          {sg > 0 ? `+${sg}` : sg}
                        </span>
                      </td>

                      {/* PTS */}
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                        <span className={`ole-num text-base sm:text-lg ${tone('text-white')}`}>
                          {team.allTimePoints}
                        </span>
                      </td>

                      {/* Link perfil */}
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
                        <Link
                          to={`/match/global/club/${team.id}`}
                          className={`font-mono text-[10px] uppercase tracking-[0.12em] transition-colors whitespace-nowrap ${isMe ? 'text-black hover:underline' : 'text-cimento hover:text-neon-yellow'}`}
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
          <div className="bg-deep-black px-4 py-3 border-t border-white/10">
            <div className="flex flex-wrap gap-4 font-mono text-[10.5px]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-neon-yellow" />
                <span className="text-cimento">Seu clube</span>
              </div>
              <span className="text-poeira">T = temporadas · PTS = pontos acumulados</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
