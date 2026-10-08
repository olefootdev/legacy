/**
 * Sprint 1: Overlay de Momento Interativo
 * Timeout de 5s com escolha automática baseada na intensidade tática
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Zap, Shield, Target, TrendingUp, Users } from 'lucide-react';
import type { QuickInteractiveMoment } from '@/match/quickInteractiveMoments';
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';

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
        return L('Contra-Ataque', 'Counter-Attack');
      case 'set_piece':
        return L('Bola Parada', 'Set Piece');
      case 'defensive_choice':
        return L('Decisão Defensiva', 'Defensive Decision');
      case 'sub_timing':
        return L('Substituição', 'Substitution');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-asfalto-27/95 px-0 sm:items-center sm:px-4"
      >
        <motion.div
          initial={{ scale: 0.96, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 20 }}
          className="relative max-h-[100dvh] w-full max-w-2xl overflow-y-auto bg-asfalto-27"
        >
          {/* Header — peça amarela com alambrado: é o momento de agir */}
          <div className="relative overflow-hidden bg-rua px-5 py-4 text-asfalto-27 sm:px-6">
            <span aria-hidden className="rua-alambrado pointer-events-none absolute inset-x-0 top-0 h-20 [--alambrado:rgba(13,13,12,0.24)]" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-asfalto-27">
                  {getMomentIcon()}
                </div>
                <div className="min-w-0">
                  <div className="font-prova text-[11px] font-bold uppercase tracking-[0.18em]">
                    {L('Minuto', 'Minute')} {moment.minute}'
                  </div>
                  <div className="truncate font-impact text-[28px] uppercase leading-none">
                    {getMomentLabel()}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-baseline gap-0.5 bg-asfalto-27 px-3 py-1.5">
                <Clock className="mr-1 h-4 w-4 self-center text-rua" aria-hidden />
                <span
                  className={cn(
                    'font-spray font-black text-[32px] leading-none tabular-nums',
                    countdown <= 1 ? 'animate-pulse text-baixa' : 'text-rua',
                  )}
                >
                  {countdown}
                </span>
                <span className="font-prova text-[12px] text-mudo">s</span>
              </div>
            </div>
          </div>

          {/* Context */}
          <div className="border-b border-linha px-5 py-4 sm:px-6">
            <p className="font-voz text-[24px] leading-[1.08] text-papel">{moment.context}</p>
          </div>

          {/* Choices */}
          <div className="space-y-3 p-5 sm:p-6">
            {moment.choices.map((choice) => {
              const isRecommended = moment.choices.every(c => choice.successChance >= c.successChance);
              const shouldPulse = countdown <= 1 && !selected && isRecommended;
              const picked = selected === choice.id;
              return (
              <motion.button
                key={choice.id}
                onClick={() => handleChoice(choice.id)}
                disabled={selected !== null}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'group relative w-full overflow-hidden p-4 text-left transition-[transform,box-shadow,background-color,border-color]',
                  picked
                    ? 'translate-x-0.5 translate-y-0.5 bg-rua text-asfalto-27 shadow-[2px_2px_0_var(--color-papel)]'
                    : selected
                      ? 'border-2 border-linha text-fio'
                      : 'border-2 border-papel bg-concreto text-papel hover:border-rua',
                  shouldPulse && 'animate-pulse border-rua',
                )}
              >
                <div className="mb-1.5 flex min-w-0 items-center justify-between gap-3">
                  <span className="min-w-0 font-impact text-[20px] uppercase leading-none">
                    {choice.label}
                  </span>
                  <span
                    className={cn(
                      'flex shrink-0 items-center gap-1 px-2 py-0.5 font-prova text-[11px] font-bold',
                      picked ? 'bg-asfalto-27 text-rua' : 'border-2 border-linha',
                    )}
                  >
                    <TrendingUp className={cn('h-3 w-3', picked ? 'text-rua' : 'text-alta')} aria-hidden />
                    {Math.round(choice.successChance * 100)}%
                  </span>
                </div>
                <p className={cn('text-[13px] leading-snug', picked ? 'text-asfalto-27/80' : 'text-suave')}>{choice.description}</p>
                {choice.reward.ole && (
                  <div className="mt-3 flex items-center gap-3 font-prova text-[12px] font-bold">
                    <span>+{choice.reward.ole} OLE</span>
                    {choice.reward.exp && <span className={picked ? 'text-asfalto-27/70' : 'text-mudo'}>+{choice.reward.exp} EXP</span>}
                  </div>
                )}
              </motion.button>
            );
            })}
          </div>

          {/* Timeout warning */}
          {countdown <= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-5 mb-6 border-l-[3px] border-baixa bg-concreto p-3 sm:mx-6"
            >
              <p className="text-center font-prova text-[12px] font-bold text-baixa">
                {L('A IA decide por você se o tempo esgotar.', 'The AI decides for you if time runs out.')}
              </p>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
