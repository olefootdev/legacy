/**
 * UI de Registro na Liga Global MVP
 * Mostra contador X/32 times e permite cadastro
 */

import { motion } from 'framer-motion';
import { Users, Trophy, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { useNavigate } from 'react-router-dom';
import { overallFromAttributes } from '@/entities/player';

export default function GlobalLeagueRegistration() {
  const dispatch = useGameDispatch();
  const navigate = useNavigate();

  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);
  const userSettings = useGameStore((s) => s.userSettings);

  // Calcular overall do time (média dos 11 melhores)
  const teamOverall = Math.round(
    Object.values(players)
      .map(p => overallFromAttributes(p.attributes))
      .sort((a, b) => b - a)
      .slice(0, 11)
      .reduce((sum, ovr) => sum + ovr, 0) / 11
  );

  const managerId = userSettings.managerProfile?.email || 'guest';
  const isRegistered = globalLeagueMVP?.teams.some(t => t.managerId === managerId);
  const teamsCount = globalLeagueMVP?.teams.length || 0;
  const minTeams = globalLeagueMVP?.minTeamsRequired || 32;
  const progress = (teamsCount / minTeams) * 100;

  const handleRegister = () => {
    if (!globalLeagueMVP) {
      dispatch({ type: 'INIT_GLOBAL_LEAGUE_MVP' });
    }

    dispatch({
      type: 'REGISTER_GLOBAL_TEAM',
      managerId,
      clubName: club.name,
      clubShort: club.short,
      overall: teamOverall,
    });
  };

  return (
    <div className="mx-auto min-w-0 w-full max-w-4xl space-y-6 overflow-x-hidden px-3 sm:px-4 lg:px-6 pb-6 md:pb-8">
      {/* Hero */}
      <section className="relative w-full overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-6">
        <div className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden">
          <motion.span
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="font-serif-hero font-black text-black/[0.04]"
            style={{
              fontSize: 'clamp(180px, 32vw, 460px)',
              lineHeight: '0.85',
              letterSpacing: '-0.05em',
            }}
          >
            {teamsCount}
          </motion.span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14 text-center"
        >
          <div className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-black mb-4 sm:mb-6">
            <span>Liga Global · Temporada 2026</span>
          </div>

          <h1 className="leading-[0.9]">
            <span
              className="block font-bold uppercase text-black"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.75rem, 8vw, 6rem)',
                letterSpacing: '0.005em',
              }}
            >
              Registro Aberto
            </span>
            <motion.span
              key={teamsCount}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="block italic text-black"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontSize: 'clamp(2.25rem, 7vw, 5rem)',
                marginTop: '0.04em',
                letterSpacing: '-0.01em',
              }}
            >
              {teamsCount}/{minTeams} times
            </motion.span>
          </h1>

          <span aria-hidden className="mx-auto mt-6 block w-16 h-[3px] bg-black" />

          {/* Progress Bar */}
          <div className="mt-8 max-w-md mx-auto">
            <div className="h-3 bg-black/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-black"
              />
            </div>
            <p className="mt-2 text-xs text-black/70">
              {minTeams - teamsCount} times restantes para iniciar playoffs
            </p>
          </div>

          {/* Status */}
          <div className="mt-8 flex justify-center">
            <div className="inline-flex items-center gap-2 bg-black px-4 py-2 rounded-sm">
              {isRegistered ? (
                <>
                  <CheckCircle className="w-4 h-4 text-neon-yellow" />
                  <span className="font-display text-xs font-bold uppercase tracking-wider text-neon-yellow">
                    Cadastrado
                  </span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 text-white/70" />
                  <span className="font-display text-xs font-bold uppercase tracking-wider text-white/70">
                    Aguardando
                  </span>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-panel border border-white/10 rounded-sm p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-neon-yellow/10 border border-neon-yellow/20 rounded-sm">
              <Trophy className="w-5 h-5 text-neon-yellow" />
            </div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">
              Playoffs
            </h3>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">
            3 rodadas ida/volta (6 jogos) para definir as divisões
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-panel border border-white/10 rounded-sm p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-400/10 border border-blue-400/20 rounded-sm">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">
              3 Divisões
            </h3>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">
            ~11 times por divisão baseado no desempenho nos playoffs
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-panel border border-white/10 rounded-sm p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-400/10 border border-emerald-400/20 rounded-sm">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">
              Promoção
            </h3>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">
            Top 10% sobem, bottom 10% descem a cada temporada
          </p>
        </motion.div>
      </div>

      {/* Seu Time */}
      {!isRegistered && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-panel border border-neon-yellow/20 rounded-sm p-6"
        >
          <h3 className="font-display text-base font-bold uppercase tracking-wider text-white mb-4">
            Seu Time
          </h3>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="font-display text-lg font-bold text-white">{club.name}</p>
              <p className="text-xs text-white/60 mt-1">{club.city}</p>
            </div>
            <div className="text-right">
              <p className="font-serif-hero text-3xl font-bold text-neon-yellow">{teamOverall}</p>
              <p className="text-xs text-white/60 uppercase tracking-wider">Overall</p>
            </div>
          </div>
          <button
            onClick={handleRegister}
            className="w-full bg-neon-yellow text-black px-6 py-3 font-display text-sm font-black uppercase tracking-wider rounded-sm hover:brightness-110 transition-all shadow-[0_4px_16px_rgba(253,225,0,0.3)]"
          >
            Entrar na Liga Global
          </button>
        </motion.div>
      )}

      {/* Times Cadastrados */}
      {teamsCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-panel border border-white/10 rounded-sm p-6"
        >
          <h3 className="font-display text-base font-bold uppercase tracking-wider text-white mb-4">
            Times Cadastrados ({teamsCount})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
            {globalLeagueMVP?.teams.map((team, index) => (
              <div
                key={team.id}
                className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-white/40">#{index + 1}</span>
                  <span className="font-display text-sm font-bold text-white truncate">
                    {team.clubName}
                  </span>
                </div>
                <span className="font-serif-hero text-sm text-neon-yellow">{team.overall}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
