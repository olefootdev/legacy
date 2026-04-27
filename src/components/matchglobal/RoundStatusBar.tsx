/**
 * Barra de Status da Rodada Global
 *
 * Exibe countdown, status atual e próxima rodada
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Clock, Activity, Trophy, Zap } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { SCHEDULER_CONFIG, formatRoundTime } from '@/match/globalRoundScheduler';
import { GLOBAL_MATCH_CONSTANTS } from '@/match/globalMatch';

export function RoundStatusBar() {
  const globalLeague = useGameStore((s) => s.globalLeague);
  const currentRound = globalLeague?.currentRound;
  const [countdown, setCountdown] = useState('00:00:00');
  const [status, setStatus] = useState<'waiting' | 'pre_match' | 'live' | 'finished'>('waiting');

  useEffect(() => {
    if (!currentRound) {
      setCountdown('--:--:--');
      setStatus('waiting');
      return;
    }

    const interval = setInterval(() => {
      const nowMs = Date.now();

      // Rodada ao vivo
      if (currentRound.status === 'live' && currentRound.actualKickoffMs) {
        const elapsed = nowMs - currentRound.actualKickoffMs;
        const remaining = Math.max(0, SCHEDULER_CONFIG.ROUND_DURATION_MS - elapsed);
        setCountdown(formatMs(remaining));
        setStatus('live');
        return;
      }

      // Janela de comandos
      if (currentRound.status === 'pre_match') {
        const remaining = Math.max(0, currentRound.scheduledKickoffMs - nowMs);
        setCountdown(formatMs(remaining));
        setStatus('pre_match');
        return;
      }

      // Aguardando próxima rodada
      if (currentRound.status === 'finished' && currentRound.finishedAtMs) {
        const nextRoundMs = currentRound.finishedAtMs + SCHEDULER_CONFIG.ROUND_INTERVAL_MS;
        const remaining = Math.max(0, nextRoundMs - nowMs);
        setCountdown(formatMs(remaining));
        setStatus('finished');
        return;
      }

      // Rodada agendada
      const remaining = Math.max(0, currentRound.scheduledKickoffMs - nowMs);
      setCountdown(formatMs(remaining));
      setStatus('waiting');
    }, 100); // Atualizar a cada 100ms para countdown suave

    return () => clearInterval(interval);
  }, [currentRound]);

  if (!currentRound) {
    return (
      <div className="sports-panel rounded-lg p-4 border border-white/10">
        <div className="flex items-center justify-center gap-2 text-text-soft">
          <Clock className="w-5 h-5" />
          <p className="font-display text-sm uppercase tracking-wider">
            Aguardando criação da liga
          </p>
        </div>
      </div>
    );
  }

  const nextKickoffTime = currentRound.status === 'finished' && currentRound.finishedAtMs
    ? formatRoundTime(currentRound.finishedAtMs + SCHEDULER_CONFIG.ROUND_INTERVAL_MS)
    : formatRoundTime(currentRound.scheduledKickoffMs);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="sports-panel rounded-lg p-4 border border-white/10"
    >
      <div className="flex items-center justify-between gap-6">
        {/* Status Atual */}
        <div className="flex items-center gap-3">
          {status === 'live' && (
            <>
              <Activity className="w-6 h-6 text-neon-green animate-pulse" />
              <div>
                <p className="text-xs text-text-soft uppercase tracking-wider font-display">
                  Rodada ao Vivo
                </p>
                <p className="font-serif-hero text-2xl font-bold text-neon-green">
                  {countdown}
                </p>
              </div>
            </>
          )}

          {status === 'pre_match' && (
            <>
              <Zap className="w-6 h-6 text-neon-yellow animate-pulse" />
              <div>
                <p className="text-xs text-text-soft uppercase tracking-wider font-display">
                  Janela de Comandos
                </p>
                <p className="font-serif-hero text-2xl font-bold text-neon-yellow">
                  {countdown}
                </p>
              </div>
            </>
          )}

          {status === 'finished' && (
            <>
              <Trophy className="w-6 h-6 text-neon-yellow" />
              <div>
                <p className="text-xs text-text-soft uppercase tracking-wider font-display">
                  Rodada Finalizada
                </p>
                <p className="font-serif-hero text-2xl font-bold text-white">
                  Próxima em {countdown}
                </p>
              </div>
            </>
          )}

          {status === 'waiting' && (
            <>
              <Clock className="w-6 h-6 text-neon-yellow" />
              <div>
                <p className="text-xs text-text-soft uppercase tracking-wider font-display">
                  Próxima Rodada
                </p>
                <p className="font-serif-hero text-2xl font-bold text-white">
                  {countdown}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Info da Rodada */}
        <div className="text-right">
          <p className="text-xs text-text-soft uppercase tracking-wider font-display mb-1">
            Rodada #{currentRound.roundNumber}
          </p>
          <p className="font-display text-sm font-bold text-white">
            Kickoff: {nextKickoffTime}
          </p>
        </div>
      </div>

      {/* Barra de Progresso (apenas durante rodada ao vivo) */}
      {status === 'live' && currentRound.actualKickoffMs && (
        <div className="mt-3">
          <div className="h-1 bg-deep-black rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-neon-green to-neon-yellow"
              initial={{ width: '0%' }}
              animate={{
                width: `${((Date.now() - currentRound.actualKickoffMs) / SCHEDULER_CONFIG.ROUND_DURATION_MS) * 100}%`,
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
