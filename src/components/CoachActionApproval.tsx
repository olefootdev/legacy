import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Clock, AlertCircle, Zap, TrendingUp, Users, Dumbbell } from 'lucide-react';
import { useGameDispatch, useGameStore } from '@/game/store';
import type { CoachAction } from '@/coach/types';
import { cn } from '@/lib/utils';

export function CoachActionApproval() {
  const dispatch = useGameDispatch();
  const coach = useGameStore((s) => s.manager.coach);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);

  if (!coach) return null;

  const pendingActions = coach.pendingActions.filter((a) => a.status === 'pending');

  if (pendingActions.length === 0) return null;

  const handleApprove = (actionId: string) => {
    dispatch({ type: 'COACH_APPROVE_ACTION', actionId });
    // Executa imediatamente após aprovar
    setTimeout(() => {
      dispatch({ type: 'COACH_EXECUTE_ACTION', actionId });
    }, 100);
  };

  const handleReject = (actionId: string) => {
    dispatch({ type: 'COACH_REJECT_ACTION', actionId });
  };

  const getActionIcon = (type: CoachAction['type']) => {
    switch (type) {
      case 'start_training':
        return Dumbbell;
      case 'upgrade_staff':
        return TrendingUp;
      case 'assign_staff':
        return Users;
      case 'start_treatment':
        return AlertCircle;
      default:
        return Zap;
    }
  };

  const getUrgencyColor = (urgency: CoachAction['urgency']) => {
    switch (urgency) {
      case 'high':
        return 'border-red-500/50 bg-red-500/10';
      case 'medium':
        return 'border-yellow-500/50 bg-yellow-500/10';
      case 'low':
        return 'border-blue-500/50 bg-blue-500/10';
    }
  };

  const getUrgencyBadge = (urgency: CoachAction['urgency']) => {
    switch (urgency) {
      case 'high':
        return 'bg-red-500/20 text-red-400';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'low':
        return 'bg-blue-500/20 text-blue-400';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-[calc(100vw-2rem)] sm:max-w-md space-y-3">
      <AnimatePresence>
        {pendingActions.map((action) => {
          const Icon = getActionIcon(action.type);
          const isExpanded = expandedActionId === action.id;

          return (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.95 }}
              className={cn(
                'mb-3 rounded-lg border-2 backdrop-blur-sm shadow-xl',
                getUrgencyColor(action.urgency)
              )}
            >
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-neon-yellow/20 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-neon-yellow" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-bold text-white truncate">
                        {action.title}
                      </h4>
                      <span
                        className={cn(
                          'shrink-0 px-2 py-0.5 rounded text-[9px] font-bold uppercase',
                          getUrgencyBadge(action.urgency)
                        )}
                      >
                        {action.urgency}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300">{action.description}</p>
                  </div>
                </div>

                {/* Reasoning (expandable) */}
                <button
                  onClick={() =>
                    setExpandedActionId(isExpanded ? null : action.id)
                  }
                  className="w-full text-left mb-3"
                >
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 hover:text-gray-300 transition-colors">
                    <Clock className="w-3 h-3" />
                    <span>
                      {isExpanded ? 'Ocultar' : 'Ver'} justificativa do coach
                    </span>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mb-3"
                    >
                      <div className="bg-black/40 rounded p-2.5 text-xs text-gray-300 leading-relaxed">
                        {action.reasoning}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(action.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-neon-yellow text-black px-3 py-2 rounded text-xs font-bold uppercase hover:bg-neon-yellow/90 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Aprovar
                  </button>
                  <button
                    onClick={() => handleReject(action.id)}
                    className="inline-flex items-center justify-center gap-1.5 bg-white/10 text-white px-3 py-2 rounded text-xs font-bold uppercase hover:bg-white/20 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Rejeitar
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
