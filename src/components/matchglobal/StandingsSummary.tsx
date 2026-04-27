/**
 * Tabelas Completas de Classificação por Divisão (Pós-Rodada)
 */

import { motion } from 'motion/react';
import { Trophy, TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { OlefootLeagueTeam } from '@/match/olefootLeague';

interface StandingsSummaryProps {
  standings: Array<{
    division: number;
    teams: OlefootLeagueTeam[];
  }>;
}

export function StandingsSummary({ standings }: StandingsSummaryProps) {
  const navigate = useNavigate();

  const getPositionChange = (team: OlefootLeagueTeam) => {
    if (!team.previousPosition) return 0;
    return team.previousPosition - team.position;
  };

  const getTeamRowClass = (team: OlefootLeagueTeam, divisionSize: number) => {
    const position = team.position;

    // Líder
    if (position === 1) return 'bg-neon-yellow/10 border-l-4 border-neon-yellow';

    // Zona de promoção (top 3)
    if (position <= 3) return 'bg-neon-green/5 border-l-4 border-neon-green/50';

    // Zona de rebaixamento (últimos 3)
    if (position > divisionSize - 3) return 'bg-red-500/5 border-l-4 border-red-500/50';

    return 'border-l-4 border-transparent';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-neon-yellow" />
          <div>
            <h2 className="font-display text-3xl font-bold uppercase tracking-wider text-white">
              Classificação
            </h2>
            <p className="text-sm text-text-soft font-mono">
              Tabelas atualizadas por divisão
            </p>
          </div>
        </div>
      </div>

      {/* Divisões - Grid de 3 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {standings.map((standing) => (
          <motion.div
            key={standing.division}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: standing.division * 0.1 }}
            className="sports-panel rounded-lg overflow-hidden"
          >
            {/* Header da Divisão */}
            <div className="bg-gradient-to-r from-neon-yellow/20 to-neon-green/20 border-b-2 border-neon-yellow/50 px-4 py-3">
              <h3 className="font-display text-xl font-bold uppercase tracking-wider text-neon-yellow text-center">
                {standing.division}ª DIVISÃO
              </h3>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-[40px_1fr_40px_40px_40px_50px] gap-2 px-3 py-2 bg-gray-800/50 border-b border-gray-700 text-xs font-mono text-gray-400 uppercase">
              <div className="text-center">#</div>
              <div>Time</div>
              <div className="text-center">J</div>
              <div className="text-center">V</div>
              <div className="text-center">SG</div>
              <div className="text-center font-bold">PTS</div>
            </div>

            {/* Times - Tabela Completa */}
            <div className="divide-y divide-gray-700/30">
              {standing.teams.map((team, idx) => {
                const change = getPositionChange(team);
                return (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: standing.division * 0.1 + idx * 0.03 }}
                    className={`grid grid-cols-[40px_1fr_40px_40px_40px_50px] gap-2 px-3 py-2.5 hover:bg-gray-700/20 transition-colors ${getTeamRowClass(team, standing.teams.length)}`}
                  >
                    {/* Posição + Seta */}
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-sm font-bold text-white font-mono">
                        {team.position}
                      </span>
                      {change > 0 && <ChevronUp className="w-3 h-3 text-neon-green" />}
                      {change < 0 && <ChevronDown className="w-3 h-3 text-red-400" />}
                      {change === 0 && team.matchesPlayed > 0 && <Minus className="w-3 h-3 text-gray-600" />}
                    </div>

                    {/* Nome do Time */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold text-white truncate">
                        {team.name}
                      </span>
                      {change !== 0 && (
                        <span className={`text-xs font-mono ${change > 0 ? 'text-neon-green' : 'text-red-400'}`}>
                          {change > 0 ? '+' : ''}{change}
                        </span>
                      )}
                    </div>

                    {/* Estatísticas */}
                    <div className="text-center text-sm font-mono text-gray-300">
                      {team.matchesPlayed}
                    </div>
                    <div className="text-center text-sm font-mono text-neon-green">
                      {team.wins}
                    </div>
                    <div className="text-center text-sm font-mono text-gray-300">
                      {team.goalsFor - team.goalsAgainst > 0 ? '+' : ''}{team.goalsFor - team.goalsAgainst}
                    </div>
                    <div className="text-center text-sm font-bold font-mono text-neon-yellow">
                      {team.points}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Legenda */}
            <div className="px-3 py-3 bg-gray-800/30 border-t border-gray-700 space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-neon-yellow/10 border-l-2 border-neon-yellow"></div>
                <span className="text-gray-400">Líder</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-neon-green/5 border-l-2 border-neon-green/50"></div>
                <span className="text-gray-400">Promoção</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500/5 border-l-2 border-red-500/50"></div>
                <span className="text-gray-400">Rebaixamento</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="sports-panel panel-accent rounded-lg p-4"
      >
        <div className="flex items-center justify-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-neon-green" />
            <span className="text-gray-300">
              <span className="font-bold text-neon-green font-mono text-lg">
                {standings.reduce((acc, div) => acc + div.teams.filter(t => getPositionChange(t) > 0).length, 0)}
              </span>
              {' '}times subiram
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <span className="text-gray-300">
              <span className="font-bold text-red-400 font-mono text-lg">
                {standings.reduce((acc, div) => acc + div.teams.filter(t => getPositionChange(t) < 0).length, 0)}
              </span>
              {' '}times caíram
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Minus className="w-5 h-5 text-gray-500" />
            <span className="text-gray-300">
              <span className="font-bold text-gray-400 font-mono text-lg">
                {standings.reduce((acc, div) => acc + div.teams.filter(t => getPositionChange(t) === 0 && t.matchesPlayed > 0).length, 0)}
              </span>
              {' '}mantiveram
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
