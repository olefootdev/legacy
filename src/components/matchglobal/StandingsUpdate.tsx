import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Minus, Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import type { GlobalTeam as GlobalLeagueTeam } from '../../match/globalLeagueMVP';

interface StandingsUpdateProps {
  isOpen: boolean;
  onClose: () => void;
  roundNumber: number;
  divisions: {
    division: number;
    teams: GlobalLeagueTeam[];
  }[];
}

export function StandingsUpdate({ isOpen, onClose, roundNumber, divisions }: StandingsUpdateProps) {
  const getPositionChange = (team: GlobalLeagueTeam) => {
    if (!team.previousPosition) return 0;
    return team.previousPosition - team.position;
  };

  const getPositionChangeIcon = (change: number) => {
    if (change > 0) return <ChevronUp className="w-4 h-4 text-neon-green" />;
    if (change < 0) return <ChevronDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getTeamRowClass = (team: GlobalLeagueTeam, divisionSize: number) => {
    const change = getPositionChange(team);
    const position = team.position;

    // Rebaixamento (últimos 10% ≈ 3 em 30) — vermelho com opacidade
    if (position > divisionSize - 3) return 'bg-red-600/30 border-l-4 border-red-500/70';

    // Promoção (top 10% ≈ 3 em 30) — borda amarela
    if (position <= 3) return 'bg-neon-yellow/[0.04] border-l-4 border-neon-yellow';

    // Líder em destaque (override só visual de posição 1)
    if (position === 1) return 'bg-neon-yellow/10 border-l-4 border-neon-yellow';

    // Subiu muito (3+ posições)
    if (change >= 3) return 'bg-neon-yellow/[0.04] border-l-2 border-neon-yellow/50';

    // Caiu muito (3+ posições)
    if (change <= -3) return 'bg-red-500/10 border-l-2 border-red-500/50';

    return 'border-l-2 border-transparent';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-[95vw] max-w-7xl max-h-[90vh] overflow-auto bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-lg border-2 border-neon-yellow/30 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-gradient-to-r from-neon-yellow/20 to-neon-green/20 border-b-2 border-neon-yellow/50 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trophy className="w-8 h-8 text-neon-yellow" />
                  <div>
                    <h2 className="text-2xl font-bold text-neon-yellow uppercase tracking-wider">
                      CLASSIFICAÇÃO
                    </h2>
                    <p className="text-sm text-gray-300 font-mono">
                      {roundNumber}ª JORNADA
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-neon-yellow/20 hover:bg-neon-yellow/30 border border-neon-yellow/50 rounded text-neon-yellow font-bold uppercase tracking-wider transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Divisions Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
              {divisions.map((div) => (
                <motion.div
                  key={div.division}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: div.division * 0.1 }}
                  className="sports-panel"
                >
                  {/* Division Header */}
                  <div className="bg-gradient-to-r from-neon-yellow/30 to-neon-green/30 border-b-2 border-neon-yellow/50 px-4 py-3">
                    <h3 className="text-lg font-bold text-neon-yellow uppercase tracking-wider text-center">
                      {div.division}ª DIVISÃO
                    </h3>
                  </div>

                  {/* Table Header */}
                  <div className="grid grid-cols-[40px_1fr_40px_40px_40px_50px_50px] gap-2 px-4 py-2 bg-gray-800/50 border-b border-gray-700 text-xs font-mono text-gray-400 uppercase">
                    <div className="text-center">#</div>
                    <div>Time</div>
                    <div className="text-center">J</div>
                    <div className="text-center">V</div>
                    <div className="text-center">E</div>
                    <div className="text-center">SG</div>
                    <div className="text-center font-bold">PTS</div>
                  </div>

                  {/* Teams */}
                  <div className="divide-y divide-gray-700/50">
                    {div.teams.map((team, idx) => {
                      const change = getPositionChange(team);
                      return (
                        <motion.div
                          key={team.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: div.division * 0.1 + idx * 0.05 }}
                          className={`grid grid-cols-[40px_1fr_40px_40px_40px_50px_50px] gap-2 px-4 py-3 hover:bg-gray-700/30 transition-colors ${getTeamRowClass(team, div.teams.length)}`}
                        >
                          {/* Position + Change */}
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-sm font-bold text-gray-300 font-mono">
                              {team.position}
                            </span>
                            {getPositionChangeIcon(change)}
                          </div>

                          {/* Team Name */}
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-bold text-white truncate">
                              {team.clubName}
                            </span>
                            {change !== 0 && (
                              <span className={`text-xs font-mono ${change > 0 ? 'text-neon-green' : 'text-red-400'}`}>
                                {change > 0 ? '+' : ''}{change}
                              </span>
                            )}
                          </div>

                          {/* Stats */}
                          <div className="text-center text-sm font-mono text-gray-300">
                            {team.matchesPlayed}
                          </div>
                          <div className="text-center text-sm font-mono text-neon-green">
                            {team.wins}
                          </div>
                          <div className="text-center text-sm font-mono text-gray-400">
                            {team.draws}
                          </div>
                          <div className="text-center text-sm font-mono text-gray-300">
                            {team.goalsFor - team.goalsAgainst > 0 ? '+' : ''}{team.goalsFor - team.goalsAgainst}
                          </div>
                          <div className="flex flex-col items-center leading-tight">
                            <span
                              className="text-base font-bold font-mono text-neon-yellow"
                              title={`Total acumulado em ${team.allTimeSeasonsPlayed ?? 0} temporada(s)`}
                            >
                              {team.allTimePoints ?? 0}
                            </span>
                            <span className="font-mono text-[9px] text-white/40 mt-0.5">
                              {team.points} (rodada)
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Division Footer - Legend */}
                  <div className="px-4 py-3 bg-gray-800/30 border-t border-gray-700 space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-neon-yellow/20 border-l-2 border-neon-yellow"></div>
                      <span className="text-gray-400">Líder</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-neon-green/10 border-l-2 border-neon-green"></div>
                      <span className="text-gray-400">Zona de Promoção</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500/10 border-l-2 border-red-500"></div>
                      <span className="text-gray-400">Zona de Rebaixamento</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Footer Stats */}
            <div className="sticky bottom-0 bg-gradient-to-r from-gray-900 to-gray-800 border-t-2 border-neon-yellow/30 px-6 py-4">
              <div className="flex items-center justify-center gap-8 text-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-neon-green" />
                  <span className="text-gray-300">
                    <span className="font-bold text-neon-green">
                      {divisions.reduce((acc, div) => acc + div.teams.filter(t => getPositionChange(t) > 0).length, 0)}
                    </span>
                    {' '}times subiram
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-400" />
                  <span className="text-gray-300">
                    <span className="font-bold text-red-400">
                      {divisions.reduce((acc, div) => acc + div.teams.filter(t => getPositionChange(t) < 0).length, 0)}
                    </span>
                    {' '}times caíram
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
