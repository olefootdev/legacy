/**
 * Barra de Status da Rodada Global
 *
 * Exibe countdown, status atual e próxima rodada
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Clock, Activity, Trophy, Zap } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { SCHEDULER_CONFIG, formatRoundTime, getSlotStatus } from '@/match/globalRoundScheduler';

export function RoundStatusBar() {
  const globalLeague = useGameStore((s) => s.globalLeague);
  const currentRound = globalLeague?.currentRound;
  const [countdown, setCountdown] = useState('00:00:00');
  const [status, setStatus] = useState<'waiting' | 'command_window' | 'live' | 'finished' | 'offline'>('waiting');

  useEffect(() => {
    const interval = setInterval(() => {
      const nowMs = Date.now();
      const slotStatus = getSlotStatus(nowMs);

      // Fora dos slots (noite)
      if (!slotStatus.activeSlot && !slotStatus.isCommandWindow) {
        setStatus('offline');
        if (slotStatus.nextSlotStartMs) {
          setCountdown(formatMs(Math.max(0, slotStatus.nextSlotStartMs - nowMs)));
        } else {
          setCountdown('--:--:--');
        }
        return;
      }

      // Janela de comando entre slots
      if (slotStatus.isCommandWindow) {
        setStatus('command_window');
        if (slotStatus.nextSlotStartMs) {
          setCountdown(formatMs(Math.max(0, slotStatus.nextSlotStartMs - nowMs)));
        }
        return;
      }

      if (!currentRound) {
        setStatus('waiting');
        setCountdown('--:--:--');
        return;
      }

      // Rodada ao vivo
      if (currentRound.status === 'live' && currentRound.actualKickoffMs) {
        const elapsed = nowMs - currentRound.actualKickoffMs;
        const remaining = Math.max(0, SCHEDULER_CONFIG.ROUND_DURATION_MS - elapsed);
        setCountdown(formatMs(remaining));
        setStatus('live');
        return;
      }

      // Rodada finalizada — aguardando próxima (5min)
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
    }, 100);

    return () => clearInterval(interval);
  }, [currentRound]);

  const nextKickoffTime = currentRound?.status === 'finished' && currentRound.finishedAtMs
    ? formatRoundTime(currentRound.finishedAtMs + SCHEDULER_CONFIG.ROUND_INTERVAL_MS)
    : currentRound
      ? formatRoundTime(currentRound.scheduledKickoffMs)
      : '--:--';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="sports-panel rounded-lg p-4 border border-white/10"
    >
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          {status === 'live' && (
            <>
              <Activity className="w-6 h-6 text-neon-green animate-pulse" />
              <div>
                <p className="text-xs text-text-soft uppercase tracking-wider font-display">Rodada ao Vivo</p>
                <p className="font-serif-hero text-2xl font-bold text-neon-green">{countdown}</p>
              </div>
            </>
          )}
          {status === 'command_window' && (
            <>
              <Zap className="w-6 h-6 text-neon-yellow animate-pulse" />
              <div>
                <p className="text-xs text-text-soft uppercase tracking-wider font-display">Janela de Comando</p>
                <p className="font-serif-hero text-2xl font-bold text-neon-yellow">{countdown}</p>
              </div>
            </>
          )}
          {status === 'finished' && (
            <>
              <Trophy className="w-6 h-6 text-neon-yellow" />
              <div>
                <p className="text-xs text-text-soft uppercase tracking-wider font-display">Rodada Finalizada</p>
                <p className="font-serif-hero text-2xl font-bold text-white">Próxima em {countdown}</p>
              </div>
            </>
          )}
          {status === 'waiting' && (
            <>
              <Clock className="w-6 h-6 text-neon-yellow" />
              <div>
                <p className="text-xs text-text-soft uppercase tracking-wider font-display">Próxima Rodada</p>
                <p className="font-serif-hero text-2xl font-bold text-white">{countdown}</p>
              </div>
            </>
          )}
          {status === 'offline' && (
            <>
              <Clock className="w-6 h-6 text-text-soft" />
              <div>
                <p className="text-xs text-text-soft uppercase tracking-wider font-display">Fora do Ar</p>
                <p className="font-serif-hero text-2xl font-bold text-text-soft">Retorna em {countdown}</p>
              </div>
            </>
          )}
        </div>

        <div className="text-right">
          <p className="text-xs text-text-soft uppercase tracking-wider font-display mb-1">
            {currentRound ? `Rodada #${currentRound.roundNumber}` : 'Sem rodada'}
          </p>
          <p className="font-display text-sm font-bold text-white">
            Kickoff: {nextKickoffTime}
          </p>
        </div>
      </div>

      {status === 'live' && currentRound?.actualKickoffMs && (
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
