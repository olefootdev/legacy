import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Clock, AlertCircle, Zap, TrendingUp, Users, Dumbbell } from 'lucide-react';
import { useGameDispatch, useGameStore } from '@/game/store';
import type { CoachAction } from '@/coach/types';
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';

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
        return 'border-baixa/60 bg-concreto';
      case 'medium':
        return 'border-atencao/60 bg-concreto';
      case 'low':
        return 'border-linha bg-concreto';
    }
  };

  const getUrgencyBadge = (urgency: CoachAction['urgency']) => {
    switch (urgency) {
      case 'high':
        return 'bg-baixa/20 text-baixa';
      case 'medium':
        return 'bg-atencao/20 text-atencao';
      case 'low':
        return 'bg-concreto text-mudo';
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
                'mb-3 border-2',
                getUrgencyColor(action.urgency)
              )}
            >
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-linha flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-papel" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="truncate font-impact text-[17px] uppercase leading-[1.1] text-papel">
                        {action.title}
                      </h4>
                      <span
                        className={cn(
                          'shrink-0 px-2 py-0.5 font-prova text-[9.5px] font-medium uppercase',
                          getUrgencyBadge(action.urgency)
                        )}
                      >
                        {action.urgency}
                      </span>
                    </div>
                    <p className="text-xs text-papel">{action.description}</p>
                  </div>
                </div>

                {/* Reasoning (expandable) */}
                <button
                  onClick={() =>
                    setExpandedActionId(isExpanded ? null : action.id)
                  }
                  className="w-full text-left mb-3"
                >
                  <div className="flex items-center gap-2 text-[10px] text-mudo hover:text-papel transition-colors">
                    <Clock className="w-3 h-3" />
                    <span>
                      {isExpanded ? L('Ocultar justificativa do coach', 'Hide coach reasoning') : L('Ver justificativa do coach', 'Show coach reasoning')}
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
                      <div className="bg-concreto p-2.5 text-xs text-papel leading-relaxed">
                        {action.reasoning}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(action.id)}
                    className="ole-num flex-1 inline-flex items-center justify-center gap-1.5 bg-rua text-asfalto-27 px-3 py-2 text-[12px] uppercase hover:bg-papel transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    {L('Aprovar', 'Approve')}
                  </button>
                  <button
                    onClick={() => handleReject(action.id)}
                    className="ole-num inline-flex items-center justify-center gap-1.5 border border-fio text-papel px-3 py-2 text-[12px] uppercase hover:border-papel transition-colors"
                  >
                    <X className="w-4 h-4" />
                    {L('Rejeitar', 'Reject')}
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
