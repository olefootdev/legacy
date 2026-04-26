/**
 * Componente de Momento Interativo — Fase 2 Core Gameplay #1
 * Overlay que pausa o jogo e permite ao jogador escolher a ação.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Zap, Target, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InteractiveMoment, InteractiveMomentOption } from '@/match/interactiveMoments';

interface InteractiveMomentOverlayProps {
  moment: InteractiveMoment | null;
  onChoose: (option: InteractiveMomentOption) => void;
  onTimeout: () => void;
}

export function InteractiveMomentOverlay({ moment, onChoose, onTimeout }: InteractiveMomentOverlayProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<InteractiveMomentOption | null>(null);

  useEffect(() => {
    if (!moment) {
      setTimeLeft(0);
      setSelectedOption(null);
      return;
    }

    setTimeLeft(moment.timeWindowMs);

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 100;
        if (next <= 0) {
          clearInterval(interval);
          onTimeout();
          return 0;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [moment, onTimeout]);

  if (!moment) return null;

  const timeLeftPercent = (timeLeft / moment.timeWindowMs) * 100;
  const isUrgent = timeLeftPercent < 30;

  const handleChoose = (option: InteractiveMomentOption) => {
    setSelectedOption(option);
    setTimeout(() => onChoose(option), 300);
  };

  const getMomentTitle = () => {
    switch (moment.type) {
      case 'duel_1v1':
        return `${moment.attacker.name} vs ${moment.defender?.name}`;
      case 'one_on_one':
        return `${moment.attacker.name} cara a cara!`;
      case 'free_kick_dangerous':
        return `Falta perigosa — ${moment.distance}m`;
      default:
        return 'Momento decisivo';
    }
  };

  const getMomentDescription = () => {
    switch (moment.type) {
      case 'duel_1v1':
        return 'Duelo 1 contra 1 na área! O que fazer?';
      case 'one_on_one':
        return 'Só você e o goleiro! Como finalizar?';
      case 'free_kick_dangerous':
        return 'Falta perigosa! Escolha o tipo de cobrança:';
      default:
        return 'Escolha sua ação:';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl px-4"
        >
          {/* Header */}
          <div className="mb-6 text-center">
            <motion.div
              className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Zap className="h-8 w-8 text-white" strokeWidth={3} />
            </motion.div>

            <h2 className="mb-2 font-display text-3xl font-black uppercase tracking-tight text-yellow-400 sm:text-4xl">
              {getMomentTitle()}
            </h2>
            <p className="text-lg text-gray-300">{getMomentDescription()}</p>

            {/* Timer */}
            <div className="mx-auto mt-4 w-64">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-gray-400">
                  <Clock className="h-4 w-4" />
                  Tempo para decidir
                </span>
                <span className={cn(
                  'font-bold tabular-nums',
                  isUrgent ? 'text-red-400 animate-pulse' : 'text-white'
                )}>
                  {(timeLeft / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className={cn(
                    'h-full',
                    isUrgent ? 'bg-red-500' : 'bg-yellow-400'
                  )}
                  initial={{ width: '100%' }}
                  animate={{ width: `${timeLeftPercent}%` }}
                  transition={{ duration: 0.1, ease: 'linear' }}
                />
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="grid gap-3 sm:grid-cols-3">
            {moment.options.map((option, i) => {
              const isSelected = selectedOption?.action === option.action;
              const xGPercent = Math.round(option.xG * 100);
              const riskPercent = Math.round(option.risk * 100);

              return (
                <motion.button
                  key={option.action}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => handleChoose(option)}
                  disabled={!!selectedOption}
                  className={cn(
                    'group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all',
                    isSelected
                      ? 'border-yellow-400 bg-yellow-400/20 scale-105'
                      : 'border-white/20 bg-white/5 hover:border-yellow-400/50 hover:bg-white/10 hover:scale-105',
                    selectedOption && !isSelected && 'opacity-50'
                  )}
                >
                  {/* Icon */}
                  <div className="mb-3 text-4xl">{option.icon}</div>

                  {/* Label */}
                  <h3 className="mb-1 font-display text-xl font-bold uppercase tracking-wide text-white">
                    {option.label}
                  </h3>
                  <p className="mb-3 text-sm text-gray-400">{option.description}</p>

                  {/* Stats */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-gray-400">
                        <Target className="h-3 w-3" />
                        Chance de gol
                      </span>
                      <span className="font-bold text-green-400">{xGPercent}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-gray-400">
                        <AlertCircle className="h-3 w-3" />
                        Risco
                      </span>
                      <span className={cn(
                        'font-bold',
                        riskPercent > 50 ? 'text-red-400' : 'text-yellow-400'
                      )}>
                        {riskPercent}%
                      </span>
                    </div>
                  </div>

                  {/* Hover effect */}
                  <div className="absolute inset-0 -z-10 bg-gradient-to-br from-yellow-400/0 to-orange-500/0 opacity-0 transition-opacity group-hover:opacity-10" />
                </motion.button>
              );
            })}
          </div>

          {/* Hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-center text-xs text-gray-500"
          >
            💡 Escolha rápido! Se o tempo acabar, a IA decide por você.
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
