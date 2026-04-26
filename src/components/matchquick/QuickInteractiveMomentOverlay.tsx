/**
 * Sprint 1: Overlay de Momento Interativo
 * Pausa a partida e exige decisão do jogador em 4s
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Zap } from 'lucide-react';
import type { QuickInteractiveMoment } from '@/match/quickInteractiveMoments';
import { cn } from '@/lib/utils';

interface Props {
  moment: QuickInteractiveMoment;
  onChoice: (choiceId: string) => void;
}

export function QuickInteractiveMomentOverlay({ moment, onChoice }: Props) {
  const [countdown, setCountdown] = useState(4);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const elapsed = Date.now() - moment.triggeredAtMs;
    const remaining = Math.max(0, moment.timeoutMs - elapsed);
    setCountdown(Math.ceil(remaining / 1000));

    const interval = setInterval(() => {
      const now = Date.now();
      const left = Math.max(0, moment.triggeredAtMs + moment.timeoutMs - now);
      const sec = Math.ceil(left / 1000);
      setCountdown(sec);

      if (left <= 0) {
        clearInterval(interval);
        if (!selected) {
          onChoice('timeout');
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [moment, selected, onChoice]);

  const handleChoice = (choiceId: string) => {
    setSelected(choiceId);
    setTimeout(() => onChoice(choiceId), 300);
  };

  const getMomentIcon = () => {
    switch (moment.type) {
      case 'counter_attack':
        return '⚡';
      case 'set_piece':
        return '🎯';
      case 'defensive_choice':
        return '🛡️';
      case 'sub_timing':
        return '🔄';
    }
  };

  const getMomentColor = () => {
    switch (moment.type) {
      case 'counter_attack':
        return 'from-yellow-500/20 to-orange-500/20';
      case 'set_piece':
        return 'from-blue-500/20 to-purple-500/20';
      case 'defensive_choice':
        return 'from-red-500/20 to-pink-500/20';
      case 'sub_timing':
        return 'from-green-500/20 to-teal-500/20';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className={cn(
            'relative w-full max-w-md mx-4 p-6 rounded-2xl border-2',
            'bg-gradient-to-br',
            getMomentColor(),
            'border-white/20 shadow-2xl',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-3xl">{getMomentIcon()}</span>
              <div>
                <div className="text-xs text-white/60 uppercase tracking-wider">
                  Minuto {moment.minute}'
                </div>
                <div className="text-sm font-bold text-white">Decisão Tática</div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span
                className={cn(
                  'text-lg font-bold tabular-nums',
                  countdown <= 1 ? 'text-red-400 animate-pulse' : 'text-white',
                )}
              >
                {countdown}s
              </span>
            </div>
          </div>

          {/* Context */}
          <div className="mb-6 p-4 rounded-lg bg-black/30 border border-white/10">
            <p className="text-sm text-white/90 leading-relaxed">{moment.context}</p>
          </div>

          {/* Choices */}
          <div className="space-y-3">
            {moment.choices.map((choice) => (
              <motion.button
                key={choice.id}
                onClick={() => handleChoice(choice.id)}
                disabled={selected !== null}
                whileHover={{ scale: selected ? 1 : 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'w-full p-4 rounded-xl border-2 transition-all',
                  'flex items-start gap-3 text-left',
                  selected === choice.id
                    ? 'bg-yellow-500/30 border-yellow-400 shadow-lg shadow-yellow-500/20'
                    : selected
                      ? 'bg-black/20 border-white/10 opacity-50'
                      : 'bg-black/40 border-white/20 hover:border-white/40 hover:bg-black/50',
                )}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-bold text-white">{choice.label}</span>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      <span className="text-xs text-white/80">
                        {Math.round(choice.successChance * 100)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-white/60">{choice.description}</p>
                  {choice.reward.ole && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-yellow-400">
                      <span>+{choice.reward.ole} OLE</span>
                      {choice.reward.exp && <span>+{choice.reward.exp} EXP</span>}
                    </div>
                  )}
                </div>
              </motion.button>
            ))}
          </div>

          {/* Timeout warning */}
          {countdown <= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30"
            >
              <p className="text-xs text-red-300 text-center">
                ⚠️ A IA decidirá por você se o tempo esgotar!
              </p>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
