/**
 * Sprint 1: Overlay de Momento Interativo
 * Timeout de 5s com escolha automática baseada na intensidade tática
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Zap, Shield, Target, TrendingUp, Users } from 'lucide-react';
import type { QuickInteractiveMoment } from '@/match/quickInteractiveMoments';
import { cn } from '@/lib/utils';

interface Props {
  moment: QuickInteractiveMoment;
  onChoice: (choiceId: string) => void;
}

export function QuickInteractiveMomentOverlay({ moment, onChoice }: Props) {
  const [countdown, setCountdown] = useState(5);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const elapsed = Date.now() - moment.triggeredAtMs;
    const remaining = Math.max(0, 5000 - elapsed);
    setCountdown(Math.ceil(remaining / 1000));

    const interval = setInterval(() => {
      const now = Date.now();
      const left = Math.max(0, moment.triggeredAtMs + 5000 - now);
      const sec = Math.ceil(left / 1000);
      setCountdown(sec);

      if (left <= 0) {
        clearInterval(interval);
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
        return <Zap className="h-8 w-8 text-neon-yellow" />;
      case 'set_piece':
        return <Target className="h-8 w-8 text-neon-yellow" />;
      case 'defensive_choice':
        return <Shield className="h-8 w-8 text-neon-yellow" />;
      case 'sub_timing':
        return <Users className="h-8 w-8 text-neon-yellow" />;
    }
  };

  const getMomentLabel = () => {
    switch (moment.type) {
      case 'counter_attack':
        return 'Contra-Ataque';
      case 'set_piece':
        return 'Bola Parada';
      case 'defensive_choice':
        return 'Decisão Defensiva';
      case 'sub_timing':
        return 'Substituição';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md px-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-neon-yellow/30 bg-deep-black shadow-[0_0_40px_rgba(253,224,71,0.2)]"
        >
          {/* Glow effect */}
          <div className="absolute left-0 top-0 h-full w-1 bg-neon-yellow" />

          {/* Header */}
          <div className="border-b border-white/10 bg-gradient-to-br from-neon-yellow/10 to-transparent px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-neon-yellow/10 border border-neon-yellow/30">
                  {getMomentIcon()}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    Minuto {moment.minute}'
                  </div>
                  <div className="font-display text-lg font-black uppercase tracking-tight text-white">
                    {getMomentLabel()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-neon-yellow/30 bg-black/60 px-4 py-2">
                <Clock className="h-4 w-4 text-neon-yellow" />
                <span
                  className={cn(
                    'font-display text-xl font-black tabular-nums',
                    countdown <= 1 ? 'text-red-400 animate-pulse' : 'text-neon-yellow',
                  )}
                >
                  {countdown}s
                </span>
              </div>
            </div>
          </div>

          {/* Context */}
          <div className="border-b border-white/10 bg-black/40 px-6 py-4">
            <p className="text-sm leading-relaxed text-white/80">{moment.context}</p>
          </div>

          {/* Choices */}
          <div className="space-y-3 p-6">
            {moment.choices.map((choice) => (
              <motion.button
                key={choice.id}
                onClick={() => handleChoice(choice.id)}
                disabled={selected !== null}
                whileHover={{ scale: selected ? 1 : 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'group relative w-full overflow-hidden rounded-lg border p-4 text-left transition-all',
                  selected === choice.id
                    ? 'border-neon-yellow bg-neon-yellow/10 shadow-[0_0_20px_rgba(253,224,71,0.3)]'
                    : selected
                      ? 'border-white/10 bg-black/20 opacity-40'
                      : 'border-white/10 bg-black/40 hover:border-neon-yellow/40 hover:bg-black/60',
                )}
              >
                {selected === choice.id && (
                  <div className="absolute left-0 top-0 h-full w-1 bg-neon-yellow" />
                )}
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={cn(
                          'font-display text-base font-bold uppercase tracking-tight',
                          selected === choice.id ? 'text-neon-yellow' : 'text-white',
                        )}
                      >
                        {choice.label}
                      </span>
                      <div className="flex items-center gap-1 rounded bg-white/10 px-2 py-0.5">
                        <TrendingUp className="h-3 w-3 text-green-400" />
                        <span className="text-xs font-bold text-white/80">
                          {Math.round(choice.successChance * 100)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-white/60">{choice.description}</p>
                    {choice.reward.ole && (
                      <div className="mt-3 flex items-center gap-3 text-xs font-bold">
                        <span className="text-neon-yellow">+{choice.reward.ole} OLE</span>
                        {choice.reward.exp && <span className="text-white/60">+{choice.reward.exp} EXP</span>}
                      </div>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Timeout warning */}
          {countdown <= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-6 mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-3"
            >
              <p className="text-center text-xs font-semibold text-red-400">
                ⚠️ A IA decidirá por você se o tempo esgotar!
              </p>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
